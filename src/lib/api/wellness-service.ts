// ============================================================
// Shiora on Aethelred — Wellness Programs Service (employer audience)
//
// Real, encrypted employer wellness programs and member enrollment, built on
// the same org-ownership model as the employer admin console. Programs are
// scoped to an organization; enrollments are scoped to a program. Every write
// is sealed at rest and appended to the tamper-evident audit chain. Postgres
// when DATABASE_URL is set, else in-memory.
// ============================================================

import { randomUUID } from 'crypto';

import { getAuditLog } from '@/lib/api/audit-log';
import { notify } from '@/lib/api/notification-service';
import { EncryptedDocumentRepository } from '@/lib/persistence/encrypted-documents';
import { InMemoryDocumentStore, type DocumentStorePort } from '@/lib/persistence/document-store';
import { PgDocumentStore } from '@/lib/persistence/pg-document-store';
import { getPgClient } from '@/lib/persistence/sql-client';
import { shouldUsePostgres } from '@/lib/persistence/datastore-mode';

const PROGRAM_COLLECTION = 'wellness-program';
const ENROLLMENT_COLLECTION = 'program-enrollment';

export type ProgramCategory =
  | 'fitness'
  | 'mental_health'
  | 'nutrition'
  | 'preventive'
  | 'chronic_care';

export type EnrollmentStatus = 'active' | 'withdrawn';

export interface WellnessProgram {
  id: string;
  orgId: string;
  name: string;
  description: string;
  category: ProgramCategory;
  createdAt: number;
}

export interface ProgramEnrollment {
  id: string; // the member address
  programId: string;
  memberAddress: string;
  status: EnrollmentStatus;
  /** Self-reported progress through the program, 0–100. */
  progress: number;
  completed: boolean;
  enrolledAt: number;
  updatedAt: number;
}

export interface ProgramInput {
  name: string;
  description?: string;
  category: ProgramCategory;
}

export interface ParticipationSummary {
  programId: string;
  activeEnrollments: number;
  completedCount: number;
  averageProgress: number;
}

export interface OrgWellnessAnalytics {
  programCount: number;
  totalActiveEnrollments: number;
  totalCompleted: number;
  /** Share of active enrollments marked complete, 0–100. */
  completionRate: number;
  averageProgress: number;
}

let programRepo: EncryptedDocumentRepository<WellnessProgram> | null = null;
let enrollmentRepo: EncryptedDocumentRepository<ProgramEnrollment> | null = null;

function createStore(): DocumentStorePort {
  if (shouldUsePostgres()) {
    return new PgDocumentStore(getPgClient());
  }
  return new InMemoryDocumentStore();
}

function programs(): EncryptedDocumentRepository<WellnessProgram> {
  if (!programRepo) {
    programRepo = new EncryptedDocumentRepository<WellnessProgram>(
      createStore(),
      getAuditLog(),
      PROGRAM_COLLECTION,
      { create: 'WELLNESS_PROGRAM_CREATE', update: 'WELLNESS_PROGRAM_UPDATE' },
    );
  }
  return programRepo;
}

function enrollments(): EncryptedDocumentRepository<ProgramEnrollment> {
  if (!enrollmentRepo) {
    enrollmentRepo = new EncryptedDocumentRepository<ProgramEnrollment>(
      createStore(),
      getAuditLog(),
      ENROLLMENT_COLLECTION,
      { create: 'WELLNESS_ENROLL', update: 'WELLNESS_UNENROLL' },
    );
  }
  return enrollmentRepo;
}

// ── Programs (scoped to an organization) ─────────────────────────────────────

export function createProgram(orgId: string, input: ProgramInput): Promise<WellnessProgram> {
  const program: WellnessProgram = {
    id: `prog-${randomUUID().replace(/-/g, '')}`,
    orgId,
    name: input.name,
    description: input.description ?? '',
    category: input.category,
    createdAt: Date.now(),
  };
  return programs().create(orgId, program);
}

