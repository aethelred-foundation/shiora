# Shiora — Platform Status Report (for consultant review)

**Date:** 2026-07-01
**Repo:** `github.com/aethelred-foundation/shiora` (private)
**Working branch:** `feat/backbone-phi-encryption-audit` (100 commits ahead of `main`)
**Prepared for:** external consultant review — feedback requested on prioritization and next steps.

---

## 1. Executive summary

Shiora is a **sovereign women's-health data platform** built as a Next.js 15 application on top of the Aethelred ecosystem. It serves **six audiences** (individuals, providers, health plans/payers, employers, researchers, governments) from a single, capability-gated backend.

**Current posture (honest):**

- **The data core is real, not a demo.** PHI is envelope-encrypted (AES-256-GCM, per-record data keys), owner-scoped, and every access is written to a tamper-evident, hash-chained audit log. Postgres-ready with an in-memory driver for dev/preview.
- **36 of 43 registered features are real** (26 production-grade + 10 pilot). The remaining **7 are simulated and are honestly labeled as such** at the API, the UI, and a machine-readable registry — they are deliberately *not* faked because they need hardware, an external service, a real ML model, or a regulatory pathway.
- **The frontend now tells the truth.** We just completed a "de-theatering" pass: the seven demo-shell pages that previously showed fabricated data and unsubstantiated "TEE-verified / on-chain / IPFS-pinned" claims (vault, records, access, settings, home, insights, chat) are now wired to the real APIs and stripped of claims we cannot substantiate.
- **Quality bar:** 234 test suites / 3,939 tests / **100% coverage** (statements, branches, functions, lines); TypeScript strict; ESLint clean; **0 dependency vulnerabilities**. Every backend/edge change is additionally verified against a running dev server.

**The single most important thing for a reviewer to know:** *the platform's claims now match its implementation.* Where something is not real, it says so. This is the posture we want to carry into external audit and investor/partner diligence.

**What we need direction on:** which pilot features to harden to production next, how to handle the TEE and on-chain story (the two biggest "simulated" gaps), and how to sequence hardening vs. the M42 pilot go-to-market.

---

## 2. Architecture & stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend | Next.js 15 (App Router), React 18, TypeScript **strict** | Server components + client hooks; Tailwind; Recharts |
| API | Next.js Route Handlers | Zod validation, structured error envelopes, per-route auth + capability gating |
| Data | Postgres (prod) / in-memory (dev/preview) | Driver selected by `DATABASE_URL`; a hard guard refuses in-memory PHI in production |
| Auth | Cosmos wallet (Keplr/Leap) | secp256k1 signature verification + bech32; HMAC-signed `__Host-` session cookies |
| State/data-fetching | `@tanstack/react-query` | |
| Crypto | Node `crypto` + Web Crypto | **No third-party crypto libraries**; minimal dependency surface |

**Dependency posture:** the entire production dependency set is `next, react, react-dom, @tanstack/react-query, pg, zod, recharts, lucide-react, tailwindcss, postcss, autoprefixer`. There is **no chain client, no IPFS client library, no LLM SDK** shipped in the bundle — those are behind swappable seams (see §4). Result: `npm audit` = **0 vulnerabilities**, and a small attack surface.

---

## 3. What is real vs. simulated (the honest maturity map)

This is enforced by a single machine-readable source of truth (`src/lib/api/maturity.ts`), surfaced at `GET /api/system/status`, stamped on every API response via an `X-Shiora-Maturity` header, and embedded in simulated responses via a `simulatedResponse()` marker. A CI test statically fails the build if a production/pilot route loses its label or a simulated route claims to be real.

### Production (26) — real, encrypted, audited, Postgres-ready

