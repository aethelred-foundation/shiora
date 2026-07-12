# Shiora — Production-Readiness Status Report

**Date:** 2026-07-11 (post-remediation edition)
**Repo:** `github.com/aethelred-foundation/shiora` (private)
**Working branch:** `feat/backbone-phi-encryption-audit` (164 commits ahead of `main`, pushed, `HEAD = 95cf956`)
**Prepared for:** external consultant review — a point-by-point response to your production-readiness assessment, and a request for direction on what to prioritize next.
**Supersedes:** the 2026-07-11 platform status report you reviewed.

---

## 0. How to read this report

You gave us a detailed production-readiness assessment: an executive verdict, a P0 pre-pilot table, eleven numbered recommendations, Aethelred/dApp guidance, answers to our eight open decisions, a 60-day plan, and a seventeen-item final go/no-go gate. This report is organized around **your** structure, so you can see exactly where each item stands and give focused feedback.

**The one-line status:** we accepted your verdict and executed the **code-actionable** work — every P0 that can be closed in the codebase is closed, at 100% test coverage, on one authoritative branch. What remains is almost entirely **operator/organizational** (provisioning, independent auditors, ADHICS/DPIA approval, a named FHIR partner, CI billing) — the things that, by your own framing, code cannot produce. We are asking you to confirm that reading and help us sequence the human work.

**Honesty note we want to be explicit about:** "built and tested" is not "run in production." The Vault Transit custody path, break-glass flow, recovery codes, and chain anchoring are all implemented and verified in tests, but they have not yet run against a provisioned Vault, a real clinical workflow, or a live chain. We flag each of these below rather than let "done in code" read as "proven in production."

---

## 1. Current metrics (live-verified from the branch)

| Metric | Value |
|---|---|
| Test suites / tests | **297 / 4,711**, all passing |
| Coverage (statements, branches, functions, lines) | **100%** — enforced as a hard gate |
| TypeScript strict | clean |
| ESLint | clean |
| Production build (`next build`) | green |
| Dependency vulnerabilities (`npm audit`) | **0** |
| API routes | 166 |
| Feature maturity | 26 production · 10 pilot · 7 simulated (machine-readable registry, CI-enforced) |
| Secret scan (gitleaks, full 151-commit history) | 0 real secrets (4 intentional test-PKI keys allowlisted) |

Since your review the suite grew **4,459 → 4,711 tests** across ~15 commits, coverage held at 100% throughout, and every commit is authored to a single owner with no divergence on `main` (a clean fast-forward when we merge).

---

## 2. The most urgent issue — public truth & release provenance (your P0)

You called the claims/implementation mismatch the top launch blocker. You were right, and auditing our own branch against it was uncomfortable — the findings were real. Status: **closed in code.**

- **Reconciled the public claims.** The README still asserted "13 smart contracts deployed to testnet," carried **fabricated performance figures** ("TEE Attestation Verify: 320 ms"), a HIPAA badge, and TEE/on-chain/IPFS capability claims. All removed; the README now states the pre-production posture and defers to `GET /api/system/status`. `docs/DEPLOYMENT.md` was rewritten to the real system (it had documented nonexistent `JWT_*`/`TEE_*` variables).
- **Killed the mainnet default.** `next.config.js` and `.env.example` defaulted `NEXT_PUBLIC_RPC_URL` to an Aethelred **mainnet** endpoint. Removed. A new **production config linter** now makes any mainnet RPC target or non-testnet chain id a hard release blocker (§4, item 3).
- **Synthetic fixtures.** The `.shiora-data/state.json` file (fabricated provider/transaction/attestation values from the pre-encryption era) was removed from tracking and gitignored; no code has read it since the mock store was deleted.
- **Full-history secret scan.** `gitleaks` v8.30.1 over all 151 commits: 7 findings, **all benign** (4 intentional attestation test-PKI keys — now allowlisted in `.gitleaks.toml` — one docs placeholder, two historical synthetic ids). **No real secret, credential, or PHI anywhere in history**, so no history rewrite is required. Recorded in `docs/RELEASE_PROCESS.md`.
- **Release provenance.** `GET /api/system/release` now self-reports version, git SHA (stamped at build), build time, migration version, OpenAPI-contract hash, maturity-registry hash, container digest, and the anchoring chain id — so an auditor can compare the running system to the release record. Signed containers + SBOM are wired into CI (§4, item 3).
- **Authoritative source.** Everything lives on one branch; `main` is a strict ancestor. **Merging to `main` and enabling branch protection are the two actions we are holding for your/our sign-off** — they are governance decisions, not code (see §7).

