# Shiora — Production Readiness Tracker

**Audience:** MBZUAI Incubation & Entrepreneurship Center (IEC) and the incubated venture team.
**Purpose:** a single, honest status sheet against the production-readiness checklist for a
PHI-handling health platform, tuned to MBZUAI-level scrutiny.
**Scope decision:** all six audiences (individuals, providers, employers, governments,
health plans, researchers) are in scope for the production deployment. Capabilities that are
not yet backed by their named external system are labelled **simulated** and are never
presented as verified results (see `GET /api/system/status`).

Last updated: 2026-06-24.

---

## Status legend

| Symbol | Meaning |
|---|---|
| ✅ | Done in the codebase, tested, on the branch. |
| 🔧 | Engineering in progress / partially done. |
| ⛔ | **External-gated** — needs infrastructure provisioning or a third party (cloud/KMS/WAF/etc.). Not a code task. |
| 📋 | **Process / legal-owned** — founder, legal, or operations workstream (HIPAA RA, BAAs, SOC 2, pen test, …). |
| 🗺️ | **Roadmap integration** — real external system (TEE / ZK / MPC / chain / IPFS / LLM) to replace a simulated subsystem. |

**Owner** column: Eng (engineering), Infra (DevOps/SRE), Sec (security), Legal, Founder, IEC (venture team).

---

## Executive summary

The platform's **real, PHI-bearing core is production-grade**: AES-256-GCM envelope-encrypted
records, a tamper-evident hash-chained audit log, six-audience RBAC with a capability matrix,
GDPR data-subject rights, k-anonymised population analytics, MFA, a Postgres-backed distributed
rate limiter, versioned migrations, and a production preflight that refuses to serve PHI from a
non-durable store. The test suite holds a **100% coverage gate** (186 suites / 3,471 tests) and
the branch carries **zero dependency vulnerabilities**.

The remaining work is concentrated in three places, none of which is core application logic:

1. **Infrastructure provisioning (⛔)** — managed Postgres HA, KMS/HSM, backups + restore drills,
   WAF/DDoS, centralized logging, monitoring/alerting, CI/CD. These are deployment-environment
   tasks for the venture's chosen cloud.
2. **Compliance & legal process (📋)** — HIPAA risk assessment, BAAs/DPA, DPIA, SaMD opinion,
   SOC 2 readiness, external penetration test. These are time- and auditor-gated and cannot be
   produced by code.
3. **Roadmap integrations (🗺️)** — real TEE, ZK prover, MPC engine, L1 chain client, IPFS, and
   LLM backend. Until each is wired, its surface is **simulated and labelled as such**.

---

## 1. Scope & deployment model

| Item | Status | Owner | Notes |
|---|---|---|---|
| Initial production scope defined | ✅ | Founder | All six audiences in scope; per-capability maturity is published at `/api/system/status`. |
| Pilot-only routes identified | ✅ | Eng | Simulated/pilot capabilities tagged in the maturity registry (`src/lib/api/maturity.ts`). |
| Frozen production baseline / release tag | 🔧 | Eng | Tag `v1.0.0-mbzuai` to be cut from the reviewed branch at hand-off. |
| Feature flags for post-baseline changes | 🔧 | Eng | Maturity registry is the flagging substrate; a runtime flag service is a small add. |
| `dev` / `staging` / `production` separation | ⛔ | Infra | Environment topology is a deployment decision for the venture's cloud. |
| No PHI in `dev`; synthetic data in `staging` | ⛔ | Infra | Enforced operationally; the app already starts empty (no seeded PHI). |

## 2. Infrastructure & data durability

