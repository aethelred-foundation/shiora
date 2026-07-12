// ============================================================
// Shiora on Aethelred — Break-glass emergency access (consultant P0)
//
// A deliberate, heavily-audited path for a clinician to read a patient's
// records when consent cannot be obtained (the patient is unconscious, the
// granting flow is unreachable) — HIPAA §164.512(j) emergency circumstances.
// Nothing here is silent or broad:
//
//   • the requester must DECLARE a reason and patient context up front;
//   • the grant is read-only, scoped to records, and expires within one hour;
//   • declaration and every read land on the tamper-evident audit chain with
//     both the actor (clinician) and subject (patient) dimensions, so each use
//     appears in the patient's own access history;
//   • the patient is notified immediately (a non-mutable notice type);
//   • every use enters a retrospective-review queue, and an adverse review
//     closes the grant on the spot.
//
// Grants are sealed at rest in the patient-owned encrypted collection, so the
// repository's audit trail naturally attributes the write to the clinician
// while binding the document to the patient it concerns.
// ============================================================

import { randomUUID } from 'crypto';

import { getAuditLog } from '@/lib/api/audit-log';
import { listRecords } from '@/lib/api/records-service';
import type { MockHealthRecord } from '@/lib/api/mock-data';
import { notify } from '@/lib/api/notification-service';
import { EncryptedDocumentRepository } from '@/lib/persistence/encrypted-documents';
import { InMemoryDocumentStore, type DocumentStorePort } from '@/lib/persistence/document-store';
import { PgDocumentStore } from '@/lib/persistence/pg-document-store';
import { getPgClient } from '@/lib/persistence/sql-client';
import { shouldUsePostgres } from '@/lib/persistence/datastore-mode';

const COLLECTION = 'break-glass';

/** How long a declared emergency authorizes reads. Deliberately short. */
export const BREAK_GLASS_TTL_MS = 60 * 60 * 1000; // 1 hour — the ceiling, not a default

/** The only capability a break-glass grant ever carries. */
export const BREAK_GLASS_SCOPE = 'records:read';

export type BreakGlassOutcome = 'justified' | 'unjustified';

export interface BreakGlassReview {
  reviewer: string;
  outcome: BreakGlassOutcome;
  notes: string;
  reviewedAt: number;
}

export interface BreakGlassGrant {
  id: string;
  requester: string;
  patient: string;
  reason: string;
  patientContext: string;
  scope: typeof BREAK_GLASS_SCOPE;
  createdAt: number;
  expiresAt: number;
  review: BreakGlassReview | null;
}

export type BreakGlassStatus = 'active' | 'expired' | 'reviewed';

export interface BreakGlassUse {
  grant: BreakGlassGrant;
  status: BreakGlassStatus;
}

export interface BreakGlassDeclaration {
  patient: string;
  reason: string;
  patientContext: string;
}

export type BreakGlassReadResult =
  | { ok: true; grant: BreakGlassGrant; records: MockHealthRecord[] }
  | { ok: false; reason: 'not_found' | 'forbidden' | 'expired' | 'closed' };

let repository: EncryptedDocumentRepository<BreakGlassGrant> | null = null;

function createStore(): DocumentStorePort {
  return shouldUsePostgres() ? new PgDocumentStore(getPgClient()) : new InMemoryDocumentStore();
}

function repo(): EncryptedDocumentRepository<BreakGlassGrant> {
  if (!repository) {
    repository = new EncryptedDocumentRepository<BreakGlassGrant>(
      createStore(), getAuditLog(), COLLECTION,
      { create: 'BREAK_GLASS_ACCESS', update: 'BREAK_GLASS_REVIEW' },
    );
  }
  return repository;
}

function statusOf(grant: BreakGlassGrant, now: number): BreakGlassStatus {
  if (grant.review) {
    return 'reviewed';
  }
  return now >= grant.expiresAt ? 'expired' : 'active';
}

/**
 * Declare an emergency and mint the short-lived, read-only grant. Returns null
 * for a self-targeted declaration — reading your own records is ordinary
 * authenticated access and must never wear the emergency label.
 */
