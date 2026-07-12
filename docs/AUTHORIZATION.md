# Shiora — Authorization Model & Decision Snapshots

Adopted 2026-07-12 per external consultant review §3. This describes how the
platform authorizes PHI access, what it records at the moment of each decision,
and the roadmap from single-tenant pilot to multi-tenant row-level security.

## Layers

1. **Authentication** — a signed wallet session (+ passkey/MFA); `requireAuth`.
2. **Role & capability** — six roles + a capability matrix; `requireRole` /
   `requireCapability` gate every route.
3. **Object-level authorization** — every PHI object is owner-scoped; a provider
   reads a patient's data only through an active, viewable, unexpired **access
   grant** (or a declared **break-glass** emergency). Enforced in the service
   layer, independent of route naming, and covered by the adversarial
   negative-space suite (`src/__tests__/security/negative-space.test.ts`).
4. **Authorization-decision snapshot** — the new §3 layer below.

## Authorization-decision snapshots (§3)

Consent, grants, and policy change over time. Without a record taken **at the
instant of access**, it can be impossible to later demonstrate that an access
was lawful *when it happened*. Every PHI-access decision — **allowed and
denied** — now writes an immutable snapshot (`src/lib/api/authz-decision.ts`):

| Field | Source |
|---|---|
| `tenantId`, `dataDomainId` | configuration (`SHIORA_TENANT_ID`, `SHIORA_DATA_DOMAIN_ID`) |
| `policyVersion` | configuration (`SHIORA_AUTHZ_POLICY_VERSION`) |
| `actor`, `actorOrganizationId` | the requesting user + their organization |
| `subject` | the data subject (patient) |
| `resource`, `resourceId` | what was accessed |
| `purposeOfUse` | treatment / care_coordination / patient_access / emergency / operations |
| `legalBasis` | consent / vital_interest / legitimate_interest / legal_obligation |
| `grantId`, `grantVersion` | the access grant relied upon |
| `consentVersion` | the consent version relied upon |
| `emergencyOverrideId` | the break-glass grant id, when applicable |
| `decision`, `reason`, `decidedAt` | allow/deny, machine-readable reason, timestamp |

Snapshots are written as **`AUTHZ_DECISION`** entries on the tamper-evident,
hash-chained audit log — append-only and integrity-protected — with the subject
dimension set, so each one also appears in the patient's own "who accessed my
data" history. The canonical wiring point is the provider-reads-patient gate
(`records-service.listRecordsForProvider`): a denied probe is recorded exactly
as prominently as an allowed read.

## Tenant isolation roadmap (§3, honest scope)

**Pilot (single organization, separate database).** One data domain, taken from
configuration so the `tenantId`/`dataDomainId` fields exist on every decision
from day one. Object-level authorization is enforced in the service layer and
independently tested. This matches the consultant's time-limited RLS exception:
one named organization, a separate database, no secondary audiences enabled,
cross-organization sharing impossible by deployment, recorded in the risk
register with a deadline to enable RLS before a second tenant.

**Before a second tenant / shared database (P0 for multi-tenant).**

- Explicit per-record `tenant_id` / `data_domain_id` columns (the fields are
  already recorded per decision; this makes them first-class on the rows).
- Postgres **row-level security** with **default-deny** policies and
  **transaction-scoped** tenant context — set and cleared within each
  transaction, never left on a pooled connection.
- `actor_organization_id`, purpose-of-use, and consent/legal-basis snapshots
  attached to each access (the snapshot already carries these).
- Consent-version + localized-consent-text-hash captured at consent time (for
  Arabic/multilingual consent).

This migration is **additive** and gated on the deployment model decision; it is
tracked as the multi-tenant follow-up, not a pilot blocker for a physically
isolated single-partner deployment.
