# Shiora — Engineering Progress Report

**Prepared:** 2026-06-24
**Repository:** `aethelred-foundation/shiora` (private)
**Branch / PR:** `feat/backbone-phi-encryption-audit` → PR #9 (open, review-ready)
**Status of this work:** 18 commits, all CI-green; not yet merged to `main`.

> **Purpose.** This report describes, concretely and honestly, what has been
> built in the current work stream so it can be reviewed by an external
> consultant before further investment. It deliberately separates *what is real
> and tested* from *what is still mock, not wired, or process-gated*, so the
> reader can form an accurate picture of platform maturity.

---

## 1. Executive summary

The work transformed Shiora's backend from a **polished frontend over a seeded
mock API** into a **real, encrypted, auditable data platform with role-based
access control for six distinct audiences**, while preserving the application's
existing 100% test-coverage discipline.

Concretely, in this PR (vs. the branch base):

- **88 files changed, ~6,200 insertions, ~3,800 deletions.**
- **21 new backend modules** (persistence + service layers) and **6 new API route groups.**
- The **entire seeded in-memory store was deleted** (1,517 lines) — there is no mock data store left in the data path.
- Test suite grew to **169 suites / 3,359 tests, passing at a 100% coverage gate** (statements, branches, functions, lines), with clean `lint` and `type-check`.

**What is genuinely real now:** PHI encryption-at-rest, a tamper-evident durable
audit trail, owner-scoped encrypted persistence (Postgres-ready), six-audience
RBAC + capability authorization, and working GDPR data-subject-rights endpoints.

**What is explicitly NOT done:** external integrations (blockchain/L1, TEE
attestation, zero-knowledge proofs, IPFS, AI/LLM) are **not wired**; several
display/reference endpoints still return synthetic data; durable storage
requires a configured database (in-memory otherwise); and all third-party
compliance certifications and clinical/regulatory clearances remain outstanding
(these are process- and time-gated, not code).

---

## 2. Starting point (for context)

The pre-existing repository was a well-engineered **Next.js 15 frontend** with a
**real API security perimeter** (wallet-signature authentication, HMAC-signed
sessions, CORS, rate limiting, Zod validation) wrapping a **mock data core**:
all records/grants/consents/listings were generated from fixed seeds and
persisted to a flat JSON file. There was **no database, no encryption of data at
rest, no real audit trail, and no role model**. `teeVerified: true` and
compliance scores were hardcoded literals.

This work stream addressed the data, security, governance, and audit layers. It
did **not** change the frontend or the authentication perimeter (both were
already real).

---

## 3. Architecture built

The backend now follows a layered **ports-and-adapters** design:

```
 API Routes (Next.js handlers)
   │  authn (wallet sig + signed session)  ← pre-existing
   │  authz (requireAuth / requireRole / requireCapability / requireAdmin)
   ▼
 Services (records / access / consent / marketplace / roles / privacy / analytics)
   │  driver selection: Postgres when DATABASE_URL set, else in-memory
   ▼
 Encrypted Repositories (EncryptedRecordRepository, EncryptedDocumentRepository)
   │  AES-256-GCM envelope encryption + AAD binding + audit on every mutation
   ▼
 Storage Ports (RecordStorePort, DocumentStorePort)
   ├── InMemory*Store        (development / preview / tests)
   └── Pg*Store              (production — verified against a real Postgres engine)

 Cross-cutting: PersistentAuditLog (tamper-evident hash chain, shared by all services)
```

**Key design properties:**

- **Driver-agnostic.** Every service runs identical encryption/audit logic over
  either an in-memory driver or Postgres, selected at runtime by `DATABASE_URL`.
  The production SQL was verified end-to-end against a real Postgres engine
  (PGlite), confirming ciphertext-at-rest, round-trip decryption, and
  owner-scoping.
- **Encryption is structural, not optional.** PHI never reaches a storage driver
  in plaintext; the repository layer seals it before `put` and opens it after
  `get`.
- **Audit is automatic.** Because every mutation flows through the repository
  layer, every create/update/delete is written to the shared tamper-evident log
  without per-route code.

### New backend modules (21)

**Persistence layer** (`src/lib/persistence/`):
`record-store.ts`, `encrypted-records.ts`, `pg-record-store.ts`,
`document-store.ts`, `encrypted-documents.ts`, `pg-document-store.ts`,
`sql-client.ts`, `schema.ts`.

**Crypto** (`src/lib/crypto/`):
`envelope.ts` (AES-256-GCM envelope encryption), `audit-chain.ts`
(tamper-evident hash chain + `AuditRecorder` interface).

**Service / domain layer** (`src/lib/api/`):
`records-service.ts`, `access-service.ts`, `consent-service.ts`,
`marketplace-service.ts`, `roles-service.ts`, `roles.ts`, `rbac.ts`,
`capabilities.ts`, `audit-log.ts`, `privacy.ts`, `population-analytics.ts`.

