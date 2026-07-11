# Shiora — Platform Status Report (for consultant review)

**Date:** 2026-07-11
**Repo:** `github.com/aethelred-foundation/shiora` (private)
**Working branch:** `feat/backbone-phi-encryption-audit` (149 commits ahead of `main`)
**Prepared for:** external consultant review — feedback requested on prioritization and next steps (§13).
**Supersedes:** the 2026-07-01 edition of this report.

---

## 1. Executive summary

Shiora is a **sovereign women's-health data platform** built as a Next.js 15 application on top of the Aethelred ecosystem. It serves **six audiences** (individuals, providers, health plans/payers, employers, researchers, governments) from a single, capability-gated backend.

**Current posture (honest):**

- **The data core is real, not a demo.** PHI is envelope-encrypted (AES-256-GCM, per-record data keys), owner-scoped, and every access is written to a tamper-evident, hash-chained audit log. Postgres-ready with an in-memory driver for dev/preview.
- **36 of 43 registered features are real** (26 production-grade + 10 pilot). The remaining **7 are simulated and honestly labeled as such** at the API, the UI, and a machine-readable registry — deliberately *not* faked because they need hardware, an external service, a real ML model, or a regulatory pathway.
- **The enterprise-hardening program is complete.** Since the last report we identified **28 technology gaps** against a top-tier digital-health incumbent bar (Maven, Sword, Hinge) and **closed all 28** — each as an independent commit at 100% test coverage with the production build green (§7). This added, among other things: observability with Prometheus metrics, crypto-shredding erasure, KEK re-seal, blind-index searchable encryption, WORM audit export, signed webhooks, WebAuthn passkeys, idempotency + optimistic concurrency, an OpenAPI 3.1 contract, SSE notifications, failed-auth lockout, a data-retention engine, i18n with full Arabic RTL, a committed Playwright E2E suite, and a load/perf baseline.
- **The two hardest "simulated" gaps moved materially.** We built a **real TEE attestation verifier** (AMD SEV-SNP report parsing + X.509 chain + ECDSA-P384 verification, fail-closed) — hardware quote *generation* remains a deployment step, but verification is no longer theater. And we built + proved **`ShioraSealAttestation`**, a consensus-minted attestation contract anchored to the Aethelred Digital Seal precompile, exercised against the real chain node in its own repo's Go test (§8).
- **Quality bar:** 281 test suites / **4,459 tests / 100% coverage** (statements, branches, functions, lines) enforced as a hard gate; TypeScript strict; ESLint clean; **0 dependency vulnerabilities**; plus a new **7-spec Playwright E2E suite** (including axe accessibility scans in both LTR and RTL) and an autocannon load baseline.

**The single most important thing for a reviewer to know:** *the platform's claims match its implementation.* Where something is not real, it says so — at the API, in the UI, and in a registry a CI test enforces. This is the posture we intend to carry into external audit and partner diligence.

**What we need direction on now (§13):** external-audit scoping and timing, the TEE deployment decision (verifier is built; hardware is a provisioning choice), on-chain go-live sequencing, multi-replica scale-out priorities, and pilot-feature sequencing for M42/MBZUAI.

---

## 2. Architecture & stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend | Next.js 15 (App Router), React 18, TypeScript **strict** | Server components + client hooks; Tailwind; Recharts |
| API | Next.js Route Handlers — **159 routes** | Zod validation, structured error envelopes, per-route auth + capability gating, OpenAPI 3.1 contract |
| Data | Postgres (prod) / in-memory (dev/preview) | Driver selected by `DATABASE_URL`; a hard guard refuses in-memory PHI in production |
| Auth | Cosmos wallet (Keplr/Leap) + WebAuthn/passkeys + TOTP | secp256k1 verification + bech32; HMAC-signed `__Host-` cookies; FIDO2 second factor |
| State/data-fetching | `@tanstack/react-query` | |
| Crypto | Node `crypto` + Web Crypto | **No third-party crypto libraries**; minimal dependency surface |
| i18n | In-house locale framework | English + Arabic; app-wide RTL via one `<html dir>`; `Intl.PluralRules` |

