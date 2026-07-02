# ShioraSealAttestation — Security Model & Self-Audit

**Contract:** `contracts/seal/ShioraSealAttestation.sol` (MIT, solc 0.8.20, via-ir, paris)
**Status:** implemented, self-audited, test-covered. **Tier-1 external audit is
a mainnet launch gate (not yet done).** Pre-audit security narrative, not an
audit report.

Base: OpenZeppelin 5.0.2 `Ownable2Step`, `Pausable`, `ReentrancyGuard`.
Deliberately **non-upgradeable** — the attestation of record must not be
admin-mutable. Single Ownable2Step governance surface.

---

## 0. Scope & honesty boundary (read first)

This tier is ONE contract. The rest of `contracts/` (`ShioraConsentManager`,
`ShioraTEEVerifier`, `ShioraRecordRegistry`, `ShioraZKVerifier`,
`ShioraReproductiveVault`, the `defi/` set — 14 contracts, ~6.6k LoC) was found
during this work to:

- **compile** cleanly (verified via an isolated Hardhat build), but
- have **no tests**, **no deployment**, and **no wiring to the shipped app**
  (no imports/ABIs/addresses in `src/`).

They are design artifacts. This work does **not** test, wire, or vouch for them,
and does **not** change Shiora's shipped product or its honest positioning
(the app deliberately makes no unbacked TEE/IPFS/on-chain claims — that stays).
**No PHI is placed on-chain by this tier**: an attestation binds a subject
address and a scope hash only — the same on-chain surface the existing consent
contracts already use.

The committed Hardhat project (`contracts/hardhat.config.js`) scopes
`sources` to `./seal`, so its green status vouches only for this tier.

---

## 1. Assets and actors

| Asset                                        | Why it matters                        |
| -------------------------------------------- | ------------------------------------- |
| Attestations `_attestations[subject][scope]` | what consumers gate on                |
| `sealUsed[sealId]`                           | one-attestation-per-seal replay guard |
| CEAP policy                                  | admission rule for every attestation  |
| Ownership (governance)                       | can set policy, pause, revoke         |

| Actor                            | Capability                                                                |
| -------------------------------- | ------------------------------------------------------------------------- |
| Anyone (subject/relayer/gateway) | `attest` — permissionless; bounded by the seal's purpose                  |
| Subject                          | self-`revoke` (e.g. consent withdrawal)                                   |
| Governance (owner)               | `setCompliancePolicy`, `revoke` any, `pause`/`unpause`, two-step transfer |
| ISeal precompile (0x0900)        | source of truth for seal existence, activity, purpose, CEAP satisfaction  |

**Why permissionless anchoring is safe:** the quorum-signed purpose contains the
exact `shiora:0x<subject>:0x<scope>`. A caller cannot bind a seal to a subject or
scope the validators did not seal; caller identity carries no authority.

---

## 2. Threats and mitigations

| #   | Threat                                                                                              | Mitigation                                                                                             | Test                                                                |
| --- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| T1  | **Unverified/forged attestation** (the existing `bytes32 attestation` / self-signed model)          | attestation exists only if a quorum-minted seal for the (subject, scope) is ACTIVE and CEAP-satisfying | `anchors a bound, active, policy-satisfying attestation`            |
| T2  | **Replay** — one seal for many records                                                              | `sealUsed[sealId]` monotonic guard                                                                     | `rejects seal replay across (subject, scope) pairs`                 |
| T3  | **Mis-attribution** — anchor to the wrong subject                                                   | purpose binds subject; mismatch reverts `SealNotBoundToScope`                                          | `rejects a seal bound to a different subject`                       |
| T4  | **Scope re-scoping** — seal for scope A used for scope B                                            | scope is inside the purpose                                                                            | `rejects a seal bound to a different scope`                         |
| T5  | **Policy bypass** — seal violating jurisdiction/backend                                             | `requireConfidentiality` delegates to the precompile's consensus-parity `Satisfies()`                  | `rejects a seal that fails the CEAP compliance policy`              |
| T6  | **Stale attestation** — seal revoked (consent withdrawn / model decertified) but record still valid | `isAttested` re-checks `verifySeal` live                                                               | `an attestation goes invalid the moment the chain revokes the seal` |
| T7  | **Revocation resurrection** — governance revokes; attacker re-attests with a second bound seal      | `AlreadyAttested` one-record-per-(subject,scope) guard                                                 | `SECURITY: a revocation cannot be undone…`                          |
| T8  | **Live-record overwrite**                                                                           | same `AlreadyAttested` guard                                                                           | `one (subject, scope), one attestation…`                            |
| T9  | **Inactive/forged seal**                                                                            | `verifySeal` must be true; `getSealIdByJob` reverts for unsealed jobs                                  | `rejects an inactive (revoked/expired) seal`                        |
| T10 | **Unauthorized revocation**                                                                         | `revoke` restricted to subject or owner (`NotSubjectOrOwner`)                                          | `a stranger cannot revoke`                                          |
| T11 | **Unauthorized policy change / pause**                                                              | `onlyOwner` (OZ 5.x `OwnableUnauthorizedAccount`)                                                      | `only owner can set the compliance policy`, pause test              |
| T12 | **Ownership takeover / fat-finger**                                                                 | `Ownable2Step` — new owner must `acceptOwnership`                                                      | `ownership transfer is two-step`                                    |
| T13 | **Emergency stop**                                                                                  | `pause` blocks anchoring (`EnforcedPause`); verification stays live                                    | `pause blocks anchoring but verification stays live`                |
| T14 | **Zero-scope** sentinel                                                                             | `scope == 0` reverts `ZeroScope`                                                                       | `rejects a zero scope`                                              |
| T15 | **Reentrancy** during attest                                                                        | `nonReentrant`; precompile calls are `view` (staticcall); state written after checks                   | (guard present; anchor has no external value transfer)              |