| Item | Status | Owner | Notes |
|---|---|---|---|
| Postgres adapter (production datastore) | ✅ | Eng | All stores have a Postgres adapter, verified end-to-end against a real engine. |
| **No in-memory PHI in production** | ✅ | Eng | `shouldUsePostgres()` throws in production when `DATABASE_URL` is unset. |
| Managed Postgres cluster (multi-AZ, failover, RPO/RTO) | ⛔ | Infra | Provision a managed HA Postgres; document RPO/RTO. |
| Automated migrations + tested rollback | ✅/⛔ | Eng/Infra | Versioned, idempotent migration runner exists; rollback rehearsal is an ops drill. |
| Daily backups + retention policy | ⛔ | Infra | Configure managed backups; set retention per the data-retention policy. |
| Quarterly restore test | ⛔ | Infra | Schedule and document restore drills. |
| Capacity planning / autoscaling | ⛔ | Infra | Define expected QPS and an HPA policy. |
| Liveness / readiness health checks | ✅ | Eng | `GET /api/health/live` and `GET /api/health/ready` (preflight + datastore round-trip). |
| Externalized config + secrets store | 🔧/⛔ | Eng/Infra | Config is env-driven and validated; wire a secrets manager (Vault / cloud SM). |

## 3. Encryption, keys & crypto hygiene

| Item | Status | Owner | Notes |
|---|---|---|---|
| AES-256-GCM envelope encryption for all PHI | ✅ | Eng | Per-record DEKs wrapped by a KEK; no PHI reaches storage in plaintext. |
| AAD binding (`owner:recordId`) | ✅ | Eng | Bound and covered by adversarial tests. |
| KeyProvider seam + versioned rotation | ✅ | Eng | Records decrypt by key version after rotation. |
| **KEK in KMS/HSM (not env)** | 🗺️/⛔ | Eng/Infra | The KeyProvider seam is built; a KMS adapter (AWS/GCP KMS) is the drop-in. |
| Key-rotation + compromise procedures | 🔧 | Sec | Mechanism done; runbook for emergency rotation to be documented. |
| TLS 1.2+ for all external endpoints | ⛔ | Infra | Terminate TLS at the load balancer / ingress. |
| TLS for service-to-service + DB | ⛔ | Infra | Enforce `sslmode=require` on the DB connection and mTLS internally. |
| No IV/nonce reuse under a key | ✅ | Eng | Random 96-bit nonce per seal. |
| Approved algorithms only | ✅ | Eng | Node `crypto` AES-256-GCM / SHA-256 / HMAC; no home-grown primitives. |

## 4. Authentication, authorization & identity

| Item | Status | Owner | Notes |
|---|---|---|---|
| Wallet-signature auth (secp256k1) | ✅ | Eng | Real ECDSA + bech32 verification with a fixed message format. |
| Signed sessions, secure cookies | ✅ | Eng | HMAC-SHA256 `__Host-` cookies (`HttpOnly`, `Secure`, `SameSite`). |
| Insecure wallet-header bypass off in prod | ✅ | Eng | Enforced by env + flagged by the production preflight. |
| MFA (TOTP) | ✅ | Eng | RFC 6238; enrolment + verification with encrypted secret storage. |
| MFA mandatory for admins / cross-PHI access | 🔧 | Eng | TOTP exists; step-up enforcement policy to be wired on sensitive routes. |
| Login throttling / lockout | ✅ | Eng | Distributed rate limiter; per-fingerprint windows. |
| Session idle + absolute expiration | ✅/🔧 | Eng | Absolute TTL enforced; idle-timeout policy to be added. |
| RBAC + capability matrix, single source of truth | ✅ | Eng | Six roles; matrix in code, unit-tested. |
| `requireRole` / `requireCapability` on every PHI/analytics route | ✅ | Eng | Enforced; audience gating covered by tests. |
| Admin allowlist configurable + audited | ✅ | Eng | Allowlist via env; role/admin actions audited. |

## 5. API surface, routing & false-claims removal