- **Wallet identity & sessions** — real secp256k1 verification + HMAC `__Host-` cookies
- **Health records** — AES-256-GCM envelope-encrypted PHI, owner-scoped, per-change audit
- **Consent management** — encrypted, audited, wall-clock expiry + auto-renewal
- **Access grants** — encrypted owner-scoped grants; providers see only what's shared
- **Role-based access control** — six-audience roles + capability matrix on every route
- **Tamper-evident audit log** — SHA-256 hash-chained, persisted, concurrency-safe, verifiable
- **GDPR data-subject rights** — Access (Art.15), Portability (Art.20, real JSON/CSV/XML), Erasure (Art.17)
- **Personal activity transparency** — self-scoped activity feed over the audit chain
- **Data-access transparency** — subject-scoped "who accessed my data" log (GDPR Art.15 disclosure)
- **Account profile** — encrypted, owner-scoped
- **Research data marketplace** — encrypted, audited listing catalogue *(aggregate stats are simulated)*
- **Population analytics** — de-identified cohort analytics, k-anonymity suppression (min cohort 5)
- **Care-gap registry** — encrypted payer-owned registry vs. de-identified cohorts (holds no member PHI)
- **Provider patient directory** — real, derived from active access grants
- **Clinical notes** — encrypted, audited, append-only with attributed amendments
- **Granted record access** — providers read exactly what a patient shared, gated + audited
- **Employer admin console** — encrypted org + membership management
- **Employer wellness programs** — encrypted programs + enrollment/progress
- **Multi-factor auth** — RFC 6238 TOTP, encrypted secret storage
- **Distributed rate limiting** — cross-instance, Postgres atomic counters
- **Notifications inbox** — encrypted, owner-scoped, mute-by-type preferences
- **Consented data-access requests** — researcher requests → government steward approves (time-bound grants)
- **Zero-knowledge proofs** — real transparent-setup NIZK set-membership (see §4)
- **Secure multi-party computation** — real Shamir secret-sharing secure aggregation (see §4)
- **IPFS / content addressing** — real, spec-compliant CIDv1 (validated against canonical vectors)
- **Cycle & symptom vault** — encrypted, owner-scoped logging with derived analytics

### Pilot (10) — real core, one honest gap each

- **SANA health assistant** — real non-diagnostic guardrail engine + LLM seam *(explicitly not a medical device)*
- **Wearables integration** — real encrypted ingest + per-owner analytics + cohort MPC; **remaining:** live vendor OAuth (Fitbit/Apple/Garmin)
- **FHIR interoperability** — real HL7 FHIR R4 import/export parser; **remaining:** EHR-sandbox conformance
- **Research studies** — catalogue surface; recruitment/pipelines not yet wired
- **Health alerts** — rules + lifecycle surface; not yet driven by a real signal pipeline
- **Community circles** — peer-support surface; moderation not yet production-grade
- **Audit anchoring** — audit head is hash-chained into a WORM anchor series; **remaining:** live L1 broadcast (config-gated)
- **SANA chat (web UI)** — real SANA engine behind the chat UI
- **Health insights** — real non-diagnostic statistical engine (baselines ± 2σ, z-score anomalies) over the user's own wearable data
- **Compliance reports** — real posture derived from live system state (preflight + audit-chain verify + registry)

### Simulated (7) — honestly gated, deliberately not faked

| Feature | Why it's simulated | What real would require |
|---|---|---|
| **TEE attestation** | No live SGX/TDX/SEV/Nitro enclave attached | Real hardware + vendor attestation service (or a verifier-only build) |
| **Blockchain anchoring & on-chain state** | No live L1 client | An Aethelred L1 RPC target (the anchoring pipeline is built and config-gated) |
| **Clinical decision support** | Reference content only, explicitly not SaMD | A regulatory pathway (SaMD) |
| **Genomics & biomarkers** | No genomic pipeline | A real bioinformatics pipeline |
| **Digital twin** | No physiological model | A validated physiological model |
| **Explainable AI** | No live model | A real ML model to explain |
| **Emergency response** | Triage/handoff surfaces only | Integration with real emergency services (safety-critical) |

---

## 4. Security & cryptography (real)

All primitives are pure `node:crypto` / Web Crypto — no third-party crypto dependencies.