/** An organization's wellness programs, most recent first. */
export async function listPrograms(orgId: string): Promise<WellnessProgram[]> {
  const list = await programs().list(orgId);
  return list.sort((a, b) => b.createdAt - a.createdAt);
}

export function getProgram(orgId: string, programId: string): Promise<WellnessProgram | undefined> {
  return programs().get(orgId, programId);
}

// ── Enrollment (scoped to a program) ─────────────────────────────────────────

export async function enrollMember(programId: string, memberAddress: string): Promise<ProgramEnrollment> {
  const now = Date.now();
  const enrollment: ProgramEnrollment = {
    id: memberAddress,
    programId,
    memberAddress,
    status: 'active',
    progress: 0,
    completed: false,
    enrolledAt: now,
    updatedAt: now,
  };
  const created = await enrollments().create(programId, enrollment);
  await notify(memberAddress, {
    type: 'wellness',
    title: 'Enrolled in a wellness program',
    body: 'Your employer has enrolled you in a wellness program.',
  });
  return created;
}

/**
 * Record a member's progress (0–100); reaching 100 marks the program complete.
 * Returns undefined when the member is not actively enrolled.
 */
export async function updateProgress(
  programId: string,
  memberAddress: string,
  progress: number,
): Promise<ProgramEnrollment | undefined> {
  const existing = await enrollments().get(programId, memberAddress);
  if (!existing || existing.status !== 'active') {
    return undefined;
  }
  return enrollments().update(programId, memberAddress, {
    progress,
    completed: progress >= 100,
    updatedAt: Date.now(),
  });
}

/** Withdraw an active member. Returns undefined when not actively enrolled. */
export async function withdrawMember(
  programId: string,
  memberAddress: string,
): Promise<ProgramEnrollment | undefined> {
  const existing = await enrollments().get(programId, memberAddress);
  if (!existing || existing.status !== 'active') {
    return undefined;
  }
  return enrollments().update(programId, memberAddress, {
    status: 'withdrawn',
    updatedAt: Date.now(),
  });
}

/** Active enrollments for a program. */
export async function listEnrollments(programId: string): Promise<ProgramEnrollment[]> {
  const list = await enrollments().list(programId);
  return list.filter((enrollment) => enrollment.status === 'active');
}

export async function participationSummary(programId: string): Promise<ParticipationSummary> {
  const active = await listEnrollments(programId);
  const completedCount = active.filter((enrollment) => enrollment.completed).length;
  const averageProgress = active.length > 0
    ? Math.round(active.reduce((sum, enrollment) => sum + enrollment.progress, 0) / active.length)
    : 0;
  return { programId, activeEnrollments: active.length, completedCount, averageProgress };
}

/** Aggregate wellness participation across all of an organization's programs. */
export async function orgWellnessAnalytics(orgId: string): Promise<OrgWellnessAnalytics> {
  const programs = await listPrograms(orgId);
  let totalActiveEnrollments = 0;
  let totalCompleted = 0;
  let progressSum = 0;
  for (const program of programs) {
    const active = await listEnrollments(program.id);
    totalActiveEnrollments += active.length;
    for (const enrollment of active) {
      if (enrollment.completed) {
        totalCompleted += 1;
      }
      progressSum += enrollment.progress;
    }
  }
  const completionRate = totalActiveEnrollments > 0
    ? Math.round((totalCompleted / totalActiveEnrollments) * 100)
    : 0;
  const averageProgress = totalActiveEnrollments > 0
    ? Math.round(progressSum / totalActiveEnrollments)
    : 0;
  return {
    programCount: programs.length,
    totalActiveEnrollments,
    totalCompleted,
    completionRate,
    averageProgress,
  };
}

/** Test-only: reset the singletons so each test starts from empty state. */
export function __resetWellnessForTests(): void {
  programRepo = null;
  enrollmentRepo = null;
}