| Item | Status | Owner | Notes |
|---|---|---|---|
| Route inventory by audience/capability | ✅ | Eng | Published machine-readably at `GET /api/system/status`. |
| Routes tagged production / pilot / simulated | ✅ | Eng | Feature-maturity registry (`src/lib/api/maturity.ts`). |
| Hard-coded `teeVerified`/feature claims removed | ✅ | Eng | `/api/health` reports an honest capability summary, not fixed `true`s. |
| Simulated outputs explicitly labelled | ✅ | Eng | TEE/ZK/MPC/IPFS/chain responses carry `meta.mode = 'simulation'`. |
| Clinical/DS content marked non-clinical, non-SaMD | ✅ | Eng | Registered as simulated with a non-SaMD note. |
| Consistent error envelope; no stack-trace leakage | ✅ | Eng | Standard error envelope; user-safe messages; correct HTTP codes. |
| Distributed rate limiting | ✅ | Eng | Postgres atomic counters; cross-instance. |
| WAF / DDoS protection | ⛔ | Infra | Front public endpoints with a WAF/CDN. |

## 6. Audit trail, logging & privacy controls

| Item | Status | Owner | Notes |
|---|---|---|---|
| Persistent tamper-evident audit log | ✅ | Eng | SHA-256 hash-chained; admin query + chain verification. |
| Concurrency-safe append (multi-process) | ✅ | Eng | Postgres `seq` primary key + optimistic-retry; verified against a real engine. |
| Audit retention in WORM/object-lock sink | ⛔ | Infra | Export the chain to an object-lock bucket per retention policy. |
| Structured, centralized logs | ⛔ | Infra | Ship to ELK/Loki/cloud logging; restrict + audit log access. |
| No PHI in plaintext logs | ✅ | Eng | Request logging is metadata-only; PHI is never logged. |
| GDPR rights end-to-end (access/portability/erasure) | ✅ | Eng | Operate over real stored data; audited. |
| Soft-delete semantics documented | ✅ | Eng | Erasure soft-deletes records and revokes active consents/grants. |
| Per-entity retention + archival schedules | 🔧/📋 | Eng/Legal | Retention policy to be set; archival jobs then implemented. |

## 7. Security hardening & vulnerability management

| Item | Status | Owner | Notes |
|---|---|---|---|
| Lint + type-check + tests in CI | ✅/⛔ | Eng/Infra | Gates exist and pass locally; wire them into the venture's CI. |
| Dependency scanning; criticals fixed or risk-accepted | ✅ | Sec | `npm audit`: **0 vulnerabilities** on the branch. |
| Security headers (CSP, XFO, etc.) | ✅ | Eng | Set in `next.config.js`; HSTS behind a flag for production. |
| Least-privilege IAM; no `*:*` | ⛔ | Infra | Scope IAM at deployment. |
| Network segmentation / security groups | ⛔ | Infra | Restrict DB + internal services to known subnets. |
| Incident-response runbook | 🔧/📋 | Sec/Founder | Draft to be produced; on-call + escalation are ops. |
| External penetration test | 📋 | Founder | Engage a third party; triage + retest. |
| Endpoint security for admin workstations | 📋 | Founder | Device policy for people with production access. |

## 8. Compliance, regulatory & legal

| Item | Status | Owner | Notes |
|---|---|---|---|
| HIPAA technical safeguards (access/audit/integrity/transmission) | ✅ (technical) | Eng | Implemented in code; mapped in `docs/COMPLIANCE.md`. Certification is separate. |
| HIPAA risk assessment | 📋 | Founder/Legal | Formal RA required; time-gated. |
| GDPR lawful basis documented | 📋 | Legal | Document consent/legitimate-interest basis. |
| DPO appointment | 📋 | Founder | Appoint or contract a DPO. |
| DPIA for women's-health PHI | 📋 | Legal | Required given sensitive-category data. |
| SaMD / clinical classification opinion | 📋 | Legal/Founder | Provider-facing DS is simulated + non-SaMD-flagged today; obtain a formal opinion before any clinical claim. |
| SOC 2 scoping + readiness | 📋 | Founder | ~6-month observation window; start early. |
| BAAs / DPA with PHI-touching vendors | 📋 | Legal | Cloud, DB, KMS, logging vendors. |
| ToS + Privacy Policy aligned to data flows | 📋 | Legal | Align to the actual (audited) data flows. |

