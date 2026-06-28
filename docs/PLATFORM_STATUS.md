# Shiora — Platform Status Across the Six Audiences

> **Prepared for external consultant review.** This is an honest, code-grounded
> status of the Shiora platform across its six audiences: **individuals,
> providers, employers, health plans, governments, researchers**. It is meant to
> be read alongside the machine-readable source of truth (the feature maturity
> registry, `src/lib/api/maturity.ts`, served at `GET /api/system/status`) and the
> compliance package in [`docs/compliance/`](compliance/README.md).
>
> **Read the maturity words precisely:**
> - **production** = the feature is **real and fully tested** in the codebase
>   (not simulated). It does **not** mean the platform is certified or running
>   live with real patient PHI.
> - **pilot** = real and functional, but with a deliberately bounded scope or a
>   dependency that is gated on config/provisioning.
> - **simulated** = honestly labeled placeholder; returns structured demo data,
>   not a real implementation. Surfaced as such to the user.
>
> **Overall posture:** *testnet-preview / pilot-ready.* The data, security,
> crypto, and per-audience application backbones are real and tested. The
> platform is **not** yet certified (HIPAA/SOC 2) and is **not** live with real
> PHI; public-testnet/production launch is gated on external items listed in §9.

- **Date:** 2026-06-28 · **Branch:** `feat/backbone-phi-encryption-audit` (PR #9) · **Owner:** Ramesh Tamilselvan
- **Engineering quality gate (every commit):** **215 test suites / 3,802 tests, 100% coverage** (statements/branches/functions/lines), ESLint clean, TypeScript strict clean.

---

## 1. Headline: feature maturity at a glance

42 registered features: **26 production · 6 pilot · 10 simulated.**

The platform is built **backbone-first**: a real, encrypted, audited, role-gated
data core, with cryptographic subsystems (ZK proofs, secure MPC, content
addressing, tamper-evident audit) that are **genuinely real** — not mocked. The
remaining `simulated` items are honestly labeled and are mostly advanced AI /
hardware / on-chain features that depend on external provisioning.

What makes the "real" claims credible:
- **PHI is encrypted at rest** (AES-256-GCM envelope, per-record keys, AAD
  binding) before it ever reaches storage; production refuses to run without a
  durable database (no PHI in memory).
- **The audit trail is tamper-evident** (SHA-256 hash chain, multi-process safe)
  and **discloses to the data subject** who accessed their data (GDPR Art. 15).
- **The cryptography is real, not decorative:** zero-knowledge set-membership
  proofs (transparent setup, no trusted ceremony), Shamir-based secure
  aggregation, spec-correct IPFS CIDv1 — each with completeness *and* soundness
  tests.
- **Honest labeling is enforced in code** via the maturity registry, so a
  reviewer can never mistake a placeholder for a real control.

---

## 2. INDIVIDUALS (patients — the data owners) — **strongest, production-ready**

The individual is sovereign over their own data; everything else is granted from here.

| Capability | Maturity | Notes |
|---|---|---|
| Health records (encrypted, owner-scoped) | ✅ production | AES-256-GCM at rest; empty-start; Postgres-ready |
| Cycle & symptom vault + analytics | ✅ production | Women's-health tracking with derived cycle/symptom analytics |
| Consent management (with expiry/auto-renew) | ✅ production | Lifecycle: grant → expire/auto-renew → revoke, all notified |
| Access grants to providers (time-bounded, revocable) | ✅ production | Provider reads require an active, unexpired grant |
| GDPR data-subject rights | ✅ production | Real Art. 15 access, Art. 20 portability (JSON/CSV/XML), Art. 17 erasure across every store |
| Personal activity transparency | ✅ production | "What did I do" feed over the audit chain |
| Data-access transparency (disclosure log) | ✅ production | "Who accessed my data, and when" — incl. provider reads & note-writes |
| Account profile | ✅ production | Human identity beyond a wallet address |
| Notifications inbox (+ mute preferences) | ✅ production | Cross-feature events (grants, consent, clinical notes, wellness) |
| Zero-knowledge proofs (selective disclosure) | ✅ production | Prove "age in range" / "condition present" without revealing the data |
| IPFS content-addressed storage | ✅ production | Encrypt-then-address; CID integrity-verified on resolve |
| **SANA health assistant** | 🟡 pilot | Real, **non-diagnostic** guarded assistant (see §8). Claude when keyed, deterministic stub otherwise |
| Wearables integration | 🟡 pilot | |
| Health alerts | 🟡 pilot | |
| Community circles | 🟡 pilot | |
| Genomics & biomarkers, Digital twin, Health insights, Emergency response | ⛔ simulated | Advanced features, honestly labeled |

**Verdict:** the individual experience is the most complete and is genuinely
production-grade at the data/security layer.

---

## 3. PROVIDERS — **production-ready core, advanced clinical AI simulated**

| Capability | Maturity | Notes |
|---|---|---|
| Provider patient directory | ✅ production | Lists patients who granted access (with display names) |
| Granted record access | ✅ production | Read a patient's records only via an active grant; every read audited to the patient's disclosure log |
| Clinical notes (append-only + amendments) | ✅ production | Provider writes; patient owns & can view every note; writes attributed to the provider in the audit chain |
| Consent / access-grant participation | ✅ production | Shared with individuals |
| FHIR interoperability | 🟡 pilot | EHR exchange surface |
| Health alerts | 🟡 pilot | |
| Clinical decision support, Explainable AI, Emergency response | ⛔ simulated | Clinical AI — the SaMD-sensitive area; intentionally not "real" without a regulatory pathway |

**Verdict:** the provider↔patient data-sharing loop is real and audited
end-to-end. The clinical-AI features are deliberately simulated pending a
regulatory determination (see SaMD analysis).

---

## 4. EMPLOYERS — **production-ready, privacy-preserving by design**

| Capability | Maturity | Notes |
|---|---|---|
| Employer admin console (orgs + membership) | ✅ production | Encrypted org & membership management |
| Wellness programs + enrollment + analytics | ✅ production | Program lifecycle, progress/completion tracking, org-level analytics |
| Population analytics (de-identified) | ✅ production | k-anonymity suppression (min cohort 5) — employers never see individuals |
| Compliance reports | ⛔ simulated | |

**Verdict:** production-ready, and architecturally privacy-correct — employers
operate only on de-identified aggregates.

---

## 5. HEALTH PLANS (payers) — **production-ready core**

| Capability | Maturity | Notes |
|---|---|---|
| Care-gap registry (+ closure analytics) | ✅ production | Payer-owned registry vs **de-identified** cohorts; holds no member PHI |
| Population analytics (de-identified) | ✅ production | Shared; k-anonymity |
| FHIR interoperability | 🟡 pilot | Shared with providers |
| Compliance reports | ⛔ simulated | |

**Verdict:** the core payer workflow (care-gap tracking on de-identified cohorts)
is real and production-grade.

---

## 6. GOVERNMENTS — **production-ready oversight surfaces**

| Capability | Maturity | Notes |
|---|---|---|
| Consented data-access requests (steward approval) | ✅ production | Researcher requests a dataset; a government steward approves/denies; approval grants time-bounded, revocable access |
| Population analytics (de-identified) | ✅ production | Shared; k-anonymity |
| Compliance reports | ⛔ simulated | |

**Verdict:** the governance/stewardship workflow is real; population insight is
de-identified.

---

## 7. RESEARCHERS — **production-ready, with real privacy-tech**

| Capability | Maturity | Notes |
|---|---|---|
| Research data marketplace | ✅ production | Encrypted listing catalogue |
| Consented data-access requests | ✅ production | Request → government-steward approval → time-bounded grant |
| **Secure multi-party computation** | ✅ production | **Real** Shamir secure aggregation — sum/mean/count revealing only the aggregate, inputs never stored |
| **Zero-knowledge proofs** | ✅ production | Shared; real transparent-setup NIZK |
| Consent participation | ✅ production | |
| Research studies | 🟡 pilot | |
| Genomics & biomarkers, Explainable AI | ⛔ simulated | |

**Verdict:** the researcher audience benefits most from the real cryptographic
privacy stack (MPC + ZK), which is the platform's differentiator.

---

## 8. Cross-cutting platform foundation (applies to all six)

| Capability | Maturity |
|---|---|
| Wallet identity & sessions (secp256k1 + HMAC `__Host-` cookies) | ✅ production |
| Role-based access control (6-role capability matrix) | ✅ production |
| Tamper-evident, durable, concurrency-safe audit log | ✅ production |
| Multi-factor authentication (TOTP) | ✅ production |
| Distributed rate limiting | ✅ production |
| Notifications inbox | ✅ production |
| TEE attestation (confidential compute) | ⛔ simulated — **hardware-gated** (a real SGX/Nitro quote cannot be produced in software) |
| Blockchain anchoring & on-chain state | ⛔ simulated — awaiting the L1 client (chain/RPC target) |

**A note for the consultant on SANA (the AI assistant):** the registry contains
two SANA entries — the **real, non-diagnostic backend** (`SANA health assistant`,
**pilot**) and a **legacy placeholder** (`SANA AI assistant`, **simulated**) that
predates the real build and should be retired in a cleanup. The real SANA is
deliberately engineered to stay a **non-medical-device**: it intercepts
emergencies without invoking the model, is held to a hard non-diagnostic system
prompt, and disclaims every reply. (See [SAMD_ASSESSMENT.md](compliance/SAMD_ASSESSMENT.md).)

---

## 9. What is gating production / public-testnet (decisions for the consultant)

These are the honest blockers between "production maturity in code" and "live
with real PHI / public testnet." They are external-dependency or
provisioning-gated, **not** missing code:

1. **Key custody (top technical residual risk, R-1).** The default KEK is
   env-backed; production needs a **KMS/HSM-backed KeyProvider** (the seam exists
   — `src/lib/crypto/key-provider.ts`). *Decision: AWS KMS vs GCP KMS vs Vault.*
2. **On-chain anchoring (R-2).** The audit-chain head, ZK commitments, IPFS CIDs,
   and MPC results can be anchored on the Aethelred L1. *Decision: confirm the
   chain/RPC target* (the user will provide this next).
3. **Transport hardening (R-4).** Enforce TLS 1.2+ floor + HSTS + preload; add a
   WAF / edge DDoS protection.
4. **Claim accuracy (R-3).** Reconcile the "encrypted before leaving the browser"
   marketing claim with reality (build client-side sealing or correct the claim).
5. **External assurance (third-party, time-gated).** Executed BAAs, an external
   penetration test, a SOC 2 examination, and — for any fertility/contraception
   claim — a SaMD counsel determination. *The platform's own work product for all
   of these is already authored in [`docs/compliance/`](compliance/README.md).*
6. **Hardware-gated.** TEE attestation needs real secure hardware + a vendor
   attestation service; only the verifier half is buildable in software.
7. **Ops.** Managed backups/PITR, centralized log aggregation/SIEM, observability.

---

## 10. Suggested questions for the consultant

- Is **backbone-first + honest simulation labeling** the right sequencing for the
  M42 pilot, or should specific simulated features (e.g. FHIR, clinical decision
  support) be prioritized to real for pilot fit?
- For **key custody**, which KMS aligns with the target hosting and the M42
  pilot's procurement constraints?
- On **SaMD**: confirm the position that SANA is non-device and that only the
  **fertility-window** feature needs a counsel determination before any
  contraception/conception claim.
- For **SOC 2**, what observation window and evidence collection should we start
  now, given the CI gate already produces per-commit change-management evidence?
- Does the **de-identified-aggregate-only** posture for employers/payers/governments
  meet the consultant's bar, or is formal §164.514 expert determination warranted?

---

*This status is generated from the live maturity registry and the codebase at
commit `f12f70c`. For the per-control compliance detail, see
[`docs/COMPLIANCE.md`](COMPLIANCE.md) and [`docs/compliance/`](compliance/README.md).*
