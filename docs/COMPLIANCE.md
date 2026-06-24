# Shiora — Compliance Control Matrix & Gap-to-Production Roadmap

> **Status: testnet-preview.** This document is the *honest* record of Shiora's
> compliance posture. It maps each required control to the **actual code or
> process that implements it today**, and marks truthfully what is not yet
> real. It exists so that no one — internally, in a pilot, or in investor
> diligence — mistakes an aspirational claim for an operational control.
>
> Certification status: **None of HIPAA, SOC 2, HITRUST, or ISO 27001 is
> certified.** Those are auditor- and time-gated and cannot be produced by
> code. This document is the evidence base an auditor would start from.

## Legend

| Mark | Meaning |
|------|---------|
| ✅ **Implemented** | Real, tested control present in the codebase today. |
| 🟡 **Partial** | Real control exists but is incomplete for production (e.g. in-memory only, dev-key fallback). |
| ⛔ **Not started** | Claimed elsewhere but **no real implementation exists yet**. |
| 📋 **Process** | Non-code control requiring human/legal/operational action. |

---

## 1. HIPAA Security Rule — Technical Safeguards (§164.312)

| Control | Requirement | Status | Evidence / Gap |
|---------|-------------|--------|----------------|
| **C-ENC-1** Encryption at rest | §164.312(a)(2)(iv), (e)(2)(ii) | ✅ Implemented | `src/lib/crypto/envelope.ts` — AES-256-GCM envelope encryption, per-record DEKs wrapped by a KEK, AAD context binding, tamper detection. Tested in `src/__tests__/lib/crypto/envelope.test.ts`. |
| **C-ENC-2** Key custody | Keys held in a KMS/HSM, rotated | 🟡 Partial | KEK resolution is isolated behind a `KeyProvider` seam (`src/lib/crypto/key-provider.ts`) with working **versioned key rotation** (current key + retained historical keys; sealed data records its version). Default provider is env-backed. **Gap:** a KMS/HSM-backed `KeyProvider` (AWS KMS / GCP KMS / Vault Transit) and removing the env-key path in production. |
| **C-ENC-3** Encryption in transit | §164.312(e)(1) | 🟡 Partial | TLS terminated at the platform edge; HSTS gated behind `SHIORA_ENABLE_HSTS`. **Gap:** enable HSTS + preload, enforce TLS 1.2+ ciphers, mTLS for service-to-service. |
| **C-ENC-4** Client-side / end-to-end encryption | Stated in SECURITY.md | ⛔ Not started | The README/SECURITY claim "encrypted before leaving the browser" is **not yet implemented**. Either build browser-side sealing (VALORA wallet key) or correct the claim. |
| **C-AUTH-1** Authentication | §164.312(d) | ✅ Implemented | `src/lib/api/wallet-verify.ts` — real secp256k1 ECDSA + bech32 address derivation; `src/lib/api/session.ts` — HMAC-SHA256 signed, `__Host-` cookies, timing-safe compare. |
| **C-AUTH-2** MFA | Best practice / HITRUST | 🟡 Partial | TOTP (RFC 6238) implemented — `src/lib/api/totp.ts` + `mfa-service.ts` + `/api/mfa*`; secret sealed at rest, audited. **Gap:** step-up enforcement on sensitive actions (enrolment/verification primitives are done). |
| **C-AC-1** Access control / authorization | §164.312(a)(1) | 🟡 Partial | `requireAuth` gates routes; data is owner-scoped in `store.ts`. **Gap:** no role-based / attribute-based access control yet for the six audience roles (individual, provider, employer-admin, payer-analyst, gov, researcher). |
| **C-AC-2** Automatic logoff | §164.312(a)(2)(iii) | ✅ Implemented | Session TTL (`SHIORA_SESSION_TTL_HOURS`) enforced in `verifySessionToken`. |
| **C-AUD-1** Audit controls | §164.312(b) | 🟡 Partial | `src/lib/api/audit.ts` emits structured audit events. **Gap:** in-memory, lost on restart, not centralized. |
| **C-AUD-2** Audit integrity | §164.312(c)(1) | ✅ Implemented | `src/lib/crypto/audit-chain.ts` — SHA-256 hash-linked, append-only chain; `verifyAuditChain` detects edits, deletions, reordering. Tested. |
| **C-AUD-3** Audit durability + anchoring | Tamper-*proofing* | 🟡 Partial | Durable, concurrency-safe append implemented: the Postgres `audit_chain` store advances the chain head via a `seq` PRIMARY KEY with insert-and-retry, so concurrent multi-process appends cannot fork or overwrite the chain (`src/lib/persistence/pg-audit-store.ts`; verified against a real Postgres engine). **Gap:** mirror the chain to a WORM/object-lock sink and anchor the head hash on the Aethelred L1 so a single operator cannot rewrite history. |
| **C-INT-1** Integrity of PHI | §164.312(c)(1) | ✅ Implemented | GCM auth tags (envelope) + audit-chain hashing both detect unauthorized alteration. |
| **C-NET-1** Transmission security / rate limiting | §164.312(e)(1) | 🟡 Partial | `src/lib/api/middleware.ts` — CORS origin enforcement + in-memory rate limiter. **Gap:** distributed rate limiting (Redis), WAF, bot/DDoS protection at the edge. |

