# Shiora — Penetration Test Plan & Pre-Test Self-Assessment

> **Status: scope + rules of engagement + internal self-assessment.** This
> document defines the scope for an **independent external penetration test** and
> records Shiora's own pre-test review. A self-assessment is **not** a substitute
> for independent testing — findings here labeled "self-identified" must still be
> validated (and supplemented) by qualified external testers before any
> production / public-testnet launch.

- **Objective:** validate the confidentiality, integrity, and availability of
  PHI and the correctness of the access-control, audit, and crypto subsystems
  under adversarial conditions.
- **Standards:** OWASP ASVS 4.0 (Level 2, given PHI), OWASP Top 10 (2021),
  OWASP API Security Top 10 (2023), and PTES for engagement structure.

---

## 1. Scope

### In scope
- The Shiora API surface (`src/app/api/**`) — authentication, session, RBAC,
  records/consent/access/clinical-notes/vault, GDPR endpoints, ZKP, MPC, IPFS,
  SANA.
- AuthN/AuthZ: wallet signature verification, session cookies, the 6-role
  capability matrix, grant-gated provider access.
- Crypto boundaries: envelope encryption, audit-chain integrity, the ZK prover,
  the MPC aggregation, CIDv1 content addressing (integrity).
- Multi-tenant isolation: that one owner cannot read/modify another owner's
  records, notes, vault, profile, conversations, proofs, or objects.

### Out of scope (unless separately authorized)
- The Aethelred L1 node/chain consensus (separate engagement).
- The hosting provider's infrastructure (covered by its own attestations/BAA).
- Physical and social-engineering vectors (unless explicitly added to the RoE).
- Denial-of-service / volumetric attacks against shared infrastructure.

---

## 2. Rules of engagement (template — complete at engagement time)

| Item | Value |
|---|---|
| Authorized testing window | `[start] – [end]` |
| Target environment | A dedicated **staging** instance with synthetic PHI — never production patient data |
| Test accounts | One per role: individual, provider, employer_admin, payer_analyst, government, researcher |
| Permitted techniques | Authenticated + unauthenticated testing, fuzzing, authz bypass attempts, crypto misuse analysis |
| Prohibited | Destructive actions on shared infra; exfiltration of real PHI; DoS against shared services |
| Escalation contact | `[security contact]` |
| Data handling | Findings + any captured data encrypted in transit and at rest; destroyed after report acceptance |
| Re-test | One round of re-test included after remediation |

---

## 3. Threat model (assets → adversaries → attack surface)

| Asset | Adversary | Primary attack surface |
|---|---|---|
| Patient PHI | External attacker, malicious tenant | API authz, multi-tenant isolation, injection |
| Audit trail integrity | Privileged insider | Audit-chain tamper, log forgery |
| Cryptographic secrets (KEK, session HMAC) | External + insider | Key handling (R-1), session forgery |
| Access-control decisions | Malicious provider/researcher | Grant bypass, capability escalation, IDOR |
| Availability | External attacker | Rate-limit bypass, resource exhaustion |

---

## 4. Test cases (mapped to standards)

| # | Test | Standard | Pre-test self-assessment |
|---|---|---|---|
| T-1 | Broken object-level authz (IDOR): read another owner's record/note/vault/profile/proof/object by ID | API1:2023 | **Self-identified OK** — every service is owner-scoped (`ownerKey` keyed); provider record access additionally requires an active, unexpired grant. *External validation required.* |
| T-2 | Broken function-level authz: a non-researcher hits `/api/mpc/*`; a non-provider hits provider routes | API5:2023 | **Self-identified OK** — `requireCapability` gates; route tests assert 403 for wrong role. |
| T-3 | Session forgery / fixation: forge or replay the session cookie | A07:2021 | **Self-identified OK** — HMAC-SHA256 signed `__Host-` cookie, timing-safe compare, TTL. |
| T-4 | Injection (SQL / NoSQL / template) | A03:2021 | **Self-identified OK** — parameterized SQL only; zod-validated inputs at every route. *Validate.* |
| T-5 | Audit-chain tamper: edit/delete/reorder an entry and pass verification | §164.312(c)(1) | **Self-identified OK** — `verifyAuditChain` detects all three; concurrency-safe append. |
| T-6 | Crypto misuse: AAD confusion, nonce reuse, downgrade, padding | ASVS V6 | **Self-identified OK** — AES-256-GCM with per-record AAD; CID/ZK/MPC built on `node:crypto`. *Independent crypto review recommended.* |
| T-7 | ZK soundness: forge a proof for a value not in the set | — | **Self-identified OK** — tests prove it refuses non-membership and rejects tampered/wrong-context/wrong-set proofs. *Independent review of the CDS construction recommended.* |
| T-8 | MPC privacy: recover an individual contribution from stored data | — | **Self-identified OK** — only the aggregate is persisted; honest single-coordinator caveat documented (R-9). |
| T-9 | IPFS integrity: substitute content for a CID without detection | — | **Self-identified OK** — resolution re-derives the CID and returns 422 on mismatch. |
| T-10 | Rate-limit / brute-force on auth | API4:2023 | **Partial** — distributed limiter exists; *validate effectiveness + add WAF/bot protection (R-6/edge).* |
| T-11 | TLS configuration: weak ciphers, missing HSTS | ASVS V9 | **Gap (R-4)** — enforce TLS 1.2+ and HSTS before launch. |
| T-12 | Secrets management: KEK exposure via env | ASVS V6 | **Gap (R-1)** — move to KMS/HSM before production. |
| T-13 | Sensitive data exposure: PHI in logs, errors, or responses | A02:2021 | **Self-identified OK** — PHI sealed at rest; SANA stores ciphertext; ZK/MPC store no inputs. *Validate error paths don't leak.* |
| T-14 | Mass assignment / over-posting on create/update endpoints | API6:2023 | **Self-identified OK** — zod schemas allowlist fields; ids are server-generated. |

---

## 5. Readiness checklist (must be true before the external test)

- [ ] Staging environment with synthetic PHI provisioned (no real patient data).
- [ ] Test accounts for all six roles created.
- [ ] R-1 (KMS) and R-4 (TLS/HSTS) remediations scheduled or complete.
- [ ] Logging/monitoring enabled on staging to observe the test.
- [ ] Rollback plan for any state-changing tests.
- [ ] RoE signed by both parties.

## 6. Reporting

Findings rated by CVSS 3.1. Critical/High must be remediated and re-tested before
production. The accepted report becomes evidence in the HIPAA risk-management
process and the SOC 2 examination.

---

*Owner: Ramesh Tamilselvan. The self-assessment reflects the codebase at the
current commit; re-run it before the engagement and treat external findings as
authoritative over self-assessment.*
