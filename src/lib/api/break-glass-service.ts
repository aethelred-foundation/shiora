// ============================================================
// Shiora on Aethelred — Break-glass clinical emergency access (consultant P0)
//
// A deliberate, heavily-audited path for a clinician to read a patient's
// records when consent cannot be obtained (the patient is unconscious, the
// granting flow is unreachable). Nothing here is silent or broad:
//
//   • the requester DECLARES a structured emergency category, a reason, and
//     the MINIMUM-NECESSARY record types up front;
//   • the grant is read-only, expires within one hour, and returns only the
//     declared record types — sensitive categories (reproductive, sexual- and
//     mental-health, genetics, safeguarding) are withheld unless explicitly
//     acknowledged, an extra affirmative step;
//   • declaration and every read land on the tamper-evident audit chain with
//     both the actor (clinician) and subject (patient) dimensions, plus the
//     jurisdiction, policy version, and authorizing organization of the event;
//   • the patient is notified immediately — with NO PHI in the notice;
//   • every use enters a retrospective-review queue, and an adverse review
//     closes the grant on the spot.
//
// SCOPE (per consultant §5): this is CLINICAL emergency access to a specific
// patient's records. It is deliberately separate from system-continuity /
// operational emergency access (which is admin-scoped, touches no patient PHI,
// and is not served here).
//
// LEGAL BASIS (per consultant §5): the design mirrors the HIPAA technical
// safeguard for an emergency-access procedure, 45 CFR §164.312(a)(2)(ii) —
// which is a control-design reference, NOT the operative legal basis. For an
// Abu Dhabi pilot the operative basis is the pilot jurisdiction's health-data
// law + ADHICS + the partner's clinical/privacy/legal policy, recorded per
// event as jurisdiction/policyVersion/authorizingOrganization and confirmed by
// counsel before go-live. A US provision is never asserted as the legal basis.
// (The prior in-code citation of §164.512(j) — serious-and-imminent-threat
// DISCLOSURE — was the wrong provision and has been corrected.)
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

/** Structured emergency categories (no free-text-only justification, per §5). */
export const EMERGENCY_CATEGORIES = ['clinical_emergency', 'continuity_of_care'] as const;
export type EmergencyCategory = (typeof EMERGENCY_CATEGORIES)[number];

/**
 * Record tags treated as especially sensitive: they are WITHHELD from a
 * break-glass read unless the declaration explicitly acknowledges the
 * heightened sensitivity (§5 "additional controls"). Matched case-insensitively
 * against a record's `type` and `tags`.
 */
export const SENSITIVE_RECORD_TAGS: ReadonlySet<string> = new Set([
  'reproductive', 'sexual_health', 'sexual-health', 'mental_health', 'mental-health',
  'genetics', 'genomics', 'genomic', 'safeguarding', 'hiv', 'sti',
]);

/** Per-event governance context, recorded on every grant (§5). */
export interface BreakGlassPolicy {
  jurisdiction: string;
  policyVersion: string;
  authorizingOrganization: string;
}

/** Resolve the break-glass governance policy from configuration. */
export function breakGlassPolicy(): BreakGlassPolicy {
  return {
    jurisdiction: process.env.SHIORA_JURISDICTION || 'unconfigured',
    policyVersion: process.env.SHIORA_BREAK_GLASS_POLICY_VERSION || 'break-glass/v1',
    authorizingOrganization: process.env.SHIORA_BREAK_GLASS_AUTHORITY || 'unconfigured',
  };
}

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
  category: EmergencyCategory;
  reason: string;
  patientContext: string;
  /** Minimum-necessary record types this grant may read (§5). Non-empty. */
  recordTypes: string[];
  /** Whether especially-sensitive records were explicitly acknowledged (§5). */
  sensitiveAcknowledged: boolean;
  scope: typeof BREAK_GLASS_SCOPE;
  jurisdiction: string;
  policyVersion: string;
  authorizingOrganization: string;
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
  category: EmergencyCategory;
  reason: string;
  patientContext: string;
  recordTypes: string[];
  sensitiveAcknowledged?: boolean;
}

export type BreakGlassReadResult =
  | { ok: true; grant: BreakGlassGrant; records: MockHealthRecord[]; sensitiveWithheld: number }
  | { ok: false; reason: 'not_found' | 'forbidden' | 'expired' | 'closed' };