---

## 3. Your P0 pre-pilot table

| Your required action | Status | Where |
|---|---|---|
| Freeze a narrow pilot scope | ✅ **Done (code)** — `SHIORA_PROFILE=pilot` serves only the corridor; 27 deferred segments return `503 FEATURE_DISABLED` at the middleware | `docs/PILOT_SCOPE.md`, `src/lib/api/feature-flags.ts` |
| Hosted CI/CD & protected releases | ◑ **Workflow ready; hosting blocked** — unit + E2E + secret-scan + config-lint + SBOM jobs committed; **GitHub Actions billing is an operator unblock** | `.github/workflows/ci.yml` |
| Production-like staging | ○ **Operator** — Postgres/KMS/TLS/WAF/workers must be provisioned; code targets them and boot-fails without them | `docs/DEPLOYMENT.md` |
| Independent security review | ○ **Not started** — we accept your staged scoping (§6.1); needs firm engagement | — |
| Identity & account recovery | ✅ **Done (code)** — one-time recovery codes + break-glass with retrospective review (§5.4) | `src/lib/api/recovery-service.ts`, `break-glass-service.ts` |
| Tenant & authorization isolation | ◑ **Owner-scoping + negative-space suite done; row-level tenant column is the next step** (§5.5) | `src/__tests__/security/negative-space.test.ts` |
| Backup & disaster recovery | ○ **Operator** — restore exercise + RTO/RPO must be performed; crypto-shred/backup interplay documented | `docs/KEY_MANAGEMENT.md`, `DEPLOYMENT.md` |
| UAE health/privacy readiness (ADHICS, DPIA) | ○ **Organizational** — self-assessment work product exists; formal approval is external | `docs/compliance/` |
| FHIR partner conformance | ○ **Needs a named partner** — parser is real; conformance is defined by the partner's guide | — |
| Chain & TEE isolation | ✅ **Done (code)** — anchoring is a fail-soft async outbox; no chain/enclave outage can touch care (§5.6) | `src/lib/api/anchoring/` |
| Multi-replica correctness (P1) | ✅ **Done (code)** — shared WebAuthn challenge store + durable notification replay (§5.2) | `src/lib/persistence/challenge-store.ts` |
| Clinical & AI governance (P1) | ○ **Deferred by scope** — live SANA/CDS disabled under the pilot profile until governance exists | `docs/PILOT_SCOPE.md` |

Legend: ✅ closed in code · ◑ partially done, remainder is operator/organizational · ○ operator/organizational (code cannot close it).

---

## 4. Your eleven recommendations — item by item

**1. Stop adding features; define one production slice.** ✅ Done. The pilot corridor is exactly your recommended list (onboarding + recovery, FHIR ingestion, encrypted records, time-bound consent, verified provider access, append-only notes, patient-visible access history, export/correction/erasure, notifications, optional anchoring) plus a break-glass path. Everything else is server-disabled. MBZUAI research is documented as a **separate environment/governance path**, not a scope widening.

**2. Change the production key-management design.** ✅ Done in code, ○ needs a Vault to run. We built the `DekWrapper` seam and a complete, tested **Vault Transit** backend — the app submits each DEK for wrap/unwrap and the master key never enters process memory — and then **adopted it through the entire PHI envelope path** (envelope → both encrypted repositories → the re-seal job → the IPFS object service are now async and wrap every DEK through `getDekWrapper()`). Configuring Transit switches the whole write path onto Vault custody with no code change; mixed-custody reads are handled by a `sealed.wrap` discriminator so a cut-over is safe and reversible. The formal key architecture — key inventory + HKDF domains, per-environment separation, rotation + back-catalog re-seal, compromise runbook (Transit token revocation = total cut-off), two-person rule, backup/crypto-shred interplay — is in `docs/KEY_MANAGEMENT.md`. **Remaining:** run it against a provisioned Vault; AWS/GCP KMS are drop-in behind the same interface. We also documented your wallet-derived-client-key caveat and the passkey/WebAuthn-PRF production direction.

