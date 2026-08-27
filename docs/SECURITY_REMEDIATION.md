# Shiora — Security & Production-Readiness Remediation Tracker

**Created:** 2026-06-24
**Source:** External consultant assessment of the Engineering Progress Report.
**Branch:** `feat/backbone-phi-encryption-audit` (PR #9).

This tracker maps every item from the consultant's assessment to a concrete
status. Legend:

- ✅ **Done** — addressed in code this work stream (tested, green, pushed).
- 🔧 **Code-next** — engineering-buildable; scoped for an upcoming code pass.
- 🏗️ **Infra** — requires provisioning / cloud resources (engineering + ops).
- 📋 **Process** — human/legal/audit workstream; cannot be produced by code.

---

## Critical gaps (production blockers)

| Item                                        | Status           | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Provision Postgres + migrations + backups   | 🔧/🏗️            | **Migration runner built** (`migrator.ts`, version-tracked, verified against a real Postgres engine). Provisioning, connection config (`DATABASE_URL`), and backup/PITR are infra tasks. Adapters + schema already exist and are verified.                                                                                                                                                                                                                                                                                                                                                             |
| Move KEK to a managed KMS/HSM               | 🔧/🏗️            | Envelope encryption already isolates key access behind a single accessor with a production-throw guard. Next code step: extract a `KeyProvider` seam (env vs. KMS) + versioned key rotation. KMS provisioning is infra.                                                                                                                                                                                                                                                                                                                                                                                |
| Audit-chain concurrency hardening           | 🔧               | Current chain is correct single-process. Next code step: advance the Postgres head under a transaction / advisory lock (requires adding a transactional primitive to the persistence port).                                                                                                                                                                                                                                                                                                                                                                                                            |
| **Fix Dependabot vulnerabilities (8 high)** | ⚠️ **Re-scoped** | **Investigated and corrected:** all flagged packages are **dev/build tooling, not production runtime** — `ws` is from `jest-environment-jsdom`→`jsdom` (test only), `js-yaml` from `eslint` (dev), `postcss` is build-time. None ship in the deployed PHI runtime. The 2 "high" `ws` advisories are test-tooling. `npm audit fix` **breaks the jsdom test environment** (it bumps `ws` in a way `jsdom` can't use), so these need a **coordinated, tested toolchain upgrade** (jest/jsdom/eslint/next minor bumps), not a blind fix. Production runtime deps (`next`, `react`, `pg`, `zod`) are clean. |
| Add MFA                                     | ✅ **Done**      | **TOTP (RFC 6238) implemented** — `totp.ts` + `mfa-service.ts` + `/api/mfa`, `/api/mfa/enroll`, `/api/mfa/verify`. Secret sealed at rest, audited, authenticator-app compatible. Step-up enforcement on sensitive actions is the remaining wiring.                                                                                                                                                                                                                                                                                                                                                     |
| Distributed rate limiting                   | 🔧               | Current limiter is in-memory/per-instance. Next code step: a store-backed async limiter; note this requires making the (currently synchronous) middleware chain async — a deliberate, wide refactor.                                                                                                                                                                                                                                                                                                                                                                                                   |
| HIPAA Risk Assessment                       | 📋               | Security lead. Prerequisite to BAA signing / covered-entity pilots.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| BAAs with subprocessors                     | 📋               | Legal. Required before PHI flows to hosting/KMS/etc.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Penetration test                            | 📋/🏗️            | Third-party firm; schedule after the infra items above land.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |

## Important gaps (before scaling)

| Item                            | Status | Notes                                                                                                                                                                                  |
| ------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| On-chain audit anchoring        | 🔧/🏗️  | Hash chain + durable persistence done. Anchoring the head on the Aethelred L1 needs a chain client (none present) — greenfield integration.                                            |
| TEE attestation wiring          | 🔧/🏗️  | `teeVerified` placeholders remain — intentionally **not** faked. Needs the real `aethelred-tee-worker` integration.                                                                    |
| Clinical DS SaMD classification | 📋     | Regulatory counsel. Provider clinical routes are now **auth + capability gated**, but content remains non-validated reference data.                                                    |
| GDPR DPO + DPIA                 | 📋     | Legal (GDPR Art. 35) for health-data processing at scale.                                                                                                                              |
| k-anonymity review (k=5)        | 📋/🔧  | Population analytics implemented with k=5 suppression. A privacy engineer should confirm whether differential privacy / TEE-side aggregation is required for payer/government sharing. |

## Build fresh (not started)

| Item                                    | Status      | Notes                                                                                    |
| --------------------------------------- | ----------- | ---------------------------------------------------------------------------------------- |
| Employer admin console (org/membership) | 🔧          | New entity, fits the existing encrypted-document pattern.                                |
| SANA health assistant backend           | 🔧/🏗️/📋    | Needs a managed inference integration + safety guardrails + likely SaMD review.          |
| ZKP prover (real circuits)              | 🔧/🏗️       | `/api/zkp/*` returns mock proofs; needs a real prover (Groth16/PLONK).                   |
| IPFS storage client                     | 🔧/🏗️       | `cid` placeholders; needs a content-addressed storage client + node.                     |
| Blockchain / L1 integration             | 🔧/🏗️       | No chain client; needed for on-chain consent, audit anchoring, consent NFTs.             |
| Migration system                        | ✅ **Done** | `migrator.ts` (version-tracked, idempotent, Postgres-verified).                          |
| Secrets rotation pipeline               | 🔧/🏗️       | Depends on the KMS/`KeyProvider` step above.                                             |
| Observability stack                     | 🏗️          | Structured audit/request logging exists; metrics/alerting (Prometheus/Datadog) is infra. |
| Disaster recovery + backup validation   | 🏗️/📋       | Backup strategy for encrypted Postgres must be documented + tested.                      |
| SOC 2 Type II readiness                 | 📋          | ~6-month observation window; start early.                                                |
| Clinical validation framework           | 📋          | Required before any decision-support route ships to providers in production.             |
| HITRUST / ISO 27001                     | 📋          | Market-dependent; required by enterprise health-system customers.                        |

---

## Done this work stream (code, tested, pushed)

- **MFA (TOTP, RFC 6238)** — `f15cee1`.
- **Versioned database migration runner** — `14774c6` (verified vs. real Postgres).
- **`KeyProvider` seam + versioned key rotation** — prepares KMS cutover; the
  envelope cipher resolves the data key by version, so historical material
  still decrypts after rotation.
- **Audit-chain persisted head + optimistic-concurrency append** — `PgAuditStore`
  (seq primary key, 23505 retry), verified vs. real Postgres.
- **Employer admin console** — organization + membership entities on the existing
  encrypted-document pattern; owner-scoped, capability-gated routes (`b20ac46`).
- **Distributed rate limiter + async middleware** — `bec1522`. `RateLimiter` port
  with in-memory and Postgres adapters selected by `DATABASE_URL`; the Postgres
  adapter increments a per-`(key, window_start)` counter with an atomic
  `INSERT ... ON CONFLICT DO UPDATE`, so the limit holds across instances.
  SQL verified end-to-end (incl. a 50-way concurrent burst with no collisions).
- **Application dev-toolchain CVE upgrade** — cleared the application dependency alerts
  (`npm audit`: 0 vulnerabilities). The flagged CVEs were dev/build tooling; the naive
  `npm audit fix` regresses the test env by skewing the jest sub-package
  versions against `jest-environment-jsdom`. The coordinated fix aligns the
  whole jest stack at 30.4.x and pins transitive residuals via `overrides`
  (`next` 15.5.19, `postcss` 8.5.15, `ws` 8.21.0, `@babel/core` 7.29.7,
  `js-yaml` 4.2.0, scoped `brace-expansion` 5.0.6). `next build` + the full
  test suite both pass. The separately isolated contract-development toolchain retains upstream
  advisories; its production dependency tree is clean and no development package ships with the
  application or contract runtime.

All landed at the repository's 100% coverage gate; lint + type-check clean.

## Recommended immediate next code pass

1. KMS-backed `KeyProvider` adapter (AWS KMS / GCP KMS) behind the existing seam.
2. SANA health assistant backend (managed inference integration + safety guardrails; likely SaMD review).
3. Real ZKP prover for `/api/zkp/*` (Groth16/PLONK) replacing mock proofs.
4. IPFS content-addressed storage client (replace `cid` placeholders).
5. Blockchain/L1 client for on-chain consent + audit anchoring.

The consultant's overall sequencing (infra + KMS in weeks 1–4, compliance
process in months 2+, integrations in month 5+) is endorsed; the engineering
items above are the parts that do not depend on external provisioning or
human/legal workstreams and can proceed in parallel.