export async function declareBreakGlass(
  requester: string,
  declaration: BreakGlassDeclaration,
  now: number = Date.now(),
): Promise<BreakGlassGrant | null> {
  if (requester === declaration.patient) {
    return null;
  }

  const grant: BreakGlassGrant = {
    id: `bg-${randomUUID().replace(/-/g, '')}`,
    requester,
    patient: declaration.patient,
    reason: declaration.reason,
    patientContext: declaration.patientContext,
    scope: BREAK_GLASS_SCOPE,
    createdAt: now,
    expiresAt: now + BREAK_GLASS_TTL_MS,
    review: null,
  };

  // The repository appends the BREAK_GLASS_ACCESS chain entry with
  // actor = the clinician and subject = the patient, so the declaration
  // surfaces in the patient's own access history.
  await repo().create(declaration.patient, grant, requester);

  await notify(declaration.patient, {
    type: 'emergency_access',
    title: 'Emergency access to your records',
    body:
      `${requester} declared emergency access to your records — "${grant.reason}" `
      + `(${grant.patientContext}). Access is read-only and expires at `
      + `${new Date(grant.expiresAt).toISOString()}. Every use is recorded in your `
      + 'access history and will be independently reviewed.',
  });

  return grant;
}

async function findGrant(id: string): Promise<BreakGlassGrant | undefined> {
  const grants = await repo().listAll();
  return grants.find((grant) => grant.id === id);
}

/**
 * Read the patient's records under an active grant. Denials are audited just
 * as prominently as successful reads: a probe against someone else's grant is
 * exactly what the retrospective review needs to see.
 */
export async function readRecordsUnderBreakGlass(
  requester: string,
  grantId: string,
  now: number = Date.now(),
): Promise<BreakGlassReadResult> {
  const grant = await findGrant(grantId);
  if (!grant) {
    return { ok: false, reason: 'not_found' };
  }

  const status = statusOf(grant, now);
  const denial =
    grant.requester !== requester ? 'forbidden'
    : status === 'reviewed' ? 'closed'
    : status === 'expired' ? 'expired'
    : null;

  if (denial !== null) {
    await getAuditLog().record({
      action: 'BREAK_GLASS_RECORD_READ',
      actor: requester,
      subject: grant.patient,
      resource: COLLECTION,
      resourceId: grant.id,
      success: false,
      metadata: { grantId: grant.id, denied: denial },
    });
    return { ok: false, reason: denial };
  }

  const records = await listRecords(grant.patient);
  await getAuditLog().record({
    action: 'BREAK_GLASS_RECORD_READ',
    actor: requester,
    subject: grant.patient,
    resource: COLLECTION,
    resourceId: grant.id,
    success: true,
    metadata: { grantId: grant.id, recordCount: records.length },
  });
  return { ok: true, grant, records };
}

/** Every break-glass use, most recent first, for the retrospective queue. */
export async function listBreakGlassUses(
  options: { pendingOnly?: boolean; now?: number } = {},
): Promise<BreakGlassUse[]> {
  const now = options.now ?? Date.now();
  const uses = (await repo().listAll())
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((grant) => ({ grant, status: statusOf(grant, now) }));
  return options.pendingOnly ? uses.filter((use) => use.grant.review === null) : uses;
}

/**
 * Record the retrospective verdict on one use. Reviewing closes the grant —
 * an unjustified use must not retain even its remaining minutes of access.
 */
export async function reviewBreakGlassUse(
  reviewer: string,
  grantId: string,
  outcome: BreakGlassOutcome,
  notes: string,
  now: number = Date.now(),
): Promise<BreakGlassGrant | 'not_found' | 'already_reviewed'> {
  const grant = await findGrant(grantId);
  if (!grant) {
    return 'not_found';
  }
  if (grant.review) {
    return 'already_reviewed';
  }

  const review: BreakGlassReview = { reviewer, outcome, notes, reviewedAt: now };
  const updated = await repo().update(grant.patient, grant.id, { review }, reviewer);
  return updated!;
}

/** Test-only: reset the singleton so each test starts from empty state. */
export function __resetBreakGlassForTests(): void {
  repository = null;
}
