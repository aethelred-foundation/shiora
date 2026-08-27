# Shiora ↔ Aethelred Protocol Sync — Seal-Anchored Attestation

**Contract:** `contracts/seal/ShioraSealAttestation.sol` (MIT, solc 0.8.20, via-ir, paris)
**Chain:** Aethelred L1 — EVM EIP-155 chain id **7332** (`eth_chainId` → `0x1ca4`)
**Precompile:** `ISeal` at `0x0000000000000000000000000000000000000900`

This is the contract-of-record for Shiora's consensus-anchored attestation
tier: how a health-data attestation (a clinical inference, or a
consent-capture screening) is bound to the chain's own Proof-of-Useful-Work
(PoUW) pipeline rather than to an unverified hash or a self-signed enclave key.

> **Scope note (honesty).** This document and the `contracts/seal/` tier cover
> ONE contract: `ShioraSealAttestation`. The other contracts in `contracts/`
> (`ShioraConsentManager`, `ShioraTEEVerifier`, `ShioraRecordRegistry`, the
> `defi/` set, …) compile but are **untested design artifacts, not wired to the
> shipped app** — see `SECURITY.md`. Nothing here changes the shipped Shiora
> product or its honest positioning, and **no PHI is placed on-chain**.

---

## 1. What it replaces

| Existing (unverified trust)                                                                                                 | This tier (consensus-anchored)                                                                                               |
| --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `ShioraConsentManager.grantConsent(..., bytes32 attestation)` stores an **unverified** attestation hash the caller supplies | An attestation is anchored only when a **Digital Seal** minted by the validator quorum exists for the exact (subject, scope) |
| `ShioraTEEVerifier` records **self-signed** (ECDSA) enclave attestations — trust the submitter's key                        | The seal is minted by consensus running the confidential computation under a CEAP policy; no single key can forge it         |

Both existing patterns bottom out in "trust this hash/key." `ShioraSealAttestation`
bottoms out in a consensus-minted, PQC-finalized seal verified in-EVM by the
`ISeal` precompile — the same logic that minted it.

---

## 2. The four ISeal touchpoints

Exact precompile methods used (aethelred repo `precompiles/seal/ISeal.sol`,
vendored at `contracts/seal/interfaces/ISeal.sol`):

| Call                                                                                                     | Used for                                           | Failure semantics                |
| -------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | -------------------------------- |
| `getSealIdByJob(jobId)`                                                                                  | resolve the seal minted for a PoUW job             | reverts if the job is unsealed   |
| `verifySeal(sealId)`                                                                                     | is the seal `ACTIVE` right now                     | `false` → not active / revoked   |
| `getSeal(sealId)`                                                                                        | read the `purpose` field for subject+scope binding | —                                |
| `requireConfidentiality(sealId, backends, minVerification, platforms, requireVendorRoot, dataResidency)` | CEAP policy check with **consensus parity**        | `(false, reason)` → policy unmet |

`requireConfidentiality` delegates to the precompile's `Satisfies()` — the same
logic the chain used at sealing time — so the Solidity side never re-implements
policy evaluation and cannot diverge.

---

## 3. The purpose binding (no PHI, anti-replay)

A seal only backs an attestation if its `purpose` equals, byte-for-byte:

```
shiora:0x<subject-address-hex-40>:0x<scope-hex-64>
```

- `<subject>` — the patient/subject address (the same on-chain surface the
  existing consent contracts already use; an address, not PHI).
- `<scope>` — a 32-byte scope hash, e.g. `keccak256("clinical:cycle_prediction")`
  or a consent-scope id. A hash, not PHI.

Because the (subject, scope) is inside the quorum-signed purpose:

- **Anchoring is permissionless** — a subject, a Shiora relayer, or a provider
  gateway may call `attest`; the caller carries no authority.
- **No mis-attribution / re-scoping** — a seal can't be bound to a subject or
  scope the quorum didn't seal.
- **No replay** — each seal admits one attestation (`sealUsed`), and each
  (subject, scope) admits one record for its life (`AlreadyAttested`), so a
  revocation can't be undone by a second bound seal (permanence).

`expectedPurpose(subject, scope)` returns this exact string for operators.

---

## 4. Lifecycle

```
  ┌── confidential compute / PoUW ─────────┐        ┌── EVM (chain id 7332) ─────────────┐
  │ 1. clinical inference / consent-capture │        │ 3. anyone → attest(subject, scope, │
  │    runs as a PoUW job, purpose          │        │    jobId)                          │
  │    shiora:0x<subject>:0x<scope>, CEAP    │  seal  │      ISeal.getSealIdByJob          │
  │    policy (FHE/TEE/MPC, jurisdiction)   │ ─────► │      ISeal.verifySeal (ACTIVE)     │
  │ 2. validator quorum verifies →          │        │      ISeal.getSeal → purpose match │
  │    mints Digital Seal (PQC-signed)      │        │      ISeal.requireConfidentiality  │
  └─────────────────────────────────────────┘        │    → record attestation           │
                                                      │ 4. consumers → isAttested /        │
                                                      │    requireAttested                 │
                                                      │      re-checks ISeal.verifySeal    │
                                                      │      (live revocation)             │
                                                      └─────────────────────────────────────┘
```

A consent withdrawal (subject `revoke`), a model decertification, or a
jurisdiction change that revokes the seal on-chain closes the attestation on the
next `isAttested` read — no Shiora transaction.

---

## 5. How this stays in sync with the chain (drift protection)

1. **Vendored bytecode** — aethelred repo
   `internal/evmhost/testdata/shiora/ShioraSealAttestation.{abi,bin}` is the
   exact reviewed contract, compiled with `npx hardhat compile` and copied over.
   If the Solidity changes, re-vendor.
2. **Real-precompile proof** — aethelred repo `internal/evmhost/shiora_test.go`
   (`TestShiora_SealAttestation_RealPrecompile`) deploys that bytecode into a
   real EVM host wired to the **real `ISeal` precompile and a real seal
   keeper**, and asserts: policy-satisfying subject+scope-bound seal attests; a
   US-jurisdiction seal is rejected under an EU-only policy _by the precompile_;
   seal revocation invalidates the attestation live; and a revoked
   (subject, scope) cannot be re-attested with a fresh seal (permanence).

If the ABI or purpose format changes without re-vendoring, this Go test fails in
the chain repo's CI. The contract-side behaviour is independently locked by the
Hardhat suite `contracts/test/ShioraSealAttestation.test.js` (21 tests;
measured 100% statements/functions/lines).