**Scale of the codebase:** ~63,700 lines of production TypeScript (55 API service modules, 26 persistence modules, 13 crypto modules) plus ~57,300 lines of tests across 281 suites.

**Dependency posture:** the entire production dependency set is `next, react, react-dom, @tanstack/react-query, pg, zod, recharts, lucide-react, tailwindcss, postcss, autoprefixer`. There is **no chain client, no IPFS client library, no LLM SDK, no crypto or WebAuthn library** shipped in the bundle — those capabilities are implemented in-house or behind swappable seams. Result: `npm audit` = **0 vulnerabilities** and a small, auditable attack surface.

---

## 3. What is real vs. simulated (the honest maturity map)

Enforced by a single machine-readable source of truth (`src/lib/api/maturity.ts`), surfaced at `GET /api/system/status`, stamped on every API response via an `X-Shiora-Maturity` header, and embedded in simulated responses via a `simulatedResponse()` marker. A CI test statically fails the build if a production/pilot route loses its label or a simulated route claims to be real.

### Production (26) — real, encrypted, audited, Postgres-ready

Wallet identity & sessions · health records (envelope-encrypted, owner-scoped) · consent management (expiry + auto-renewal) · access grants · six-role RBAC + capability matrix · tamper-evident audit log · GDPR data-subject rights (Art. 15/17/20) · personal activity transparency · subject-scoped data-access disclosure log · account profile · research data marketplace · population analytics (k-anonymity, min cohort 5) · care-gap registry · provider patient directory · clinical notes (append-only + attributed amendments) · granted record access · employer admin console · wellness programs · TOTP MFA · distributed rate limiting · notifications inbox (+ mute preferences) · consented data-access requests (steward-approved, time-bound) · zero-knowledge proofs (transparent-setup NIZK) · secure multi-party computation (Shamir) · IPFS content addressing (spec-compliant CIDv1) · cycle & symptom vault with analytics.

### Pilot (10) — real core, one honest gap each

SANA health assistant (non-diagnostic guardrail engine + LLM seam) · wearables (real encrypted ingest; **gap:** live vendor OAuth) · FHIR R4 import/export (**gap:** EHR-sandbox conformance) · research studies · health alerts · community circles · audit anchoring (WORM series built; **gap:** live L1 broadcast, config-gated) · SANA chat UI · health insights (non-diagnostic statistics) · compliance reports (derived from live system state).

### Simulated (7) — honestly gated, deliberately not faked

| Feature | Why simulated | What changed since the last report |
|---|---|---|
| **TEE attestation** | No live enclave hardware attached | **Verification is now real** (§8): SEV-SNP report parser + X.509 chain + ECDSA-P384, fail-closed. Quote *generation* still requires provisioned confidential-compute hardware — an operator/deployment step, not a code gap. |
| **Blockchain anchoring / on-chain state** | No live L1 target for the app | **The contract tier is now proven** (§8): `ShioraSealAttestation` runs against the real Aethelred node in the chain repo's Go test. The app's anchoring pipeline remains config-gated on a live RPC target. |
| **Clinical decision support** | Reference content, explicitly not SaMD | Unchanged — needs a regulatory pathway. |
| **Genomics & biomarkers** | No genomic pipeline | Unchanged. |
| **Digital twin** | No physiological model | Unchanged. |
| **Explainable AI** | No live model | Unchanged. |
| **Emergency response** | Safety-critical integration | Unchanged. |

---

## 4. Security & cryptography

All primitives are pure `node:crypto` / Web Crypto — no third-party crypto dependencies. Items marked **(new)** landed since the 2026-07-01 report.

**Data protection**

