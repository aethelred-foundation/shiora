# Shiora → Aethelred Testnet Integration Handoff

**Date:** 2026-07-12
**From:** Shiora app team
**To:** Aethelred testnet team (US)
**Purpose:** hand off Shiora's consensus-anchored seal tier for deployment to the Aethelred public testnet (chain 7332), on-chain validation, and independent testing.

**Branch:** `shiora/production-completion` (deploy only the exact release SHA
provided by the release owner)
**Bottom line:** Shiora is a healthcare SaaS that **anchors to** the chain rather than living on it. Exactly **one** contract deploys: `ShioraSealAttestation`. It is proven against the real ISeal precompile in the chain repo and 100%-covered locally. Everything else in `contracts/` is explicitly out of scope (§2).

> **Current operator source of truth:** this dated handoff preserves integration
> context. Use [`docs/PUBLIC_TESTNET_RUNBOOK.md`](docs/PUBLIC_TESTNET_RUNBOOK.md)
> and the two public-testnet environment templates for every fresh installation.

---

## 1. Canonical protocol identity (single source of truth: aethelred repo `ecosystem/manifest.json` v2.0.0)

- EVM chain id **7332** (testnet; devnet shares it), **7331** reserved for mainnet.
- Native token **AETHEL** (18 EVM decimals), base denom `uaethel`, bech32 prefix `aethel`.
- ISeal precompile at **`0x0900`** (IVerify `0x0901`, IPoUW `0x0902` reserved).
- Purpose strings are canonical **lowercase hex**.
- **Chain-side prerequisite:** the live network must report ISeal (`0x0900`) in
  `active_static_precompiles`. Use the read-only check in the canonical runbook;
  do not infer readiness from a branch name or binary filename.
- RPC endpoints are operator-supplied inputs. Use the approved EVM and consensus
  URLs; do not infer an endpoint from historical hostname examples.

## 2. Scope — deploy exactly one contract

The `contracts/` Hardhat project deliberately scopes compilation to `sources: "./seal"`:

- **IN scope:** `contracts/seal/ShioraSealAttestation.sol` (+ vendored `ISeal`
  interface). Its 24 contract tests pass and the integration is proven against
  the real precompile in the chain repo.
- **OUT of scope:** everything under `contracts/core`, `contracts/privacy`, `contracts/defi`. These are **design artifacts** — they compile (verified) but are untested and unwired. **Do not deploy them.** The project's green status vouches only for the seal tier; we will not claim otherwise.

## 3. What `ShioraSealAttestation` does

The consensus-anchored assurance tier for Shiora's health-data attestations. Elsewhere in the repo, `ShioraConsentManager` stores an unverified caller-supplied hash and `ShioraTEEVerifier` records self-signed enclave attestations — both bottom out in "trust this key." This contract replaces that trust with a **Digital Seal minted by the Aethelred validator quorum**:

