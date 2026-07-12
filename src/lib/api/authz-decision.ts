// ============================================================
// Shiora on Aethelred — Authorization-decision snapshots (consultant §3)
//
// An immutable, point-in-time record of WHY a PHI access was allowed or denied.
// Consent, grants, and policy change over time; without a snapshot taken at the
// moment of access it can become impossible to demonstrate — to an auditor or a
// regulator — that access was lawful when it happened. Every snapshot captures
// the authorization context the decision actually rested on:
//
//   • data domain / tenant boundary and the actor's organization,
//   • the data subject and the actor,
//   • purpose of use and legal basis,
//   • the grant and consent versions relied upon,
//   • the policy version in force,
//   • an emergency-override id when the access was a break-glass,
//   • the decision (allow/deny), a machine-readable reason, and the timestamp.
//
// Snapshots are written to the tamper-evident, hash-chained audit log as
// AUTHZ_DECISION entries — append-only and integrity-protected for free — with
// the subject dimension set, so each one also surfaces in the patient's own
// "who accessed my data" history. Denials are recorded exactly as prominently
// as grants: a refused probe is precisely what a reviewer needs to see.
//
// TENANT SCOPE (honest): a single-organization pilot has one data domain, taken
// from configuration here so the field exists on every decision from day one.
// Explicit per-record tenant columns + Postgres row-level security are the
// multi-tenant follow-up (docs/AUTHORIZATION.md), gated on the deployment model.
// ============================================================

import { getAuditLog } from '@/lib/api/audit-log';

/** Why PHI is being accessed. Pilot-relevant HL7-style purposes. */
export type PurposeOfUse =
  | 'treatment'
  | 'care_coordination'
  | 'patient_access'
  | 'emergency'
  | 'operations';

/** The lawful basis relied on for the access. */
export type LegalBasis =
  | 'consent'
  | 'vital_interest'
  | 'legitimate_interest'
  | 'legal_obligation';

export type AuthzDecision = 'allow' | 'deny';

/** Configuration-sourced tenant/data-domain context for the deployment. */
export interface AuthzContext {
  tenantId: string;
  dataDomainId: string;
  policyVersion: string;
}

/** Resolve the authorization context from configuration (§3). */
export function authzContext(): AuthzContext {
  return {
    tenantId: process.env.SHIORA_TENANT_ID || 'unconfigured',
    dataDomainId: process.env.SHIORA_DATA_DOMAIN_ID || 'unconfigured',
    policyVersion: process.env.SHIORA_AUTHZ_POLICY_VERSION || 'authz/v1',
  };
}

export interface AuthorizationDecisionInput {
  actor: string;
  actorOrganizationId?: string;
  subject: string;
  resource: string;
  resourceId: string;
  purposeOfUse: PurposeOfUse;
  decision: AuthzDecision;
  /** Machine-readable reason, e.g. 'active_grant' | 'no_active_grant' | 'break_glass'. */
  reason: string;
  legalBasis?: LegalBasis;
  grantId?: string;
  grantVersion?: number;
  consentVersion?: number;
  emergencyOverrideId?: string;
  decidedAt?: number;
}

/** The full immutable snapshot written to the audit chain. */
export interface AuthorizationDecision {
  tenantId: string;
  dataDomainId: string;
  policyVersion: string;
  actor: string;
  actorOrganizationId: string;
  subject: string;
  resource: string;
  resourceId: string;
  purposeOfUse: PurposeOfUse;
  legalBasis: LegalBasis | null;
  decision: AuthzDecision;
  reason: string;
  grantId: string | null;
  grantVersion: number | null;
  consentVersion: number | null;
  emergencyOverrideId: string | null;
  decidedAt: number;
}

/**
 * Build and durably record an authorization-decision snapshot. Returns the
 * snapshot for the caller to include in its response envelope if useful.
 */
export async function recordAuthorizationDecision(
  input: AuthorizationDecisionInput,
): Promise<AuthorizationDecision> {
  const ctx = authzContext();
  const snapshot: AuthorizationDecision = {
    tenantId: ctx.tenantId,
    dataDomainId: ctx.dataDomainId,
    policyVersion: ctx.policyVersion,
    actor: input.actor,
    actorOrganizationId: input.actorOrganizationId ?? 'unconfigured',
    subject: input.subject,
    resource: input.resource,
    resourceId: input.resourceId,
    purposeOfUse: input.purposeOfUse,
    legalBasis: input.legalBasis ?? null,
    decision: input.decision,
    reason: input.reason,
    grantId: input.grantId ?? null,
    grantVersion: input.grantVersion ?? null,
    consentVersion: input.consentVersion ?? null,
    emergencyOverrideId: input.emergencyOverrideId ?? null,
    decidedAt: input.decidedAt ?? Date.now(),
  };

  await getAuditLog().record({
    action: 'AUTHZ_DECISION',
    actor: snapshot.actor,
    subject: snapshot.subject,
    resource: snapshot.resource,
    resourceId: snapshot.resourceId,
    success: snapshot.decision === 'allow',
    metadata: { ...snapshot },
  });

  return snapshot;
}