- **PHI envelope encryption** — AES-256-GCM, per-record random DEKs wrapped by a KEK, AAD binding (`collection:owner:id`), rotation-versioned.
- **Key custody** — pluggable `KeyProvider`; HashiCorp Vault KV-v2 provider (rotation-aware) implemented and config-selected; AWS/GCP KMS drop-in behind the same seam. Production boot hard-fails without a durable key + TLS.
- **(new) KEK re-seal** — a batched, cursor-resumable maintenance operation re-wraps every stored envelope under the current KEK version, so key rotation protects the *back catalog*, not just new writes.
- **(new) Crypto-shredding erasure** — GDPR Art. 17 erasure destroys the wrapped DEK (tombstone envelope), making the plaintext permanently unrecoverable even by the operator; distinct from reversible soft-delete.
- **(new) Blind-index searchable encryption** — HMAC-derived, key-domain-separated tokens allow exact-match search over sealed record tags without decrypting or exposing the tag.
- **(new) Data-retention engine** — storage-limitation enforcement (GDPR Art. 5(1)(e)): soft-deleted rows past the configured window are crypto-shredded by the scheduled maintenance pass.
- **Client-side selective E2E sealing** — Web Crypto AES-GCM with a wallet-signature-derived key (HKDF), never sent to the server; wired into the vault's most sensitive free-text field.

**Authentication & session security**

- Wallet auth with canonical low-S enforcement and single-use, HMAC-bound challenges (Tier-1 findings H-02/L-02/L-04, §10).
- HMAC-signed `__Host-` session cookies; per-token `jti` with server-side revocation; session inventory + "sign out everywhere".
- TOTP MFA (RFC 6238) with **step-up enforcement** on sensitive routes (5-minute assertions).
- **(new) WebAuthn/FIDO2 passkeys** — full registration + assertion ceremonies built from first principles: a minimal RFC 8949 CBOR decoder, COSE ES256 → SPKI conversion, and Node-crypto assertion verification enforcing challenge/origin/rpIdHash binding, user presence, and a monotonic signature counter (cloned-authenticator detection). Fail-closed on every check. Credentials live in the encrypted document store; enrolment/removal are audited.
- **(new) Failed-authentication lockout** — per-account/per-IP failure tracking with exponential backoff, closing the offline-brute-force window.

**Integrity & transparency**

- **Tamper-evident audit chain** — SHA-256 hash-linked, HMAC-keyed (insider-rewrite resistant, M-02), persisted, multi-process safe, publicly `verify()`-able; includes a **subject dimension** so patients see who touched their data (GDPR Art. 15 disclosure).
- **(new) WORM audit export** — signed, self-verifiable chain segments (`GET /api/audit/export`) suitable for off-platform write-once retention; verification needs no database access.
- **(new) Signed webhooks** — Stripe-style HMAC-signed outbound event delivery with retry/backoff and an SSRF guard on the outbound HTTP path.

**Advanced cryptography (unchanged, re-listed for completeness)**

- **Zero-knowledge proofs** — real 1-of-k OR-proof (Cramer–Damgård–Schoenmakers) over a 3072-bit MODP safe-prime subgroup; **transparent setup** (no trusted-setup ceremony — chosen deliberately over a SNARK whose single-party setup would be dishonest to ship).
- **Secure multi-party computation** — real (t, n) Shamir threshold scheme over GF(2¹²⁷−1); secure aggregation reveals only cohort totals/means.
- **IPFS content addressing** — spec-compliant CIDv1, validated against canonical vectors; encrypt-then-address.

**Perimeter**

- Zod validation everywhere; distributed rate limiting (Postgres atomic counters) **(new) with standard `RateLimit-*` response headers**; per-request CSP script nonces with `'strict-dynamic'` (M-01); **(new) CSP violation reporting endpoint + RFC 9116 `security.txt`**; security headers (X-Frame-Options, COOP/CORP, Permissions-Policy, HSTS behind a prod flag); trusted-proxy IP resolution (H-01).