**3. Independently review or replace in-house standards implementations + add tests + fix CI.** ◑ Partly. Test depth and CI hardening are done: added the **negative-space authorization suite**, a **production config linter** (fails on in-memory storage, non-TLS endpoints, debug flags, placeholder secrets, wildcard origins, or a mainnet/foreign chain id — as a boot gate *and* a CLI), **gitleaks** over full history, and a **CycloneDX SBOM**, all in the release gate. **Not yet done and we agree it is the highest-value external item:** independent applied-crypto review of our in-house primitives (envelope/KDF, WebAuthn/CBOR/COSE, ZK, Shamir MPC, SEV-SNP verifier). We accept your point that "in-house" is not inherently safer; the config-lint/SBOM/secret-scan gates are in place, but property-based/fuzz/mutation testing and the independent review are open. See §8, Q1.

**4. Healthcare-grade identity, not only wallet auth.** ✅ Individuals side done; ○ provider SSO is operator/integration. We shipped one-time **recovery codes** (10 per batch, Crockford-base32, salted-scrypt hashes sealed at rest, single-use, regeneration replaces the batch) and a deliberate **break-glass** model (§5.4). **Provider enterprise OIDC/SAML SSO, SCIM provisioning, and licence verification remain** — they are pilot-partner integrations, not standalone code, and we'd scope them to the actual partner.