### New API route groups (6)

`/api/me`, `/api/roles` (+ `/api/roles/[address]`), `/api/audit`,
`/api/population/analytics`, `/api/provider/patients` — plus capability gating
and real-data wiring applied to existing route groups (records, access, consent,
marketplace, clinical, mpc, privacy).

---

## 4. What was built — by capability

### 4.1 PHI encryption at rest (real)
- **AES-256-GCM envelope encryption** (`envelope.ts`): each value is encrypted
  under a fresh per-record Data Encryption Key (DEK); the DEK is wrapped under a
  Key Encryption Key (KEK). Additional Authenticated Data (AAD) binds every
  ciphertext to its `owner:recordId` context — a record's ciphertext cannot be
  moved to another patient and still decrypt. Versioned for future key rotation.
- The KEK is currently read from the environment with a production-throw guard.
  **Production key custody should move to a managed KMS/HSM** (see §6).

### 4.2 Tamper-evident, durable audit trail (real)
- `PersistentAuditLog` (`audit-log.ts`) writes a **SHA-256 hash-linked, sealed,
  persisted** entry for every data mutation across all services. The chain is
  verifiable end-to-end (`verify()`), detects edits/deletions/reordering, and
  survives restarts (cached head with rehydration).
- Exposed via `GET /api/audit` (administrator-only) with filtering + chain
  verification. Addresses HIPAA §164.312(b) audit controls and §164.312(c)(1)
  integrity at the technical-control level.

### 4.3 Real encrypted datastore for the core entities (real)
- **Health records, access grants, consent records, and marketplace listings**
  are all persisted through the encrypted layer (owner-scoped; marketplace is a
  single global catalog). Each starts **empty** and accumulates real data via
  the API — there is no seeded data in the path.
- A **real data-loss bug was found and fixed** along the way: record/grant/
  consent IDs were derived from a millisecond timestamp, so two writes in the
  same millisecond silently overwrote each other. IDs are now collision-free.

### 4.4 Role-based access control for six audiences (real)
- Six roles: `individual`, `provider`, `employer_admin`, `payer_analyst`,
  `government`, `researcher`. Every wallet defaults to `individual`.
- A **capability matrix** (`capabilities.ts`) maps roles → concrete capabilities
  (e.g. `clinical_decision_support`, `run_secure_computation`,
  `view_population_analytics`, `view_granted_records`, `manage_roles`).
- Authorization helpers: `requireRole`, `requireCapability`, `requireAdmin`.
  Administrative authority = an environment allowlist (bootstrap) **or** the
  `government` role.
- Role management API (`/api/roles`, admin-gated) and an identity endpoint
  (`/api/me`) returning the caller's roles and effective capabilities.

### 4.5 Per-audience functional surfaces (gated; data realness varies)
- **Individuals:** encrypted records/consent + GDPR rights (below).
- **Providers:** clinical decision-support routes (now **auth + provider-gated**;
  previously these were *unauthenticated*), plus `/api/provider/patients` — a
  real directory of which patients granted the provider access.
- **Researchers:** secure multiparty-computation routes, now researcher-gated.
- **Government / health plans / employers:** `/api/population/analytics` —
  **de-identified** aggregate metrics with a **k-anonymity threshold** (cohorts/
  cells below 5 are suppressed), so no statistic is traceable to a small group.

### 4.6 GDPR data-subject rights (real)
- `/api/privacy/access-request` (Art. 15) and `/api/privacy/portability`
  (Art. 20) return the subject's **actual** records, consents, and grants.
- `/api/privacy/erasure` (Art. 17) **actually** soft-deletes records and revokes
  active consents/grants. All three are authenticated and emit `DATA_EXPORT` /
  `DATA_ERASURE` entries to the durable audit log. (Previously these were mock
  acknowledgements that did nothing.)

---

## 5. Engineering quality

- **100% test coverage gate** enforced by CI (statements/branches/functions/
  lines). All new code meets it; 169 suites / 3,359 tests pass.
- **Type-safe** (TypeScript strict; `tsc --noEmit` clean) and **lint-clean**.
- Production SQL verified against a **real Postgres engine** end-to-end.
- Every commit authored under the founder's identity; clean, descriptive history
  on a single review-ready PR.

---

## 6. Honest gaps — what is NOT done

> This section is deliberately explicit so the consultant can assess risk.

**Not wired (no external integrations):**
- **Blockchain / L1:** no chain client (`ethers`/`viem`: 0 files). On-chain
  anchoring of the audit head, on-chain consent, and `txHash` values are
  placeholders.
- **TEE attestation:** not integrated. `teeVerified` / attestation fields on
  records and listings are still placeholder values, not real attestations.
