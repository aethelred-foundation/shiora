# Shiora — HIPAA Security Risk Assessment

> **Status: internal risk analysis (self-assessment), testnet-preview.**
> This is Shiora's own §164.308(a)(1)(ii)(A) risk analysis. It is a required
> input to a HIPAA risk-management program; it is **not** a HIPAA certification
> (no such thing exists) nor an external audit. It records the *actual*
> safeguards in the codebase today and the residual risk that remains before
> production handling of Protected Health Information (PHI).

- **Methodology:** NIST SP 800-30 Rev. 1 (Guide for Conducting Risk Assessments).
- **Scope:** the Shiora application (`github.com/aethelred-foundation/shiora`),
  its API, datastore, and the cryptographic and access controls in
  `src/lib/`. Out of scope: the Aethelred L1 node/chain (assessed separately),
  cloud-provider physical security (inherited from the hosting provider, covered
  by that provider's BAA — see [BUSINESS_ASSOCIATE_AGREEMENTS.md](BUSINESS_ASSOCIATE_AGREEMENTS.md)).
- **Assessment date:** 2026-06-28. **Owner:** Ramesh Tamilselvan.
- **Review cadence:** at least annually, and on any material change to controls,
  vendors, or PHI flows (§164.308(a)(1)(ii)(B) ongoing risk management).

---

## 1. ePHI inventory and data flows

PHI is **sealed at rest** before it ever reaches storage. The application holds
ciphertext; plaintext exists only transiently in process memory during a
request. Datastore selection enforces this in production:
`src/lib/persistence/datastore-mode.ts` **throws** if `DATABASE_URL` is unset in
production, because the in-memory store "is not durable and must never hold PHI."

| Data category | Contains PHI? | At-rest protection | Source |
|---|---|---|---|
| Health records (label, description, tags, file CID) | Yes | AES-256-GCM envelope, AAD-bound | `encrypted-records.ts` |
| Clinical notes + amendments | Yes | AES-256-GCM envelope, AAD-bound | `encrypted-documents.ts` (`clinical-notes-service.ts`) |
| Cycle / symptom vault | Yes | AES-256-GCM envelope | `vault-service.ts` |
| Consent grants, access grants | Yes (identifiers, scopes) | AES-256-GCM envelope | `consent-service.ts`, `access-service.ts` |
| Account profile (contact email, name) | Yes (PII) | AES-256-GCM envelope | `profile-service.ts` |
| SANA assistant conversations | Yes (health questions) | AES-256-GCM envelope | `sana/sana-service.ts` |
| Uploaded files (IPFS) | Yes | **Encrypt-then-address**: content sealed before a CID is computed, so the CID addresses ciphertext | `ipfs/ipfs-service.ts` |
| Notifications | Limited (titles/bodies) | AES-256-GCM envelope | `notification-service.ts` |
| Audit chain | Metadata, not PHI | Plaintext jsonb; integrity via hash chain; confidentiality via DB encryption | `audit-log.ts`, `pg-audit-store.ts` |
| ZK proofs | **No** — commitments hide the value; inputs never stored | n/a (zero-knowledge by construction) | `zkp-service.ts` |
| MPC results | **No** — only the aggregate is stored; contributions never persisted | n/a | `mpc-service.ts` |
| Population analytics | De-identified, k-anonymity (min cohort 5) | suppression at source | `population-analytics.ts` |

**Data subjects:** individuals (patients). **Recipients under controls:**
providers (via time-bounded access grants), researchers/governments (via
consented data-access requests and de-identified analytics), employers/payers
(de-identified cohorts only).

---

## 2. Safeguards in place (control inventory)

### Technical safeguards (§164.312)

| Safeguard | Implementation (real code) |
|---|---|
| Encryption at rest (a)(2)(iv), (e)(2)(ii) | `src/lib/crypto/envelope.ts` — AES-256-GCM, per-record DEK wrapped by a KEK, AAD context binding, GCM tamper detection |
| Key management / rotation | `src/lib/crypto/key-provider.ts` — `KeyProvider` seam, versioned rotation (sealed data records its KEK version; historical keys retained for decrypt) |
| Authentication (d) | `src/lib/api/wallet-verify.ts` — secp256k1 ECDSA + bech32; `src/lib/api/session.ts` — HMAC-SHA256 signed `__Host-` cookies, timing-safe compare |
| MFA | `src/lib/api/totp.ts` (RFC 6238) + `mfa-service.ts` — secret sealed at rest, audited |
| Access control / authorization (a)(1) | `src/lib/api/rbac.ts` + `capabilities.ts` + `roles.ts` + `roles-service.ts` — 6-role capability matrix (individual/provider/employer_admin/payer_analyst/government/researcher); all data owner-scoped; provider record access requires an **active, unexpired** grant (`view_granted_records`) |
| Automatic logoff (a)(2)(iii) | Session TTL enforced in `verifySessionToken` |
| Audit controls (b) | `src/lib/api/audit-log.ts` — durable, owner-/subject-scoped audit trail over a tamper-evident store |
| Audit integrity (c)(1) | `src/lib/crypto/audit-chain.ts` — SHA-256 hash-linked append-only chain; `verifyAuditChain` detects edit/delete/reorder. Concurrency-safe multi-process append: `pg-audit-store.ts` (seq PRIMARY KEY, insert-and-retry) |
| Integrity of PHI (c)(1) | GCM auth tags + audit-chain hashing |
| Transmission / rate limiting (e)(1) | `src/lib/api/middleware.ts` (CORS, rate limit) + distributed limiter `pg-rate-limiter.ts` (atomic windowed counter) |

### Administrative & organizational safeguards (§164.308, §164.314)

| Safeguard | Status |
|---|---|
| Risk analysis (a)(1)(ii)(A) | **This document.** |
| Information-access management (a)(4) | RBAC capability matrix; least-privilege per audience role (code). Formal access-authorization *procedure* — 📋 process, to be documented. |
| Audit / disclosure accounting (§164.528) | Subject-side disclosure log (`/api/me/access-log`) records who accessed a patient's data; GDPR Art. 15 disclosure view. |
| Data-subject rights (export/erasure) | `src/lib/api/privacy.ts` — real Art. 15/20 export (JSON/CSV/XML) and Art. 17 erasure across every store. |
| Workforce training, sanction policy, contingency plan, BAAs | 📋 **Process** — organizational, not code. BAA template provided; the rest must be authored and operated by the organization. |

### Physical safeguards (§164.310)
Inherited from the hosting provider under its BAA. Shiora adds no on-premise PHI
storage; the in-memory store is barred from production PHI by code.

---

## 3. Risk register

Risk = Likelihood × Impact, per NIST 800-30. Likelihood and Impact ∈
{Low, Moderate, High}. Risks are the *residual* exposure **after** the controls
above, ordered by current risk level.

| ID | Threat / vulnerability pair | Likelihood | Impact | Risk | Existing control | Residual risk & remediation |
|---|---|---|---|---|---|---|
| R-1 | KEK compromise via env-backed key (no KMS/HSM in default config) | Moderate | High | **High** | Versioned `KeyProvider` seam, rotation | **Gap:** ship a KMS/HSM-backed `KeyProvider` (AWS/GCP KMS / Vault Transit) and remove the env-key path in production. Until then, treat the env KEK as the top residual risk. |
| R-2 | Audit-chain head rewrite by a single privileged operator | Low | High | **Moderate** | Hash chain + concurrency-safe Pg store + `verifyAuditChain` | **Gap:** mirror the chain to a WORM/object-lock sink and anchor the head hash on the Aethelred L1. |
| R-3 | Over-broad disclosure claim ("encrypted before leaving the browser") not matching implementation | Moderate | Moderate | **Moderate** | Server-side envelope encryption is real | **Gap:** either implement client-side (browser) sealing or correct the marketing/SECURITY claim. Honesty boundary — see maturity registry. |
| R-4 | PHI in transit without enforced TLS floor / HSTS | Low | High | **Moderate** | TLS at edge | **Gap:** enforce TLS 1.2+ ciphers, enable HSTS + preload, mTLS service-to-service. |
| R-5 | MFA not enforced as step-up on sensitive actions | Moderate | Moderate | **Moderate** | TOTP enrol/verify primitives exist | **Gap:** require step-up MFA on high-sensitivity actions (e.g. granting access, bulk export). |
| R-6 | Dependency / supply-chain vulnerability | Moderate | Moderate | **Moderate** | `npm audit` at 0 vulns; minimal-dependency posture (crypto built on `node:crypto`, no SNARK/curve libs added) | **Gap:** SBOM generation, automated dependency scanning in CI, pinned lockfile review. |
| R-7 | Insider misuse of granted access (a provider reads beyond need) | Low | Moderate | **Low** | Grant-gated, time-bounded, audited reads; subject-side disclosure log | Accepted with monitoring; consider anomaly alerts on access patterns. |
| R-8 | Re-identification of "de-identified" analytics | Low | Moderate | **Low** | k-anonymity suppression (min cohort 5) | Accepted; document the de-identification method for §164.514 expert-determination if expanded. |
| R-9 | Single coordinator in MPC could reconstruct an input | Low | Moderate | **Low** | Only the aggregate is stored; protocol is sound | Honestly scoped: true input privacy needs non-colluding parties. Treat single-server MPC as "aggregate-only retention," not unconditional input privacy. |

**Top residual risks to close before production PHI:** R-1 (KMS), R-4 (TLS
enforcement), R-3 (claim accuracy). R-2 composes with the planned L1 anchoring.

---

## 4. Remediation plan (risk treatment)

| Priority | Action | Closes |
|---|---|---|
| P0 | KMS/HSM-backed `KeyProvider`; remove env-key path in prod | R-1 |
| P0 | Enforce TLS 1.2+ / HSTS + preload at edge | R-4 |
| P0 | Reconcile the "client-side encryption" claim with reality | R-3 |
| P1 | Anchor audit-chain head on L1 + WORM mirror | R-2 |
| P1 | Step-up MFA on sensitive actions | R-5 |
| P1 | SBOM + dependency scanning in CI | R-6 |
| P2 | Access-pattern anomaly alerting | R-7 |
| P2 | Document de-identification method (§164.514) | R-8 |

This plan is the bridge to a defensible production posture and is the input an
external assessor (or the M42 pilot's security review) would track to closure.

---

*See [SOC2_READINESS.md](SOC2_READINESS.md) for the Trust Services Criteria
mapping of the same controls, and [`docs/COMPLIANCE.md`](../COMPLIANCE.md) for the
per-control gap tracker.*