- An attestation binds a **(subject address, scope hash)** pair — e.g. `keccak256("clinical:cycle_prediction")` — plus a pointer to the backing seal. **No PHI ever touches the chain.**
- A seal admits the attestation only if it is **ACTIVE**, its PoUW job purpose is `shiora:0x<subject>:0x<scope>` (the contract's `expectedPurpose(subject, scope)` returns the exact string), and it satisfies the governance-set **CEAP compliance policy** — all checked in-EVM via ISeal.
- **Anchoring is permissionless** (`attest` callable by anyone): the seal is self-authorizing because its purpose binds the exact (subject, scope).
- `isAttested` / `requireAttested` **re-check the seal's live ACTIVE status** on every read — a seal revoked on-chain (consent withdrawn, model decertified, jurisdiction change) invalidates the attestation instantly, with no transaction.
- **One (subject, scope), one attestation, forever** (`AlreadyAttested`): a governance revocation cannot be undone through the permissionless path by a second bound seal.
- Deliberately **non-upgradeable** — the attestation of record must not be admin-mutable. Governance surface is `Ownable2Step`; local `revoke(subject, scope)` is callable by the subject or the owner; `pause()` halts anchoring while verification reads stay live.

## 4. Deployment & validation (integration checklist)

Prereqs: node built from the precompile branch (§1), funded deployer key, `aethelredd` CLI access for PoUW job submission.

### 4.1 Deployment command

For a fresh public-testnet install, use the dedicated deployment script from
the canonical runbook. From `contracts/`, after populating and sourcing
`.env.public-testnet`:

```
cd contracts
npm ci
npm run compile
npm test
npm run deploy:public-testnet
```

The deployment-only inputs are
`AETHELRED_TESTNET_RPC_URL`, `SHIORA_DEPLOYER_PRIVATE_KEY`, and the five
`SHIORA_CEAP_*` policy values documented in
`contracts/.env.public-testnet.example`. The script deploys only
`ShioraSealAttestation`, configures and reads back the policy, and emits the
deployment manifest. `scripts/devnet-seal-attestation-e2e.js` remains a
post-deployment seal-flow validation tool; it is not the fresh-install entry
point.

There are no constructor parameters beyond governance, and no proxy. The
contract is deliberately non-upgradeable. Record the printed address as
`registry.address` in the §6 manifest.

1. **Gas/fee note (already encoded in `hardhat.config.js`):** Aethelred's EVM
   charges `max(actualGas, gasLimit/2)`, so do **not** pin a fixed `gas` —
   estimation is accurate; the config uses `gasMultiplier: 2` for headroom
   without overpaying.
2. **Record enforcement attestations** (§6) and report back (§7).

## 5. Enforced invariants you will observe on-chain

| Area             | Invariant                                                                           | Revert / effect              |
| ---------------- | ----------------------------------------------------------------------------------- | ---------------------------- |
| Anchoring        | No seal → no attestation (fail-closed)                                              | revert from `attest`         |
| Anchoring        | Seal purpose must bind **this exact** (subject, scope)                              | revert (purpose mismatch)    |
| Anchoring        | Seal must satisfy the live CEAP policy                                              | `PolicyNotSatisfied(reason)` |
| Permanence       | One (subject, scope), one attestation, forever                                      | `AlreadyAttested`            |
| Live seal check  | `isAttested` re-checks ACTIVE via ISeal — on-chain revocation invalidates instantly | —                            |
| Local revocation | `revoke` callable by subject or owner only                                          | `NotSubjectOrOwner`          |
| Ops              | `pause()` halts anchoring; verification reads stay live                             | `Pausable`                   |
| Privacy          | Only (address, hash) pairs on-chain — no PHI                                        | —                            |

## 6. Deployment manifest — enforcement attestations (record from live chain reads)

```
registry.address                  = <deployed ShioraSealAttestation>
registry.owner                    = governance (Ownable2Step accepted)
registry.compliancePolicy         = compliancePolicy()
chain.eth_chainId                 = 7332
chain.isealPrecompileVerified     = playbook fail-closed + attest() round-trip
firstAttestation                  = (subject, scope, sealId, JOB_ID)
```

## 7. App-side audit anchoring (disabled)

There is no dedicated ABI-compatible audit-anchor receiver for this
public-testnet deployment. Leave all four settings blank:

```
SHIORA_L1_RPC_URL=
SHIORA_L1_CHAIN_ID=
SHIORA_L1_ANCHOR_FROM=
SHIORA_L1_ANCHOR_TO=
```

`ShioraSealAttestation` does not implement the application's raw audit-root
receiver interface. Never use its address as `SHIORA_L1_ANCHOR_TO`. Audit roots
remain in the local hash-chained/WORM outbox until a dedicated target is
implemented and reviewed.

## 8. Test evidence & report-back

- **Definitive seal-binding proof (chain repo):** `internal/evmhost/shiora_test.go` — this exact bytecode against the **real ISeal precompile + real seal keeper**, incl. live revocation and re-attest permanence (on `release/public-testnet-pqc`).
- **This repo:** all 24 seal-tier contract tests pass; the full application
  coverage gate passes 303 suites and 4,814 tests at 100% statements, branches,
  functions, and lines.
- **Report back:** deployed address, `eth_chainId`, the §6 manifest, the sealed `JOB_ID`, and any behavioral deltas vs §5.

## 9. App-side setup & wallet testing (added 2026-07-15)

The app now authenticates exclusively with the **Aethelred Wallet** (EIP-1193
injected provider, EIP-191 `personal_sign` challenge). Deploy from the approved
SHA on `shiora/production-completion`.

### 9.1 Prerequisites

- Node.js 20+, npm
- Postgres 15+ for the supported fresh installation. In-memory mode is
  non-durable and is not the deployment described by the canonical runbook.
- The Aethelred Wallet browser extension, configured with chain `7332`. The app
  requests the official chain when necessary and fails closed if the provider
  remains on another chain.

### 9.2 Setup

```bash
git fetch origin shiora/production-completion
git checkout --detach <approved-release-sha>
npm ci
cp .env.public-testnet.example .env.local
```

Populate `.env.local` exactly as described in
[`docs/PUBLIC_TESTNET_RUNBOOK.md`](docs/PUBLIC_TESTNET_RUNBOOK.md). Generate
secrets in the shell and paste only their resulting values into the file; an
env file does not execute command substitutions.

Leave every `SHIORA_L1_*` field blank. There is no compatible audit-anchor
receiver yet, and `ShioraSealAttestation` must never be used as
`SHIORA_L1_ANCHOR_TO`.

```bash
npm run build                                    # assembles the standalone bundle
SHIORA_PREFLIGHT_MODE=evaluation PORT=3001 npm run start:standalone
```

Environment for standalone runs: the standalone server reads env files from
its own directory, not the repo root — `start:standalone` therefore re-runs
the prepare step, which copies your repo-root `.env`/`.env.local`/
`.env.production` into `.next/standalone/` at every start. Keep your
configuration in the repo-root `.env.local` as usual (SHIORA_SESSION_SECRET
and SHIORA_DATA_ENCRYPTION_KEY are required in every production run —
evaluation mode never waives them), or export the variables in the shell.

Two things to know about production runs:

- `next start` refuses `output: standalone` builds. Use
  `npm run start:standalone`; the build's postbuild step copies the static
  assets into the standalone tree automatically.
- Production boots are gated by a PHI-readiness preflight (Vault Transit
  custody, HSTS/TLS, TLS backends, durable Postgres). A testnet evaluation
  that does not custody real patient data acknowledges those infrastructure
  gates with `SHIORA_PREFLIGHT_MODE=evaluation`; the acknowledged gaps are
  printed at boot and visible on `GET /api/health/ready`
  (`config.mode: "evaluation"`). Dev crypto keys, placeholder secrets, auth bypasses and
  mainnet targets remain fatal even in evaluation — keep the session secret
  and data key set to real random values.

### 9.2.1 If every API returns 500 (incl. /api/wallet/challenge)

When `DATABASE_URL` is set, rate limiting and the data stores run on
Postgres for **every** request — an unreachable Postgres therefore breaks all
endpoints at once. The app now answers a structured `503
DATASTORE_UNAVAILABLE` (with `Retry-After`) in that state; if you see it,
check Postgres from the app host:

```bash
psql "$DATABASE_URL" -c 'SELECT 1'
```

Either fix the connection or unset `DATABASE_URL` (evaluation mode then runs
on the non-durable in-memory store — fine for wallet-flow testing, data is
lost on restart).

With a reachable Postgres, the schema is created/updated automatically at
boot (forward-only, version-tracked migrations — the boot log prints
`[db] applied schema migrations: …` on first run). No manual migration
command is needed; a pipeline that wants to own migrations can set
`SHIORA_AUTO_MIGRATE=false`.

### 9.3 Transport & session cookies

Session cookies follow the preflight tier: production builds set the `Secure`
flag (browsers drop such cookies over plain `http://<VPS-IP>`, so login would
appear to succeed and then every request stays 401 — the app now detects this
and says so at connect time). Under `SHIORA_PREFLIGHT_MODE=evaluation` the
Secure flag is relaxed along with the already-acknowledged transport gate, so
wallet sessions work directly on a plain-HTTP VPS origin. For any
non-evaluation deployment, TLS (or an SSH tunnel to localhost) remains
mandatory.

Port `3001` is canonical for the combined application/API process. Do not edit
`package.json` or run a second backend service on another port; the prepare
step in `start:standalone` must keep running.

### 9.2.2 Run as a background service (systemd)

`deploy/systemd/shiora.service` is a ready template — adjust the user/paths
per its comments, then:

```bash
sudo cp deploy/systemd/shiora.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now shiora
journalctl -u shiora -f   # logs
```

The service restarts automatically on crash and on server reboot.

### 9.3.1 Suggested testing flow (evaluation deployment)

1. **Connect:** Connect Wallet → Aethelred Wallet or MetaMask → sign the
   EIP-191 challenge. The header shows your address; a dropped-session error
   here means the tier/transport rules above were violated.
2. **Vault:** Records → register a health-record metadata entry; Vault → log a
   cycle/symptom entry. The current pilot encrypts and persists the metadata at
   rest but does **not** retain the selected file bytes, so file-content testing
   is outside this flow.
3. **Access:** open **Platform → Access Control** (or the dashboard's
   "Manage Access" quick action — route `/access`) → **Grant Access** →
   pick a provider, enter the provider's real 0x address, and choose
   scope/permissions/duration → **Sign & Grant Access** → approve the EIP-191
   message in the same wallet used for the session. This authorizes the exact
   off-chain RBAC grant; it is **not** a blockchain transaction and costs no
   gas. Success appears only after the server verifies the payload-bound,
   single-use signature. The grant appears under Access Grants and the event
   lands in the Audit Log tab. Revoke from the grant's detail view.
4. **Audit:** every read/write lands in the tamper-evident audit trail
   (Access page); `GET /api/health/ready` shows overall config/datastore
   status and the evaluation acknowledgments.
5. Simulated surfaces (Attestation Tooling, clinical previews) are labeled
   as such by design — they are not test failures.

### 9.3.2 Access-grant validation boundaries

- The caller must have a valid, non-revoked wallet session and pass origin and
  rate-limit middleware.
- The grant requires a non-zero provider 0x address different from the owner,
  a provider name and specialty, one of the supported data scopes, a duration
  of 1–365 days, and a meaningful permission set.
- The wallet authorization is valid for five minutes, is HMAC-bound to every
  normalized grant field and the session owner, and can be redeemed once.
- Provider record reads enforce grant status, expiry, view permission, owner,
  provider address, and the selected record scope. Unknown scopes fail closed.
- A grant is scope-based, not tied to a particular record ID or uploaded file;
  the contents of a selected image do not participate in grant validation.

### 9.4 What to verify

```bash
npx tsc --noEmit && npx jest --silent   # expect 299 suites / 4713 tests green
curl -s http://localhost:3001/api/system/release | head -c 400
```

In the browser: Connect Wallet → Aethelred Wallet prompt → EIP-191 signature →
session established; Vault / Records / Access pages start empty (by design —
no seeded theater) and fill as you create records. Access-page audit entries
are served from the real audit chain.