**Post-quantum note:** the underlying **Aethelred L1** (separate Go repo) provides real post-quantum signatures (ML-DSA-65) and KEM (ML-KEM-768), default-on and NIST-ACVP-checked. Shiora is the health-application layer; the crypto above is Shiora's own data-layer crypto.

---

## 5. Six-audience model

A single RBAC role model + capability matrix gates every PHI/analytics route, so all six audiences are served from one backend with least-privilege enforcement:

- **Individuals** — records, vault (cycle/symptom logging + analytics), consent, access grants, GDPR rights, transparency feeds, insights, SANA assistant.
- **Providers** — clinical notes (append-only + amendments), granted-record read (gated + audited), patient directory.
- **Researchers** — marketplace dataset requests, secure MPC cohort computation.
- **Governments** — data-request stewardship (approve/deny/revoke), population analytics.
- **Health plans / payers** — care-gap registry + closure analytics, population analytics.
- **Employers** — org/membership console, wellness programs + participation analytics.

---

## 6. Compliance & privacy engineering posture (honest)

- **GDPR** — real DSAR mechanics: Access (Art. 15), Portability (Art. 20 with real JSON/CSV/XML serialization), Erasure (Art. 17 — now **crypto-shredding**, not just soft-delete), a subject-side "who accessed my data" disclosure log, and **retention enforcement** (Art. 5(1)(e)).
- **HIPAA** — technical safeguards implemented and mapped to code (encryption at rest, audit controls, integrity, access control, authentication). `docs/compliance/` contains our own authored work product: a HIPAA Risk Assessment (NIST 800-30), BAA templates + subprocessor register, a Penetration Test Plan (OWASP ASVS/Top-10 self-assessment), a SOC-2 readiness mapping (TSC CC1–CC9), and a SaMD assessment.
- **SaMD** — SANA and insights are engineered **non-diagnostic** by design; the SaMD assessment flags only fertility-window prediction for counsel if we ever make contraception/conception claims.
- **Accessibility** — two enforced automated gates: component-level jest-axe in the unit suite, and page-level axe scans in the E2E suite (dashboard + settings, in both LTR and RTL). The E2E gate caught and we fixed a real critical violation.
- **Internationalization** — English + Arabic shipped; selecting Arabic mirrors the **entire interface right-to-left** (relevant to the UAE/MBZUAI market). Message catalogs are typed so a missing Arabic key is a build error; pluralization uses `Intl.PluralRules` (correct for Arabic's six plural categories).
- **Honesty boundary (unchanged and important):** certifications (HIPAA/SOC-2/HITRUST) and any SaMD clearance are **auditor- and time-gated** — they cannot be produced by code and are **not claimed**. Public copy says "HIPAA-aligned, certification in progress," never "HIPAA compliant."

---

## 7. The 28-gap enterprise-hardening program (new; complete)

After the honesty pass, we assessed the platform against what a top-tier digital-health incumbent ships and catalogued **28 concrete gaps** (`docs/TECHNOLOGY_GAP_ASSESSMENT.md` — the ledger, with a commit reference per closure). All 28 are now closed; each was an independent commit at 100% coverage with the production build green. No stubs: every closure is a working subsystem with tests.

| Category | Gaps closed |
|---|---|
| **Reliability & operations** | Durable-store garbage collection on a schedule (GAP-01) · structured JSON logging (02) · Prometheus metrics + `/api/system/metrics` (03) · rate-limit response headers (04) · graceful-degradation contract for datastore outages (05) · load/perf baseline + smoke gate (06) |
| **Security depth** | MFA step-up enforcement on sensitive routes (07) · session inventory + per-device revocation (08) · failed-auth lockout (09) · CSP violation reporting (10) · RFC 9116 security.txt (11) · **WebAuthn/FIDO2 passkeys** (12) |
| **Privacy engineering** | **Crypto-shredding erasure** (13) · **KEK re-seal of the back catalog** (14) · **blind-index searchable encryption** (15) · data-retention purge engine (16) |
| **API robustness** | Idempotency keys on unsafe POSTs (17) · optimistic concurrency via versions/If-Match (18) · OpenAPI 3.1 contract + drift test (19) · uniform cursor pagination (20) · **signed webhooks with SSRF guard** (21) · SSE real-time notifications (22) |
| **Product quality** | Root error containment (23) · automated accessibility gate (24) · **i18n + app-wide Arabic RTL** (25) · committed Playwright E2E suite (26) |
| **Data layer** | Connection-pool/statement hardening (27) · **WORM audit-chain export** (28) |

Program metrics: the Jest suite grew **4,005 → 4,459 tests** across the program, coverage held at 100% throughout, and the tracker document is the single source of truth with per-gap commit hashes.

---

## 8. Confidential computing & chain — what changed (new)

The last report's two hardest open questions (TEE and on-chain) both moved from "simulated only" to "real capability, deployment-gated":

**TEE attestation verification is built and real** (`src/lib/attestation/`). A fail-closed cryptographic verifier: X.509 certificate-chain validation (Node's built-in `X509Certificate`, leaf → intermediates → pinned vendor root), a byte-exact AMD **SEV-SNP** `ATTESTATION_REPORT` parser (fixed 1,184-byte layout), and ECDSA-P384 signature verification against the VCEK, with nonce/measurement/freshness binding. 30 tests at 100% coverage against a real generated ECDSA-P384 test PKI. **Honest boundary:** SGX-DCAP/TDX/Nitro are declared adapter-pending and reject honestly (never silently "verified"); live quote *generation* requires provisioned confidential-compute hardware at deploy time — we verify attestations, we don't manufacture silicon. This is exactly the "verifier-only honest half-step" (option c) from the last report's decision list — now done.

**The on-chain attestation tier is built and proven against the real chain.** `contracts/seal/ShioraSealAttestation.sol` (OpenZeppelin 5, non-upgradeable, Ownable2Step) anchors consent/processing attestations to the Aethelred **Digital Seal precompile** (`ISeal @ 0x0900`): consensus-minted rather than self-signed, subject+scope-bound purpose, live revocation, one-seal-one-attestation permanence. 21/21 tests, 100% measured coverage, and — the definitive proof — a Go integration test **in the chain repo against the real node** exercising attest → policy-reject → revoke → permanence. **No PHI on-chain** (subject address + scope hash only). Honest scope: the 14 pre-existing design-artifact contracts remain unproven and unshipped; this contract is not yet wired into the app UI (deliberately — no re-adding of on-chain badges until the flow is live end-to-end).

**Also real already:** CIDv1 content addressing, and the anchoring client that broadcasts a real `eth_sendTransaction` when `SHIORA_L1_RPC_URL` is configured (labeled local WORM anchoring otherwise).

What remains for both is **provisioning, not code**: confidential-compute hardware for quote generation, and a live Aethelred RPC target for the app's anchoring path.

---

## 9. Frontend honesty pass (completed earlier this cycle; summarized)

The app previously carried a polished but partly fabricated demo shell ("TEE-verified", "IPFS-pinned", fabricated tx hashes, fake platform stats). We rewired the seven main pages (vault, records, access, settings, home, insights, chat) to the real encrypted APIs, removed every unsubstantiated claim app-wide, and rewrote insights as real non-diagnostic statistics over the user's own data. Remaining demo surfaces are exclusively the honestly-labeled simulated features. *The de-theatering discipline has held through all subsequent work — the new attestation and seal capabilities were deliberately **not** surfaced as UI badges.*

---

## 10. Tier-1 self-audit & remediation (completed earlier this cycle; summarized)

An internal security review at external-audit stringency produced 10 findings, each remediated with a real subsystem (no stubs), one commit per finding:

| ID | Severity | Finding → Remediation |
|----|----------|------------------------|
| H-01 | High | Spoofable `x-forwarded-for` rate-limit keys → trusted-proxy hop resolution + per-account buckets |
| H-02 | High | Replayable auth challenges → atomic single-use nonce store |
| M-01 | Medium | `'unsafe-inline'` CSP → per-request script nonces + `'strict-dynamic'`, live-verified |
| M-02 | Medium | Unkeyed audit hashes → HMAC-SHA256 chain MAC under a derived key |
| M-03 | Medium | No server-side session revocation → `jti` revocation store + revoke-all |
| L-01–L-04 | Low | Fabricated connect-response data removed · low-S signature enforcement · HKDF domain separation · client-timestamp theater removed |
| I-02 | Info | Shamir sampling margin → RFC 9380 sizing (bias < 2⁻¹²⁹) |

Open informational items: I-03 (origin fail-open on missing header; accepted, mitigated by `sameSite`) and I-04 (external review of custom primitives — part of the external-audit scope, §13).

---

## 11. Testing & quality

- **Unit/integration:** 281 suites / **4,459 tests / 100% coverage** (statements, branches, functions, lines) — enforced as a hard gate. TypeScript strict clean; ESLint clean; 0 dependency vulnerabilities.
- **End-to-end (new):** a committed **Playwright suite** (7 specs) that boots the app hermetically — dashboard shell, the Arabic/RTL switch with persistence, operational endpoints, and page-level axe accessibility scans in both reading directions. Runnable locally (`npm run test:e2e`) and wired into the CI workflow as a dedicated job.
- **Performance (new):** an autocannon load profile (`npm run perf`) that doubles as a smoke gate — it fails on any error/timeout/non-2xx under 20-way concurrency — plus a committed `perf/BASELINE.md` with reference numbers, honestly labeled as dev-server figures (a production baseline needs a provisioned datastore; see §13).
- **Discipline:** anti-drift maturity invariant test; OpenAPI drift test (documented endpoints must exist); Postgres adapters validated against a real Postgres out-of-band; live dev-server verification after edge/instrumentation changes.
- **Gap (unchanged):** hosted GitHub Actions runs are blocked on org billing, so the full gate runs locally/pre-push. The workflows (unit + E2E jobs) are committed and ready.

---

## 12. Deployment & infrastructure readiness

**Code-ready / config-gated (needs provisioning, not code):**

- Postgres datastore + versioned migrations; scheduled maintenance (GC + retention purge + KEK re-seal) exposed as admin operations.
- HashiCorp Vault KEK custody (or AWS/GCP KMS behind the same seam).
- TLS/HSTS + transport prod-gate — needs reverse proxy/WAF termination.
- L1 anchoring + seal-contract wiring — needs a live Aethelred RPC target.
- Confidential-compute hardware for TEE quote generation (verifier is ready).
- Observability: Prometheus scrape endpoint + structured JSON logs are built; needs a metrics/log stack to point at them.

**Multi-replica notes (single-instance seams, documented in code):** the WebAuthn challenge cache and SSE notification polling are per-instance; a multi-replica deployment needs a shared challenge store and sticky sessions (or a pub/sub backplane). These are scale-out items, not correctness gaps at pilot scale.

---

## 13. Open decisions we'd value your view on

1. **External audit scoping & timing.** The codebase is now honest, gap-closed, and 100%-covered — we believe this is the right moment to scope AUD-2026-001/002. Question: scope it as (a) full-platform, or (b) staged — custom crypto first (envelope/KDF/ZK/MPC/WebAuthn/CBOR/attestation verifier — all in-house primitives that most need independent eyes, tracked as I-04), then the platform? And which firms would you shortlist for a health-data + applied-crypto profile?
2. **TEE deployment.** The verifier is built; the remaining step is provisioning confidential-compute hardware (e.g., SEV-SNP capable instances) so real quotes flow through it. Do we (a) provision for the M42 pilot now and make "attested processing" a pilot differentiator, (b) defer hardware until after the pilot and keep the honest "verification-ready" label, or (c) treat TEE as post-pilot entirely?
3. **On-chain go-live sequencing.** The seal-attestation contract is proven against the real node, and the anchoring client is config-gated. Do we (a) stand up the live Aethelred target and wire one end-to-end flow (e.g., audit-head anchoring) before the pilot, or (b) pilot with local WORM anchoring + honest labeling and go on-chain after?
4. **Pilot-feature sequencing.** Of the 10 pilot features, our lean is still **wearables vendor OAuth + FHIR EHR-sandbox conformance** first (they unlock real data ingestion end-to-end). Agree, or would you prioritize differently for M42/MBZUAI?
5. **Production performance baseline.** The committed baseline is dev-server (honest lower bound). We'd stand up a staging environment (Postgres + Vault + TLS) and capture production numbers there — worth doing before the pilot, or alongside it?
6. **SOC-2 timing.** Our readiness mapping is authored. Start the Type I observation window now (parallel with the pilot), or after the external security audit lands?
7. **Multi-replica hardening.** Shared WebAuthn challenge store + SSE backplane + sticky-session strategy: pre-pilot, or defer until pilot load data justifies it?
8. **i18n rollout depth.** The engine, shell strings, and full RTL are shipped; per-page body copy extraction is incremental. How deep should Arabic go for the initial UAE-facing pilot — full clinical-content translation (with medical-translation review), or shell + key flows first?

---

## 14. Our recommended focus (offered as input, not conclusion)

1. **Provision the infrastructure the code already targets** — Postgres + Vault + TLS/WAF + hosted CI billing + a staging environment. Highest ratio of "unblocks production" to effort; it is provisioning, not new code, and it unlocks the production perf baseline (§13.5) for free.
2. **Kick off the external security audit now**, scoped per §13.1 — the honest, gap-closed, 100%-covered codebase is the cheapest audit surface we will ever present, and I-04 (custom-primitive review) is the highest-value item.
3. **Wire one end-to-end on-chain flow** (audit-head anchoring through the proven seal path) so the Aethelred integration is demonstrable, not just proven in isolation.
4. **Harden wearables OAuth + FHIR conformance** to make data ingestion real for the pilot.
5. **Keep the honesty discipline** — every claim maps to code, the maturity registry makes that auditable, and it has already survived one full de-theatering pass and a 28-gap program without regressing.

---

## Appendix — where to look

| Area | Location |
|---|---|
| Gap ledger (28/28, commit refs) | `docs/TECHNOLOGY_GAP_ASSESSMENT.md` |
| Crypto primitives | `src/lib/crypto/` (envelope, audit-chain, ZK, Shamir, CID, CBOR, blind-index, derived secrets) |
| Attestation verifier | `src/lib/attestation/` + `docs/ATTESTATION.md` |
| Seal contract + chain proof | `contracts/seal/` (+ Go test in the chain repo) |
| Persistence layer | `src/lib/persistence/` (stores, Postgres adapters, migrations, schema) |
| Maturity registry (SSoT) | `src/lib/api/maturity.ts` → `GET /api/system/status` |
| API contract | `GET /api/openapi` (OpenAPI 3.1) + `docs/API.md` |
| Compliance work product | `docs/compliance/` + `docs/COMPLIANCE.md` |
| Security posture & remediation | `docs/SECURITY.md`, `docs/SECURITY_REMEDIATION.md` |
| E2E & performance | `e2e/` (+ `e2e/README.md`), `perf/` (`BASELINE.md`) |
| Architecture & deployment | `docs/ARCHITECTURE.md`, `docs/DEPLOYMENT.md`, `docs/PRODUCTION_READINESS.md` |