**5. Move beyond RBAC to tenant/purpose/consent enforcement.** ◑ Partly. Owner-scoping is enforced on every PHI object and now backed by an adversarial **negative-space suite** (provider A can't use provider B's grant, revoked/expired grants block immediately, cross-owner record ids are unaddressable, employer tenants are isolated, research approvals can't be reused). **Remaining:** explicit per-object tenant identifiers with database row-level security, and purpose-of-use / legal-basis snapshots attached to each access. We'd like your view on whether RLS is a pre-pilot gate or a fast-follow (§8, Q2).

**6. Provision the operational platform now.** ○ Operator. Multi-replica correctness — which you correctly called pre-pilot, not a scaling optimization — **is done in code**: the per-instance WebAuthn challenge cache is replaced by a shared, atomically-single-use store (Postgres under load), and notifications now replay losslessly on reconnect. The rest (managed Postgres HA + PITR, KMS/Vault, private networking, WAF, log/metric platforms, durable workers, backup storage, IaC) is provisioning we cannot do from the repo.

**7. Analytics/research privacy.** ○ Deferred by scope. Population analytics and the research marketplace are disabled under the pilot profile, so l-diversity / query budgets / differential privacy are not pilot-blocking. We noted your guidance for when we re-enable them.

**8. Clinical & AI safety before SANA expansion.** ✅ Enforced by scope. Live SANA (chat + API) and clinical decision support are server-disabled under `pilot`; fertility-window prediction stays off. The intended-use / safety-case / evaluation apparatus is a precondition we've written into the scope doc for re-enablement.

**9. Arabic & accessibility scope.** ◑ Engine done; medical/legal review is a human step. Full i18n engine + app-wide RTL is shipped and the E2E suite runs axe scans in both directions. **Human medical/legal review of the core patient/consent/safety/recovery flows in Arabic, plus manual screen-reader/keyboard testing with Arabic-speaking users, remains** — we agree "shell plus a few flows" is not enough for consent/safety text.

**10 & 11 (FHIR, above; analytics, above)** — folded into items 5–8.

---

## 5. What we built since your review (the engineering detail)

**5.1 Release provenance & config safety.** `GET /api/system/release` manifest; a pure, dependency-free **production config linter** wired into the boot preflight and a release CLI; an authoritative `docs/RELEASE_PROCESS.md` release-candidate gate.

**5.2 Multi-replica correctness (your P1, treated as pre-pilot).** WebAuthn challenges moved to a shared `ChallengeStore` (in-memory / Postgres) with atomic single-use `DELETE … RETURNING` and ceremony-scoped slots, replacing the per-instance cache. SSE notifications honor `Last-Event-ID` and **replay missed events from the durable store** on reconnect — a restart or failover never drops a notification (at-least-once; clients de-duplicate).

**5.3 Key custody (your #2).** Vault Transit seam **adopted through the whole PHI path** (§4.2).

**5.4 Healthcare identity (your #4).** One-time **recovery codes** (salted-scrypt, single-use, sealed at rest). **Break-glass** emergency access, explicitly modeled on HIPAA §164.512(j): the clinician must declare a reason and patient context, pass a fresh MFA step-up, the grant is read-only and expires within one hour, the declaration and **every read** land on the tamper-evident audit chain with both actor and subject dimensions (so the patient sees it in their own access history), the patient is **notified immediately**, and every use enters a **retrospective-review queue** where an adverse review closes the grant on the spot. Both are deliberately inside the pilot corridor — a care pilot cannot ship without a recovery path and an emergency path.

**5.5 Tenant isolation (your #5).** Adversarial **negative-space suite** (13 denial invariants) as a standing regression tripwire.

**5.6 Chain anchoring, rebuilt to your spec (your dApp section).** Anchoring is now a **transactional outbox**: creating a job row atomically fixes the audit-chain segment `[fromSeq, toSeq]` and an off-chain salt, so the job can never drift from the data it covers. A fail-soft worker Merkle-roots the signed segment and publishes **only `sha256(salt ‖ root)`** — **no subject addresses, no record ids, no guessable scope hashes reach the chain.** Jobs move `queued → submitted → confirmed → failed → dead`, with bounded exponential-backoff retries and a loud dead-letter; a submission is only `confirmed` after the network returns a success receipt, so **an unconfirmed anchor is never reported as anchored** and **a fabricated tx hash is impossible**. The whole path is asynchronous, so no L1 outage, empty relayer, or contract pause can touch a healthcare operation — verified by test. The outbox row retains the salt as the auditor's off-chain record for verifying an on-chain commitment.

---

## 6. Aethelred / dApp recommendations — status

- **Keep healthcare state off-chain and authoritative.** ✅ The database is the source of truth; the chain provides evidence only, via the fail-soft outbox (§5.6). The app is fully usable if the RPC is down, delayed, unfunded, paused, reset, or migrating — by construction.
- **Avoid subject addresses and guessable scope hashes on-chain.** ✅ Anchoring now publishes salted Merkle-root commitments only. **Caveat we want to flag:** the earlier `ShioraSealAttestation` contract (a separate, chain-proven artifact, not wired into the app) stores a subject address + scope hash. Under your guidance that surface should not be used for a women's-health workflow as-is; the commitment scheme in §5.6 is the pattern we intend to standardize on. We'd value your read on whether to retire/replace that contract before any on-chain pilot (§8, Q3).
- **One flow before pilot.** ✅ Built: periodically anchor a privacy-preserving root of a signed audit-log segment, with an off-chain salt an auditor can use to verify existence. **Not yet run against a live testnet** (needs an RPC target).
- **Contract & relayer hardening; TEE.** ○ Independent contract audit, multisig ownership, relayer-key HSM, and any real TEE workload remain deferred — consistent with your "defer broad TEE" recommendation. The attestation **verifier** is built; we are not claiming attested processing.

---

## 7. Your seventeen-item final go/no-go gate

| # | Gate | Status |
|---|---|---|
| 1 | One exact release commit, independently reviewable & reproducible | ✅ provenance manifest + release process; **needs `main` merge + branch protection (governance sign-off)** |
| 2 | Public claims match the release | ✅ done |
| 3 | Hosted CI/CD & protected release controls mandatory | ◑ workflow ready; **CI billing + branch protection = operator** |
| 4 | No unresolved critical/high external security findings | ○ **external review not yet started** |
| 5 | All retained custom crypto independently reviewed | ○ **not started — our top external ask (§8, Q1)** |
| 6 | Production keys in KMS/HSM or Vault Transit | ✅ code adopted; ○ **needs a provisioned Vault to run** |
| 7 | Cross-tenant & object-level authz tests pass | ◑ negative-space suite passes; **RLS tenant column pending** |
| 8 | Wallet/passkey loss & provider de-provisioning handled | ◑ recovery + break-glass done; **provider SSO/de-provisioning pending** |
| 9 | Full backup restoration + IR exercise succeeded | ○ **operator exercise** |
| 10 | RTO/RPO/SLOs/on-call approved | ○ **organizational** |
| 11 | ADHICS/DPIA/data-location/contracts approved | ○ **organizational** |
| 12 | FHIR conformance passes with the actual partner | ○ **needs a named partner** |
| 13 | Arabic core flows have human medical/legal review | ○ **human review pending** |
| 14 | AI features have clinical governance or stay disabled | ✅ disabled under pilot scope |
| 15 | Aethelred integration optional, async, privacy-preserving | ✅ done (§5.6) |
| 16 | No PHI or linkable patient-health relationship on-chain | ✅ salted commitments only (contract caveat, §6) |
| 17 | TEE language does not overclaim | ✅ verifier-only; no attested-processing claim |

**Tally:** of 17 gates, **6 are closed in code**, **4 are partially closed with a defined remaining step**, and **7 are operator/organizational** (independent audit, provisioning, backup exercise, RTO/RPO, ADHICS/DPIA, FHIR partner, Arabic human review). None of the remaining seven can be closed inside the repository — which is the crux of what we want your guidance on.

---

## 8. What we're asking you

1. **Independent crypto review — scope & shortlist.** You flagged our in-house primitives (envelope/KDF, WebAuthn/CBOR/COSE, ZK, Shamir, SEV-SNP verifier) as the highest-risk custom surface. We accept your staged, overlapping model (crypto/auth first, then app/cloud, then contracts). Would you shortlist firms with a health-data + applied-crypto profile, and confirm whether an exact release SHA per workstream is the right freeze granularity?

2. **Tenant isolation depth for pilot.** Is database row-level security (explicit tenant column + RLS) a **pre-pilot** gate, or an acceptable **fast-follow** given owner-scoping is enforced in the app layer and covered by the negative-space suite? A narrow single-tenant pilot may not need RLS on day one.

3. **The `ShioraSealAttestation` contract.** It's chain-proven but stores a subject address + scope hash and is **not** wired into the app. Do we retire/replace it with the salted-commitment pattern before any on-chain pilot, or keep it out of scope entirely and anchor only via the new outbox?

4. **Sequencing the seven operator/organizational gates.** Given the code side is largely closed, what is your recommended order and parallelism for: provisioning staging (which also unlocks a real perf baseline), engaging auditors, ADHICS/DPIA, and securing a FHIR partner — over what you estimated as a 6–8 week window?

5. **Merge & protect now?** We are holding the `main` merge and branch-protection enablement for explicit sign-off. Do you want those done now (so the release SHA is stable for auditors), or after the external review begins?

---

## 9. Our recommended next steps (offered as input, not conclusion)

1. **Merge to `main`, enable branch protection, unblock CI billing** — cheap, unblocks a stable release SHA and hosted gating for everyone downstream.
2. **Provision staging** (Postgres + Vault + TLS/WAF) — unlocks the real Vault-Transit custody path, a production perf baseline, and the backup-restore exercise in one move.
3. **Engage the applied-crypto reviewer first** (your staged model) against the frozen SHA — the honest, gap-closed, 100%-covered codebase is the cheapest audit surface we'll ever present.
4. **Secure the FHIR pilot partner** and scope provider SSO + FHIR conformance + Arabic clinical-content review to that partner.
5. **Keep the honesty discipline** — every claim maps to code, the maturity registry + config linter enforce it in CI, and it has now survived a de-theatering pass, a 28-gap program, and your full assessment without regressing.

---

## Appendix — where to verify

| Area | Location |
|---|---|
| Release provenance | `GET /api/system/release`, `docs/RELEASE_PROCESS.md` |
| Config linter (boot + CLI) | `src/lib/api/config-lint.ts`, `npm run config:lint` |
| Pilot scope freeze | `docs/PILOT_SCOPE.md`, `src/lib/api/feature-flags.ts`, `GET /api/system/status` |
| Key custody (Vault Transit, adopted) | `src/lib/crypto/dek-wrapper.ts`, `envelope.ts`, `docs/KEY_MANAGEMENT.md` |
| Recovery codes & break-glass | `src/lib/api/recovery-service.ts`, `break-glass-service.ts`, routes under `/api/me/recovery`, `/api/break-glass` |
| Multi-replica correctness | `src/lib/persistence/challenge-store.ts`, `src/lib/api/notification-stream.ts` |
| Anchoring outbox (salted commitments) | `src/lib/api/anchoring/`, `src/lib/persistence/anchor-outbox-store.ts` |
| Negative-space authz suite | `src/__tests__/security/negative-space.test.ts` |
| Gap ledger (28/28) | `docs/TECHNOLOGY_GAP_ASSESSMENT.md` |
| Maturity registry (SSoT) | `src/lib/api/maturity.ts` |
