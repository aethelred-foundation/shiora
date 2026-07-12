# Shiora — Pilot Scope (production slice)

Adopted 2026-07-11 per external consultant review: the first production pilot
serves **one narrow corridor**, enforced **server-side** by the deployment
profile (`SHIORA_PROFILE=pilot`), not by UI hiding. Deferred surfaces answer
`503 FEATURE_DISABLED` at the middleware, before auth or handler logic runs.
The active profile is auditable at `GET /api/system/status`.

## The corridor (enabled under `pilot`)

1. **Patient onboarding & authentication** — wallet auth, passkeys, TOTP MFA,
   one-time account-recovery codes, session management (`/api/wallet`,
   `/api/webauthn`, `/api/mfa`, `/api/me`, `/api/me/recovery`).
2. **FHIR ingestion** from the named partner (`/api/fhir`).
3. **Encrypted record storage** with provenance (`/api/records`).
4. **Granular, time-bound consent** (`/api/consent`).
5. **Verified provider access** + patient directory (`/api/provider`, `/api/providers`, `/api/access`).
6. **Append-only clinical notes** with attributed amendments (under `/api/provider/patients/*/notes`, `/api/me/clinical-notes`).
7. **Break-glass clinical emergency access** — a structured emergency category
   (clinical-emergency / continuity-of-care), declared reason, **minimum-necessary
   record types**, fresh MFA step-up, ≤1h read-only grant, **PHI-free** immediate
   patient notification, per-event governance (jurisdiction / policy version /
   authorizing organization), sensitive-category withholding unless explicitly
   acknowledged, and an admin retrospective-review queue (`/api/break-glass`).
   Deliberately in the corridor: a care pilot cannot ship without an emergency
   path. Legal basis is the pilot jurisdiction + partner policy (counsel-confirmed),
   not a US HIPAA provision. Distinct from the *simulated* emergency-response
   feature (`emergency` segment), which stays deferred, and from system-continuity
   operational access, which is a separate admin concern (no patient PHI).
8. **Patient-visible access history** (`/api/me/access-log`, `/api/me/activity`).
9. **Export, correction and erasure** (`/api/privacy`, record PATCH).
10. **Operational notifications** (`/api/notifications`).
11. **Optional, asynchronous, fail-soft anchoring** of audit-segment roots
    (`/api/anchors`, `/api/audit/export`) — never a dependency for care.

Plus the operational plane: `/api/health/*`, `/api/system/*`, `/api/openapi`,
`/api/roles` (admin), `/api/security/csp-report`.

## Deferred under `pilot` (server-enforced)

| Surface | Segment(s) | Re-enable requires |
|---|---|---|
| Employer console & wellness | `employer` | Signed pilot requirement |
| Health-plan/payer (care gaps) | `health-plans` | Signed pilot requirement |
| Government workflows | `governance` | Signed pilot requirement |
| Population analytics | `population` | Strengthened de-identification governance |
| Community circles | `community` | Moderation model |
| Research marketplace & studies | `marketplace`, `research` | Research environment + governance path |
| User-facing ZK/MPC | `zkp`, `mpc` | Post-pilot |
| Live SANA (chat + API) | `chat`, `sana` | Clinical/AI governance sign-off |
| Clinical decision support | `clinical` | Regulatory (SaMD) pathway |
| Genomics / digital twin / XAI / emergency | `genomics`, `twin`, `xai`, `emergency` | Real pipelines + pathways |
| Wearables + derived insights | `wearables`, `insights` | Signed pilot use case |
| Cycle/symptom vault | `vault` | Signed pilot scope inclusion (one-flag flip) |
| Compliance reports (audience-facing) | `compliance` | Post-pilot |
| Outbound webhooks | `webhooks` | Partner integration requirement |
| Chain/demo surfaces | `tee`, `staking`, `rewards`, `network`, `ipfs` | Not pilot material |

The authoritative machine-readable list is `PILOT_DISABLED_SEGMENTS` in
[`src/lib/api/feature-flags.ts`](../src/lib/api/feature-flags.ts); this table
mirrors it. Changing pilot scope = one reviewed commit to that map plus an
update here — never an ad-hoc config toggle.

## Rules

- The **default profile is `full`** (development and the test suite are
  unaffected). Pilot deployments must set `SHIORA_PROFILE=pilot` explicitly and
  verify it via `/api/system/status`.
- A deferred surface is disabled at the API. UI navigation to it will receive
  honest 503s — pilot builds should also hide those pages, but the server is
  the enforcement point.
- An MBZUAI research track runs in a **separate environment and governance
  path** with synthetic or governed de-identified data — never by widening this
  corridor.