- **Zero-knowledge proofs:** `/api/zkp/*` returns mock proofs (no prover wired).
- **IPFS:** no client; record `cid` values are placeholders.
- **AI / LLM:** no AI SDK; the "SANA" assistant and any inference are UI-only.

**Still synthetic / reference data (not migrated to the datastore):**
- Clinical decision-support content (differentials, drug interactions, pathways)
  is **seeded reference data** — the *authorization* is real, the *content* is
  static. Any feature that influences care is likely regulated software-as-a-
  medical-device and must not be treated as clinically validated.
- Marketplace **stats**, genomics reports, and compliance reports endpoints are
  still synthetic.

**Operational / production-hardening:**
- **Durability requires a configured database.** Without `DATABASE_URL` the
  system uses an in-memory store (data lost on restart). Postgres schema and
  adapters exist and are verified, but provisioning/migrations/backup are not
  yet operationalized.
- **Key custody:** KEK is environment-based; production should use a KMS/HSM.
- **Audit durability:** the chain is persisted and verifiable, but multi-process
  Postgres deployments need the chain head advanced under a transaction/sequence,
  and on-chain anchoring is not yet implemented.
- **MFA** is not implemented (authentication is single-factor wallet signature).
- **Rate limiting** is in-memory (per-instance), not distributed.

**Process- and time-gated (cannot be produced by code):**
- No third-party **certifications** (HIPAA attestation, SOC 2 Type II, HITRUST,
  ISO 27001). SOC 2 Type II in particular requires a multi-month observation
  window and an independent auditor.
- No **BAAs** with subprocessors, no formal risk assessment, no penetration
  test, no DPO/DPIA artifacts.
- No **clinical validation** or regulatory clearance for decision-support
  features (FDA SaMD / EU MDR considerations).

---

## 7. Compliance posture (technical controls only)

Mapped to the project's control matrix (`docs/COMPLIANCE.md`), the technical
state has advanced materially: encryption-at-rest (✅), audit integrity (✅),
durable audit log (✅, was a documented gap), authentication (✅), owner-scoped
authorization + RBAC (✅). Remaining technical items: KMS key custody, on-chain
audit anchoring, client-side encryption, distributed rate limiting, MFA. All
**administrative, legal, certification, and clinical** controls remain open and
are owned by human/process workstreams, not engineering.

The product's external security claims have also been aligned to the
implemented state ("designed for HIPAA/GDPR" rather than asserting certified
compliance).

---

## 8. Six-audience readiness snapshot

| Audience | Authorization | Functional surface | Data realness |
|---|---|---|---|
| Individuals | ✅ owner-scoped | records, consent, GDPR rights | **Real** (encrypted) |
| Providers | ✅ provider-gated | clinical DS, patient directory | Auth real; clinical *content* seeded |
| Researchers | ✅ researcher-gated | secure multiparty computation | Auth real; compute is simulated |
| Government | ✅ capability-gated | population analytics | Real aggregates over real data |
| Health plans | ✅ capability-gated | population analytics | Real aggregates over real data |
| Employers | ✅ capability-gated | population analytics | Real aggregates; admin console pending |

---

## 9. Risks & questions for the consultant

1. **Regulatory classification of clinical decision support** — is any
   provider-facing feature SaMD? This gates whether that surface can ship at all
   without clinical validation.
2. **Key custody model** — preferred KMS (cloud KMS vs. HashiCorp Vault) and
   whether client-side / end-to-end encryption is required for the threat model.
3. **Audit anchoring** — is on-chain anchoring of the audit head a genuine
   requirement (it's central to the product narrative) or is a WORM/object-lock
   sink sufficient for compliance?
4. **Population analytics privacy** — is output k-anonymity (k=5) acceptable, or
   is differential privacy / TEE-side aggregation required for payer/government
   data sharing?
5. **Certification sequencing** — recommended order and timing for HIPAA risk
   assessment, SOC 2 Type II, and a penetration test relative to pilot launch.
6. **Pilot scope** — which single audience should be hardened to true production
   first, and what is the minimum real-integration set (TEE? IPFS?) for a
   credible pilot.

---

## 10. Recommended next steps (engineering)

1. Provision Postgres + migrations + backups; make durable storage the default.
2. Move KEK custody to a managed KMS; enable key rotation.
3. Wire the first real external integration that the pilot requires (likely TEE
   attestation, retiring hardcoded `teeVerified`).
4. Add MFA and distributed rate limiting.
5. Build the employer admin console (organization/membership model).
6. Address the dependency vulnerabilities flagged on the default branch (15
   Dependabot alerts, 8 high) before any external exposure.

---

*This report reflects the state of PR #9 as of 2026-06-24. Figures (test counts,
file counts, line counts) are taken directly from the repository and CI.*