- **PHI envelope encryption** (`envelope.ts`) — AES-256-GCM, per-record random data-encryption keys wrapped by a key-encryption key (KEK), AAD binding, rotation-versioned.
- **Key custody** (`key-provider.ts`, `vault-key-provider.ts`, `key-codec.ts`) — pluggable `KeyProvider`; **HashiCorp Vault** KV-v2 provider (rotation-aware) is implemented and selected by config; env-based provider for dev. AWS/GCP KMS are drop-in behind the same seam. Boot hard-fails a production start without a durable key + TLS.
- **Tamper-evident audit chain** (`audit-chain.ts`, `audit-store.ts`, `pg-audit-store.ts`) — SHA-256 hash-linked entries, canonicalized, persisted; Postgres store is multi-process safe (sequence PK + insert-retry); public `verify()`.
- **Client-side selective E2E sealing** (`client-envelope.ts`, `client-field-encryption.ts`) — Web Crypto AES-GCM with a key derived from a wallet signature (HKDF), never sent to the server; wired into the vault symptom-note field so the most sensitive free-text is sealed on-device before it leaves the browser.
- **Zero-knowledge proofs** (`zk-membership.ts`) — a real 1-of-k OR-proof (Cramer–Damgård–Schoenmakers) over the order-q subgroup of a 3072-bit MODP safe prime, nothing-up-my-sleeve generators, domain-separated Fiat–Shamir. **Transparent setup — no trusted-setup ceremony, no toxic waste.** (Chosen deliberately over a Groth16/PLONK SNARK, whose single-party setup would be dishonest to ship.)
- **Secure multi-party computation** (`secret-sharing.ts`) — real (t, n) Shamir threshold scheme over GF(2¹²⁷−1); secure aggregation exploits additive homomorphism to reveal only the cohort total/mean; contributions are never stored.
- **IPFS content addressing** (`cid.ts`) — real spec-compliant CIDv1 (raw codec + sha2-256 multihash + base32), cross-validated against the canonical IPFS empty-file vector; encrypt-then-address (ciphertext is what gets a CID).
- **Perimeter** — Zod validation, distributed rate limiting, CORS, security headers (X-Frame-Options, COOP/CORP, locked Permissions-Policy, HSTS behind a prod flag), a production transport gate, and RFC 6238 TOTP MFA.

**Post-quantum note:** the underlying **Aethelred L1 (separate repo/node, in Go)** provides real post-quantum signatures (ML-DSA-65) and KEM (ML-KEM-768), default-on and NIST-ACVP-checked. Shiora is the health-application layer that runs on that ecosystem; the crypto listed above is Shiora's own data-layer crypto.

---

## 5. Six-audience model

A single RBAC role model + capability matrix gates every PHI/analytics route, so all six audiences are served from one backend with least-privilege enforcement:

- **Individuals** — records, vault (cycle/symptoms + analytics), consent, access grants, GDPR rights, transparency feeds, insights, SANA assistant.
- **Providers** — clinical notes (append-only + amendments), granted-record read (gated + audited), patient directory.
- **Researchers** — marketplace dataset requests, secure MPC cohort computation.
- **Governments** — data-request stewardship (approve/deny), population analytics.
- **Health plans / payers** — care-gap registry + closure analytics, population analytics.
- **Employers** — org/membership console, wellness programs + participation analytics.

---

## 6. Compliance posture (honest)

- **GDPR** — real DSAR: Access (Art.15), Portability (Art.20 with real JSON/CSV/XML serialization), Erasure (Art.17, cascading soft-delete + consent/grant revocation), plus a subject-side "who accessed my data" disclosure log.
- **HIPAA** — technical safeguards implemented and mapped to code (encryption at rest, audit controls, integrity, access control, authentication). We have authored our **own work product** (self-assessment / readiness), never the external attestation: `docs/compliance/` contains a HIPAA Risk Assessment (NIST 800-30), BAA templates + subprocessor register, a Penetration Test Plan (OWASP ASVS/Top-10 self-assessment), a SOC-2 readiness mapping (TSC CC1–CC9), and a SaMD assessment.
- **SaMD** — SANA and insights are engineered **non-diagnostic** by design; the SaMD assessment flags only the fertility-window prediction for counsel if we make contraception/conception claims.
- **Honesty boundary (important):** certifications (HIPAA/SOC-2/HITRUST) and any SaMD clearance are **auditor- and time-gated** — they cannot be produced by code and are **not claimed**. Our public copy now says "HIPAA-aligned, certification in progress," not "HIPAA compliant."

---

## 7. Frontend honesty pass (just completed)

Previously the app carried a polished but partly-fabricated demo shell: pages rendered seeded mock data and asserted "TEE-verified encryption on the Aethelred blockchain," "IPFS-pinned," "processed inside Intel SGX enclaves," fabricated transaction hashes/attestations, and fake platform stats ("2.1M TEE attestations"). None of that was real. In this cycle we made the user-facing app match the backend:

- **vault, records, access** — wired to the real encrypted `/api/*` endpoints (empty-until-authenticated); backend routes stopped fabricating cid/txHash/attestation; the access audit log now serves the **real** audit chain.
- **settings** — removed the fake "Network / TEE Enclave Preferences" tab and "fully HIPAA compliant / inside TEE enclaves" copy.
- **home** — removed ~5 fabricated showcase sections (TEE status, "AI models running inside secure enclaves," TEE health, fake platform stats, realtime chain bar); reframed the hero.
- **insights** — full rewrite from a fake "AI/ML predictions in TEE" showcase to real, non-diagnostic descriptive statistics over the user's own wearable data.
- **global** — removed the "TEE-verified" claim from the site-wide meta description (kept the Aethelred ecosystem identity, which is real).

**Fully-honest, real-data pages now:** vault, records, access, chat, settings, home, insights. Remaining demo surfaces are all honestly-labeled simulated features (genomics, twin, clinical, emergency, tee-explorer, marketplace/rewards/governance previews).

---

## 8. Tier-1 self-audit & remediation (just completed)

We ran an internal security review at Trail of Bits / OpenZeppelin stringency
against the full codebase and then remediated every finding with real
subsystems (no stubs), one commit per finding:

| ID | Severity | Finding | Remediation |
|----|----------|---------|-------------|
| H-01 | High | Rate limiting keyed on spoofable `x-forwarded-for` | Trusted-proxy hop resolution (`SHIORA_TRUSTED_PROXY_COUNT`) + per-account buckets for authenticated traffic |
| H-02 | High | Auth challenge redeemable multiple times within TTL | Single-use nonce store — atomic `INSERT … ON CONFLICT DO NOTHING RETURNING` (in-memory + Postgres) |
| M-01 | Medium | CSP allowed `script-src 'unsafe-inline'` | Per-request script nonces via edge middleware + `'strict-dynamic'`; per-request rendering; no-execution CSP on APIs. Live-verified on the production build (nonce stamped on all inline scripts, hydration clean, zero violations) |
| M-02 | Medium | Audit-chain hashes unkeyed (insider rewrite) | Chain MAC is now HMAC-SHA256 under a dedicated derived key |
| M-03 | Medium | No server-side session revocation | `jti` per token, revocation store (in-memory + Postgres), revoked-session rejection on every route, logout revokes server-side, `POST /api/me/sessions/revoke-all` signs out everywhere |
| L-01 | Low | Connect response fabricated balance/profile data | Response now carries only authentication facts; unknown balance renders as unknown (—), never an invented number |
| L-02 | Low | Signature malleability (high-S accepted) | Canonical low-S enforcement (BIP-62/Cosmos) for raw and DER submissions, fail-closed DER parsing |
| L-03 | Low | One secret reused across HMAC domains | HKDF-SHA256 (RFC 5869) domain separation: session / challenge / audit-chain keys |
| L-04 | Low | Client-supplied timestamp freshness check (theater) | Removed; freshness is enforced by the HMAC-bound challenge expiry + single-use nonce |
| I-02 | Info | Shamir field sampling margin (2^33) | 32-byte sampling per RFC 9380 sizing; bias < 2^-129 |

Informational items I-01 (wallet-header bypass: already default-off and
boot-gated in production), I-03 (origin fail-open on missing header: accepted,
mitigated by `sameSite` cookies), and I-04 (external review of custom
primitives) remain tracked; I-04 is part of the external-assurance gap below.

---

## 9. Testing & quality

- **239 suites / 4,005 tests / 100% coverage** (statements, branches, functions, lines) — enforced as a hard gate.
- TypeScript **strict** clean; ESLint clean; **0 dependency vulnerabilities** (`npm audit`).
- Test discipline includes an anti-drift maturity invariant test (fails CI if labels drift), Postgres adapters validated against a real Postgres/pglite out-of-band, and **live dev-server verification** after any edge/instrumentation change (Jest cannot catch edge-runtime bundling regressions).
- **Gap:** GitHub Actions CI is currently blocked on billing, so the gate runs locally/pre-push rather than in hosted CI. Standing up CI is a near-term item.

---