## 9. Integrations & external dependencies

| Item | Status | Owner | Notes |
|---|---|---|---|
| TEE attestation | 🗺️ | Eng | Simulated and labelled; wire a real SGX/TDX/Nitro attestation flow when available. |
| Blockchain / L1 anchoring | 🗺️ | Eng | Simulated; network status, tx hashes, governance/staking/rewards are not on-chain. |
| ZKP / MPC | 🗺️ | Eng | Simulated; wire a real prover (Groth16/PLONK) / MPC engine before any verified claim. |
| IPFS / object storage | 🗺️ | Eng | Simulated CIDs; wire IPFS or S3/GCS with object-lock for documents. |
| AI/LLM (SANA) | 🗺️ | Eng | Simulated; on enablement: no autonomous diagnosis, prompt/response logging, de-identified inputs, safety filters. |

## 10. Observability, SLOs & operations

| Item | Status | Owner | Notes |
|---|---|---|---|
| Metrics (latency/error/throughput) | ⛔ | Infra | Instrument and export to Prometheus/Datadog. |
| SLIs/SLOs defined | 📋/⛔ | Founder/Infra | e.g., 99.9% API success, <300 ms median. |
| Dashboards (system + business) | ⛔ | Infra | Build once metrics flow. |
| Alerting + on-call routing | ⛔ | Infra | PagerDuty/Slack routing for critical conditions. |
| Operational runbooks | 🔧/📋 | Sec/Infra | Drafts to be produced (API outage, DB issues, KMS, breach). |
| CI/CD with tests + security scans | ⛔ | Infra | Build the pipeline; tests + audit already pass locally. |
| Blue-green / canary + tested rollback | ⛔ | Infra | Deployment strategy for the chosen platform. |

## 11. Documentation & knowledge transfer

| Item | Status | Owner | Notes |
|---|---|---|---|
| Architecture + data-flow overview | ✅ | Eng | `docs/ARCHITECTURE.md` + `docs/MBZUAI_PROPOSAL.md` (architecture & risk section). |
| API documentation | 🔧 | Eng | `docs/API.md` exists; an OpenAPI spec is a worthwhile add. |
| Security & compliance docs | ✅ | Eng | `docs/COMPLIANCE.md`, `docs/SECURITY.md`, `docs/SECURITY_REMEDIATION.md`. |
| SOPs (deploy / config / access) | 📋 | Infra/Founder | To be produced with the deployment. |
| Written InfoSec policy + risk register | 📋 | Founder/Legal | Required for SOC 2 / enterprise customers. |
| Training records for production access | 📋 | Founder | Track per person with production access. |

## 12. MBZUAI partnership readiness

| Item | Status | Owner | Notes |
|---|---|---|---|
| Platform boundary (Shiora vs IEC venture) | ✅ | Founder | Stated in `docs/MBZUAI_PROPOSAL.md`. |
| Licensing & IP terms | 📋 | Founder/IEC | Flagged as open items to negotiate. |
| Operational split (who runs production) | 📋 | Founder/IEC | Flagged as an open item. |
| Deliverables to IEC | ✅ | Eng/Founder | This tracker, the proposal, and the architecture/risk overview. |
| Integration roadmap with realistic timelines | ✅ | Eng | In the proposal. |

---

### How to read this against a live system

The same information this tracker summarises for humans is available to machines at
`GET /api/system/status` (public, non-PHI): the maturity of every capability and the live
production-readiness preflight. That endpoint is the contract — if a capability says
`simulated` there, its API responses also carry `meta.mode = 'simulation'`.