## 2. Data Plane & Infrastructure (gaps that block real PHI)

| Control | Status | Gap |
|---------|--------|-----|
| **C-DB-1** Durable encrypted datastore | ⛔ Not started | All data is seeded mock data in a flat `.shiora-data/state.json` file (`store.ts`). Needs a real database (Postgres) with the envelope layer applied to PHI columns, migrations, backups, PITR. |
| **C-TEE-1** Confidential compute | ⛔ Not started | `teeVerified: true` is **hardcoded**. No attestation is performed. Needs integration with `aethelred-tee-worker` and real attestation verification. |
| **C-ZK-1** Zero-knowledge proofs | ⛔ Not started | `/api/zkp/*` returns mock proofs. Needs integration with `aethelred-zkml-prover`. |
| **C-AI-1** Verifiable AI inference | ⛔ Not started | No LLM/inference is wired (no AI SDK in `package.json`). "SANA AI companion" is UI-only. |
| **C-IPFS-1** Decentralized record storage | ⛔ Not started | No IPFS client present; gateway URL is configured but unused. |

## 3. Administrative, Physical & Legal Safeguards (§164.308 / §164.310)

| Control | Status | Owner |
|---------|--------|-------|
| **C-PROC-1** Risk analysis & management (§164.308(a)(1)) | 📋 Process | Security lead — formal HIPAA risk assessment required. |
| **C-PROC-2** Business Associate Agreements | 📋 Process | Legal — BAAs with every subprocessor (hosting, KMS, email, analytics) before any real PHI. |
| **C-PROC-3** Workforce training & access management | 📋 Process | Ops — onboarding/offboarding, least-privilege IAM. |
| **C-PROC-4** Breach notification procedure | 📋 Process | Legal/Ops — documented within statutory timelines. |
| **C-PROC-5** GDPR lawful basis, DPO, DPIA, RoPA | 📋 Process | Legal — required for EU data subjects. Note: `/api/privacy/*` (access, erasure, portability) endpoints exist as UI scaffolding to support DSARs. |
| **C-CERT-1** SOC 2 Type II | 📋 Process | Independent CPA firm; needs a 3–12 month observation window. |
| **C-CERT-2** HITRUST CSF | 📋 Process | Authorized assessor. |
| **C-CERT-3** Penetration test | 📋 Process | Third-party firm; required pre-launch and annually. |

## 4. Regulatory (per audience)

| Audience | Regulatory question | Status |
|----------|--------------------|--------|
| **Providers** | Clinical decision support (differentials, drug-interactions) may be **Software as a Medical Device** (FDA SaMD / EU MDR). | ⛔ Must be reviewed by regulatory counsel **before** any feature influences a care decision. Until then, label as non-diagnostic / informational. |
| **Individuals** | Wellness vs. medical claims; FTC health-claims rules. | 📋 Marketing/legal review. |
| **Health plans** | Claims data → HIPAA + state insurance regs; X12 EDI. | ⛔ Not started. |
| **Employers** | ERISA / ADA / GINA when handling employee health data; must be de-identified for aggregate reporting. | 📋 + ⛔ |
| **Governments** | Data residency, sovereignty, FedRAMP-class controls for public deployments. | 📋 + ⛔ |
| **Researchers** | IRB oversight, informed consent, HIPAA de-identification (Safe Harbor / Expert Determination) for the data marketplace. | ⛔ Not started. |

---

## Honest current-posture statement (use this language externally)

> Shiora is in **testnet-preview**. Its authentication boundary and PHI
> encryption/audit-integrity primitives are real and tested; its data plane,
> confidential-compute, and AI integrations are in development and currently
> operate on synthetic data. Shiora is **designed for** HIPAA and GDPR and is
> **not yet certified**. Compliance certifications and any clinical/regulatory
> clearances are in progress.

This replaces non-substantiated present-tense claims ("HIPAA compliant",
"processing occurs exclusively inside TEE", "encrypted before leaving the
browser") in `README.md`, `SECURITY.md`, and the marketing site until the
corresponding ⛔/🟡 controls reach ✅.

## Roadmap to "production-ready for real PHI" (sequence)

1. **Backbone (in progress).** ✅ envelope encryption, ✅ audit-chain integrity → wire both into a real **Postgres** datastore replacing `store.ts`; move KEK to **KMS** (C-ENC-2); centralize + make audit durable and L1-anchored (C-AUD-1/3).
2. **Identity & authorization.** RBAC/ABAC for the six audience roles (C-AC-1); MFA (C-AUTH-2).
3. **Real integrations.** TEE attestation (C-TEE-1), zkML proofs (C-ZK-1), FHIR R4, IPFS — replace every hardcoded `teeVerified`/mock proof.
4. **Hardening.** Distributed rate limiting + WAF (C-NET-1), HSTS/TLS (C-ENC-3), client-side encryption (C-ENC-4), pen test (C-CERT-3).
5. **Compliance & regulatory (parallel, human-gated).** Risk assessment, BAAs, policies, SOC 2 / HITRUST engagement, SaMD review for clinical features.
6. **Per-audience verticals** built on the certified backbone.