/** Does a record carry any especially-sensitive tag (type or tags)? */
function isSensitiveRecord(record: MockHealthRecord): boolean {
  const labels = [record.type, ...(record.tags ?? [])].map((t) => String(t).toLowerCase());
  return labels.some((label) => SENSITIVE_RECORD_TAGS.has(label));
}

/**
 * Apply minimum-necessary scoping to a patient's records for a grant: keep only
 * the declared record types, and withhold sensitive records unless the grant
 * acknowledged them. Pure and unit-testable.
 */
export function applyMinimumNecessary(
  records: MockHealthRecord[],
  grant: Pick<BreakGlassGrant, 'recordTypes' | 'sensitiveAcknowledged'>,
): { records: MockHealthRecord[]; sensitiveWithheld: number } {
  const allowedTypes = new Set(grant.recordTypes.map((t) => t.toLowerCase()));
  let sensitiveWithheld = 0;
  const kept = records.filter((record) => {
    if (!allowedTypes.has(String(record.type).toLowerCase())) {
      return false;
    }
    if (!grant.sensitiveAcknowledged && isSensitiveRecord(record)) {
      sensitiveWithheld += 1;
      return false;
    }
    return true;
  });
  return { records: kept, sensitiveWithheld };
}

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

  const policy = breakGlassPolicy();
  const grant: BreakGlassGrant = {
    id: `bg-${randomUUID().replace(/-/g, '')}`,
    requester,
    patient: declaration.patient,
    category: declaration.category,
    reason: declaration.reason,
    patientContext: declaration.patientContext,
    recordTypes: declaration.recordTypes,
    sensitiveAcknowledged: declaration.sensitiveAcknowledged ?? false,
    scope: BREAK_GLASS_SCOPE,
    jurisdiction: policy.jurisdiction,
    policyVersion: policy.policyVersion,
    authorizingOrganization: policy.authorizingOrganization,
    createdAt: now,
    expiresAt: now + BREAK_GLASS_TTL_MS,
    review: null,
  };

  // The repository appends the BREAK_GLASS_ACCESS chain entry with
  // actor = the clinician and subject = the patient, so the declaration
  // surfaces in the patient's own access history.
  await repo().create(declaration.patient, grant, requester);

  // The patient's notice carries NO PHI (§5): not the clinician's free-text
  // reason, not the patient context, not the record types — only that
  // emergency access was declared, is read-only, when it expires, and that it
  // is recorded and reviewed. The full detail lives in the audit chain.
  await notify(declaration.patient, {
    type: 'emergency_access',
    title: 'Emergency access to your records',
    body:
      'A verified provider declared emergency (break-glass) access to your records. '
      + `Access is read-only, limited to the minimum necessary, and expires at `
      + `${new Date(grant.expiresAt).toISOString()}. Every use is recorded in your `
      + 'access history and is independently reviewed.',
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

  const governance = {
    category: grant.category,
    jurisdiction: grant.jurisdiction,
    policyVersion: grant.policyVersion,
    authorizingOrganization: grant.authorizingOrganization,
  };

  if (denial !== null) {
    await getAuditLog().record({
      action: 'BREAK_GLASS_RECORD_READ',
      actor: requester,
      subject: grant.patient,
      resource: COLLECTION,
      resourceId: grant.id,
      success: false,
      metadata: { grantId: grant.id, denied: denial, ...governance },
    });
    return { ok: false, reason: denial };
  }

  // Minimum-necessary: only the declared record types, sensitive categories
  // withheld unless acknowledged (§5).
  const all = await listRecords(grant.patient);
  const { records, sensitiveWithheld } = applyMinimumNecessary(all, grant);

  await getAuditLog().record({
    action: 'BREAK_GLASS_RECORD_READ',
    actor: requester,
    subject: grant.patient,
    resource: COLLECTION,
    resourceId: grant.id,
    success: true,
    metadata: {
      grantId: grant.id,
      recordCount: records.length,
      recordTypes: grant.recordTypes,
      sensitiveAcknowledged: grant.sensitiveAcknowledged,
      sensitiveWithheld,
      ...governance,
    },
  });
  return { ok: true, grant, records, sensitiveWithheld };
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
