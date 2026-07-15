# Shiora → Aethelred Testnet Integration Handoff

**Date:** 2026-07-12
**From:** Shiora app team
**To:** Aethelred testnet team (US)
**Purpose:** hand off Shiora's consensus-anchored seal tier for deployment to the Aethelred public testnet (chain 7332), on-chain validation, and independent testing.

**Branch:** `feat/backbone-phi-encryption-audit` @ `163c67b` (open as PR #9; pull the latest tip)
**Bottom line:** Shiora is a healthcare SaaS that **anchors to** the chain rather than living on it. Exactly **one** contract deploys: `ShioraSealAttestation`. It is proven against the real ISeal precompile in the chain repo and 100%-covered locally. Everything else in `contracts/` is explicitly out of scope (§2).

---

## 1. Canonical protocol identity (single source of truth: aethelred repo `ecosystem/manifest.json` v2.0.0)

- EVM chain id **7332** (testnet; devnet shares it), **7331** reserved for mainnet.
- Native token **AETHEL** (18 EVM decimals), base denom `uaethel`, bech32 prefix `aethel`.
- ISeal precompile at **`0x0900`** (IVerify `0x0901`, IPoUW `0x0902` reserved).
- Purpose strings are canonical **lowercase hex**.
- **Chain-side prerequisite:** the ISeal precompile exists only on chain builds cut from `release/public-testnet-pqc` (aethelred PR #153). Neither `main` nor `release/testnet-v1.0` contains it as of this date. Build the node binary from that branch (or its merged successor) or seal-anchored attestation will fail (fail-closed, by design).
- RPC endpoint: provided by the US team. The ecosystem docs currently disagree on hostname convention (`evm-rpc-testnet.aethelred.network` vs `rpc.testnet.aethelred.io`); neither resolves yet — please pick one and update the manifest.

## 2. Scope — deploy exactly one contract

The `contracts/` Hardhat project deliberately scopes compilation to `sources: "./seal"`:

- **IN scope:** `contracts/seal/ShioraSealAttestation.sol` (+ vendored `ISeal` interface). Tested (21/21, 100% statement coverage of the seal tier) and proven against the real precompile in the chain repo.
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

The operator playbook **is** the deployment command — it deploys the contract,
sets the CEAP policy, proves fail-closed behavior, and (once a seal exists)
completes the first attestation. From the `contracts/` directory (`npm ci`
once; compilation happens automatically):

```
cd contracts
RPC_URL=<testnet-evm-rpc> \
DEPLOYER_KEY=0x<funded-64-hex-key> \
npx hardhat run scripts/devnet-seal-attestation-e2e.js --network aethelredDevnet
```

The `aethelredDevnet` network entry is pinned to chain id 7332 (testnet and
devnet share it) and reads both variables from the environment. Parameters:

| Env var | Default | Meaning |
|---|---|---|
| `DEPLOYER_KEY` | — (required) | 0x-prefixed funded key; the deployer becomes **governance/owner** (Ownable2Step — transfer + accept later to move it) |
| `RPC_URL` | `http://127.0.0.1:8545` | EVM JSON-RPC of your testnet node |
| `REGISTRY_ADDRESS` | — | Reuse an already-deployed `ShioraSealAttestation` instead of deploying (idempotent re-runs) |
| `SUBJECT` | deployer | The subject address for the demonstration attestation |
| `SCOPE` | `clinical:cycle_prediction` | Scope label; the script hashes it (`keccak256`) |
| `JOB_ID` | — | A sealed PoUW job id; without it the run stops after proving no-seal-no-attestation and prints the exact `aethelredd` mint commands |

There are no constructor parameters beyond governance, and no proxy — the
contract is deliberately non-upgradeable. Record the printed address as
`registry.address` in the §6 manifest.
   - Deploys `ShioraSealAttestation(governance)` (or reuses `REGISTRY_ADDRESS`), sets a CEAP policy via `setCompliancePolicy(allowedBackends, minVerification, allowedPlatforms, requireVendorRoot, dataResidency)`.
   - Proves `isAttested(subject, scope) === false` with no seal (**no-seal-no-attestation**), then prints the exact `aethelredd` PoUW commands — embedding the contract's own `expectedPurpose()` — for your operators to mint the seal.
   - Re-run with `JOB_ID` once the quorum has sealed the job: it calls `attest(subject, scope, jobId)` and confirms `isAttested` flips true.
2. **Gas/fee note (already encoded in `hardhat.config.js`):** Aethelred's EVM charges `max(actualGas, gasLimit/2)`, so do **not** pin a fixed `gas` — estimation is accurate; the config uses `gasMultiplier: 2` for headroom without overpaying.
3. **Record enforcement attestations** (§6) and report back (§7).

## 5. Enforced invariants you will observe on-chain

| Area | Invariant | Revert / effect |
|---|---|---|
| Anchoring | No seal → no attestation (fail-closed) | revert from `attest` |
| Anchoring | Seal purpose must bind **this exact** (subject, scope) | revert (purpose mismatch) |
| Anchoring | Seal must satisfy the live CEAP policy | `PolicyNotSatisfied(reason)` |
| Permanence | One (subject, scope), one attestation, forever | `AlreadyAttested` |
| Live seal check | `isAttested` re-checks ACTIVE via ISeal — on-chain revocation invalidates instantly | — |
| Local revocation | `revoke` callable by subject or owner only | `NotSubjectOrOwner` |
| Ops | `pause()` halts anchoring; verification reads stay live | `Pausable` |
| Privacy | Only (address, hash) pairs on-chain — no PHI | — |

## 6. Deployment manifest — enforcement attestations (record from live chain reads)

```
registry.address                  = <deployed ShioraSealAttestation>
registry.owner                    = governance (Ownable2Step accepted)
registry.compliancePolicy         = compliancePolicy()
chain.eth_chainId                 = 7332
chain.isealPrecompileVerified     = playbook fail-closed + attest() round-trip
firstAttestation                  = (subject, scope, sealId, JOB_ID)
```

## 7. App-side anchoring (config only — the US team provides values, Shiora hosts the app)

The SaaS anchors audit roots to L1 through a node-held account (server-side `eth_sendTransaction`; **no client-side key handling**). The US team supplies:

```
SHIORA_L1_RPC_URL      = <testnet EVM RPC>
SHIORA_L1_CHAIN_ID     = 7332
SHIORA_L1_ANCHOR_FROM  = <node-held funded account>
SHIORA_L1_ANCHOR_TO    = <anchor target / deployed registry>
```

Everything else (Postgres, Vault Transit key custody, the Next.js app) is hosted by the Shiora team and is **not** in the US team's scope.

## 8. Test evidence & report-back

- **Definitive seal-binding proof (chain repo):** `internal/evmhost/shiora_test.go` — this exact bytecode against the **real ISeal precompile + real seal keeper**, incl. live revocation and re-attest permanence (on `release/public-testnet-pqc`).
- **This repo:** seal tier 21/21 tests, 100% statement coverage (`cd contracts && npx hardhat test`); app suites green at branch tip (250+ suites, 4,100+ tests).
- **Report back:** deployed address, `eth_chainId`, the §6 manifest, the sealed `JOB_ID`, and any behavioral deltas vs §5.

## 9. App-side setup & wallet testing (added 2026-07-15)

The app now authenticates exclusively with the **Aethelred Wallet** (EIP-1193
injected provider, EIP-191 `personal_sign` challenge). Keplr/Leap are gone —
one wallet across the whole ecosystem. This lives on branch
`feat/unify-aethelred-wallet` (PR #10) — test from that branch until it merges.

### 9.1 Prerequisites

- Node.js 20+, npm
- Postgres 15+ (optional for a smoke test — without `DATABASE_URL` an
  in-memory store is used and data does not survive a restart; set it for any
  real testing. Tables are created automatically on first boot.)
- The Aethelred Wallet browser extension (any injected EIP-1193 wallet works;
  auth is a signed challenge, no network switch required)

### 9.2 Setup

```bash
git fetch origin && git checkout feat/unify-aethelred-wallet
npm ci
cp .env.example .env.local
```

Minimum `.env.local` for testnet testing:

```bash
SHIORA_SESSION_SECRET=$(openssl rand -base64 48)
SHIORA_ALLOWED_ORIGINS=http://localhost:3001
DATABASE_URL=postgres://shiora:***@localhost:5432/shiora   # recommended
SHIORA_DATA_ENCRYPTION_KEY=$(openssl rand -base64 32)       # PHI KEK (dev tier)
```

Leave the Vault, profile, tenancy, and L1-anchoring blocks unset for now.
(`SHIORA_L1_RPC_URL`/`SHIORA_L1_CHAIN_ID=7332` only make sense once you decide
which node-held account funds anchors; until then anchor receipts are honestly
reported `status: local`.)

```bash
npm run build                                    # assembles the standalone bundle
SHIORA_PREFLIGHT_MODE=evaluation PORT=3001 npm run start:standalone
```

Two things to know about production runs:

- `next start` refuses `output: standalone` builds — use `npm run
  start:standalone` (the build's postbuild step copies the static assets into
  the standalone tree automatically).
- Production boots are gated by a PHI-readiness preflight (Vault Transit
  custody, HSTS/TLS, TLS backends, durable Postgres). A testnet evaluation
  that does not custody real patient data acknowledges those infrastructure
  gates with `SHIORA_PREFLIGHT_MODE=evaluation`; the acknowledged gaps are
  printed at boot and visible on `GET /api/health/ready` (`config.mode:
  "evaluation"`). Dev crypto keys, placeholder secrets, auth bypasses and
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

### 9.3 HTTPS caveat — read before testing on the VPS

Production builds set session cookies with the `Secure` flag. A browser will
NOT store them over plain `http://<VPS-IP>:3001`, so wallet login would appear
to succeed and immediately drop. Two supported paths:

1. **SSH tunnel (fastest):** `ssh -L 3001:localhost:3001 <vps>` and open
   `http://localhost:3001` — browsers treat localhost as a secure context, so
   auth works unmodified.
2. **TLS reverse proxy (shared testing):** put Caddy/nginx with a certificate
   in front and add the https origin to `SHIORA_ALLOWED_ORIGINS`.

### 9.4 What to verify

```bash
npx tsc --noEmit && npx jest --silent   # expect 299 suites / 4713 tests green
curl -s http://localhost:3001/api/system/release | head -c 400
```

In the browser: Connect Wallet → Aethelred Wallet prompt → EIP-191 signature →
session established; Vault / Records / Access pages start empty (by design —
no seeded theater) and fill as you create records. Access-page audit entries
are served from the real audit chain.