## 10. Deployment & infrastructure readiness

**Code-ready / config-gated (needs provisioning, not code):**

- Postgres datastore + versioned migrations (`migrator.ts`, `schema.ts`).
- HashiCorp Vault KEK custody (or AWS/GCP KMS behind the same seam) — needs a real Vault instance.
- TLS/HSTS + transport prod-gate — needs a reverse proxy / TLS termination + WAF.
- L1 audit anchoring — needs an Aethelred RPC target to flip from local WORM to on-chain.

**Documented:** `docs/DEPLOYMENT.md`, `docs/PRODUCTION_READINESS.md`, `.env.example` (documents `DATABASE_URL`, `SHIORA_DATA_ENCRYPTION_KEY(_VERSION)`, `SHIORA_VAULT_*`, `SHIORA_L1_*`, `SHIORA_ADMIN_ADDRESSES`, `SHIORA_ENABLE_HSTS`).

---

## 11. Known gaps, blockers & external dependencies

**Engineering, self-owned (candidates to harden next):**
1. Wearables: live vendor OAuth sync (Fitbit/Apple Health/Garmin).
2. FHIR: EHR-sandbox conformance (Epic/Cerner).
3. Alerts/research/community: wire the pilot surfaces to real pipelines.
4. Stand up hosted CI (unblock GitHub Actions billing).
5. Optional: wire remaining home-dashboard stat cards to real aggregate counts (currently illustrative values, no false claim).

**External / decision-gated (cannot be closed by code alone):**
1. **TEE attestation** — needs real enclave hardware + attestation service, or a decision to drop the TEE positioning entirely.
2. **On-chain anchoring / L1** — needs a live Aethelred L1 RPC target (pipeline is built).
3. **External security audit** (the standing AUD-2026-001/002 items).
4. **SOC-2 / HIPAA examination**, **signed BAAs**, **external pen test execution**, **SaMD counsel** — third-party/time-gated (our self-assessment docs are authored and ready to hand to auditors).
5. Live LLM provider key for SANA (offline deterministic stub is the default).

---

## 12. Open decisions we'd value the consultant's view on

1. **TEE strategy.** There is no TEE anywhere today, and we've now removed all TEE claims from the product. Options: (a) drop the TEE story permanently and lead with "encrypted at rest + client-side selective E2E + tamper-evident audit"; (b) build a real enclave deployment; (c) build only an attestation-*verifier* as an honest half-step. Which framing best serves the M42 pilot and investor narrative?
2. **On-chain story.** The Aethelred L1 is thesis-critical, but not yet a live target for Shiora. Do we (a) hold the "anchored to Aethelred" claim until the L1 is live, (b) ship local/pilot WORM anchoring now with honest "pilot" labeling, or (c) prioritize standing up the L1 target?
3. **Pilot → production sequencing.** Of the 10 pilot features, which 2–3 should we harden first for the M42 pilot? (Our lean: wearables OAuth + FHIR conformance, since they unlock real data ingestion.)
4. **SaMD scope.** Keep everything strictly non-diagnostic (current posture), or invest in a regulatory pathway for a specific clinical claim (e.g., fertility window)?
5. **Hardening vs. GTM.** How much of the remaining external-audit / SOC-2 / infra standup should precede the M42 pilot vs. run in parallel?

---

## 13. Our recommended focus (offered as input, not conclusion)

1. **Stand up the real infra the code already targets** — Postgres + Vault + TLS/WAF + hosted CI. Highest ratio of "unblocks production" to effort; needs provisioning, not new code.
2. **Pick the TEE and on-chain framing** (decisions 1–2) so the narrative is consistent and defensible in diligence.
3. **Harden wearables OAuth + FHIR conformance** to make the data-ingestion story real end-to-end for the pilot.
4. **Kick off the external security audit** against the now-honest codebase — the de-theatering pass materially de-risks this.
5. **Keep the honesty discipline** — it's a differentiator: every claim maps to code, and the maturity registry makes that auditable.

---

*Appendix — key source locations: crypto `src/lib/crypto/`, persistence `src/lib/persistence/`, maturity SSoT `src/lib/api/maturity.ts`, compliance docs `docs/compliance/`, architecture/audit `docs/ARCHITECTURE.md` + `docs/PLATFORM_AUDIT.md`.*