**Suite:** `contracts/test/ShioraSealAttestation.test.js` — **21 tests, all
passing** (`npx hardhat test`). Measured coverage (`npx hardhat coverage`):
**ShioraSealAttestation.sol 100% statements / 100% functions / 100% lines**;
branch 96.88% — the single uncovered branch is the OZ `ReentrancyGuard` revert
path on `attest`, which is unreachable (the body only staticcalls the
precompile, so there is no external-call reentry surface). MockISeal is a test
double, not shipped.

---

## 3. Invariants

1. **One attestation per seal** (`sealUsed` never cleared).
2. **One record per (subject, scope), forever** (`AlreadyAttested`) — local
   revocation is permanent at this tier; a re-run is a new scope/version.
3. **Valid ⇒ live seal at read time** — consensus revocation always wins.
4. **Valid ⇒ subject+scope-bound seal**, matched against the quorum-signed
   purpose.
5. **Valid ⇒ policy-satisfying seal at issuance**, evaluated by the precompile
   (never re-derived in Solidity).

---

## 4. Consensus-parity proof (chain repo)

Contract tests prove the contract; they cannot prove the _precompile binding is
real_. That is proven in the aethelred repo by
`internal/evmhost/shiora_test.go` (`TestShiora_SealAttestation_RealPrecompile`),
which deploys the **vendored, reviewed bytecode** into a real EVM host wired to
the **real `ISeal` precompile and a real seal keeper**, and asserts
attest-on-valid-seal, policy rejection (US seal vs EU policy) by the precompile,
live revocation, and revocation permanence. See `PROTOCOL_SYNC.md` §5.

---

## 5. Trust assumptions (be explicit)

- **Precompile integrity.** `0x0900` is the real Aethelred precompile only on
  Aethelred (chain id 7332 / production successor). Do not deploy elsewhere.
- **Seal strength = backend strength.** Consult the chain's
  confidential-execution status ledger; never present maturing backends as
  fully operational.
- **Clinical-model governance.** The seal proves the registered computation ran
  under policy on attested infrastructure; it does not validate the clinical
  model. Model registration/validation is a clinical/program responsibility.
- **Governance is trusted** to set a sane CEAP policy and hold `owner`;
  production should place `owner` behind a multisig/timelock.

---

## 6. Known limitations / honest ledger

- [ ] **Tier-1 external audit** — required before mainnet. Not done.
- [ ] **The other 14 Shiora contracts** remain compile-only design artifacts —
      untested, unwired. Bringing any of them to this bar (tests, real-precompile
      proof, wiring) is separate future work; until then they must not be
      presented as production.
- [ ] **No app integration.** This tier is contract + proof. Wiring it into a
      Shiora flow (e.g. gating a provider data-access path on `isAttested`, or
      replacing `ShioraConsentManager`'s unverified `attestation` field) is a
      deliberate, separate step — not done here, and it must not re-introduce
      any unbacked on-chain/TEE UI claims that were removed for honesty.
- [ ] **Owner hardening** — deploy `owner` as multisig + timelock; not enforced
      by the contract.
- [ ] **Live-node E2E** — proven via the chain-repo real-precompile Go test; a
      live viem/hardhat run against a booted node is a follow-up.

---

## 7. Deployment checklist

1. Deploy to Aethelred (chain id **7332** / production successor) only — confirm
   `eth_chainId` = `0x1ca4` and `ISeal` at `0x0900`.
2. Construct with `governance` = the intended multisig/timelock, not an EOA.
3. `setCompliancePolicy` with the program's jurisdiction/backend/vendor-root
   policy (empty arrays = "any", almost never right for regulated health data).
4. Verify `compliancePolicy()` reads back the intended policy.
5. Re-vendor bytecode into the aethelred repo and confirm
   `TestShiora_SealAttestation_RealPrecompile` is green there.
