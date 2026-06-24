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
  enrolledAt: number;
}

export interface ProgramInput {
  name: string;
  description?: string;
  category: ProgramCategory;
}

export interface ParticipationSummary {
  programId: string;
  activeEnrollments: number;
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

export function enrollMember(programId: string, memberAddress: string): Promise<ProgramEnrollment> {
  const enrollment: ProgramEnrollment = {
    id: memberAddress,
    programId,
    memberAddress,
    status: 'active',
    enrolledAt: Date.now(),
  };
  return enrollments().create(programId, enrollment);
}

/** Active enrollments for a program. */
export async function listEnrollments(programId: string): Promise<ProgramEnrollment[]> {
  const list = await enrollments().list(programId);
  return list.filter((enrollment) => enrollment.status === 'active');
}

export async function participationSummary(programId: string): Promise<ParticipationSummary> {
  const active = await listEnrollments(programId);
  return { programId, activeEnrollments: active.length };
}

/** Test-only: reset the singletons so each test starts from empty state. */
export function __resetWellnessForTests(): void {
  programRepo = null;
  enrollmentRepo = null;
}
