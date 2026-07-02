# Why Shiora's Attestation Tier Requires Aethelred to Be an L1

**Audience:** hospital compliance teams, health regulators, auditors, and
developers evaluating "why anchor health attestations to a sovereign L1 instead
of a signature or a database?"

**Short answer:** Shiora's highest attestation tier — `ShioraSealAttestation` —
binds a health-data attestation (a clinical AI inference, or a consent-capture
screening) to a **Digital Seal minted by the Aethelred validator quorum** after
the confidential computation ran under a CEAP policy, and re-checks that seal's
live status through a **consensus-native precompile**. Those are consensus-layer
facts. A signature, a database, an L2, or a health app on someone else's chain
cannot provide them, because none of them is the entity that runs the attested
compute, mints the seal, or finalizes it.

This is the health-data companion to the chain's ADR-0004 (sovereign L1 thesis)
and its dApp-arc siblings — Cruzible (staking), ZeroID (identity), TerraQura
(RWA/MRV), NoblePay (settlement) — all on the same ISeal primitive.

---

## The reviewer test

For each property, ask: _would this still hold if the attestation were a signed
message, a row in Shiora's database, or state on a rollup?_ If "no," it is a
genuine L1-consensus requirement.

### 1. The attestation's root of trust is consensus, not a key or a row

Today `ShioraTEEVerifier` self-signs enclave attestations (trust the submitter's
ECDSA key) and `ShioraConsentManager` stores an unverified attestation hash
(trust the caller). Keys leak; databases are mutable by whoever runs them. In
this tier, the attestation is a Digital Seal the **validator set produced** by
verifying the confidential computation (PoUW) under a CEAP policy — FHE/TEE/MPC
backend, jurisdiction, vendor-root. No single key or admin can forge it.

> **Signature / DB / rollup test:** a signature is only as good as the key; a DB
> row is only as good as its operator; a rollup posts data to L1 but runs no
> attested compute of its own. None yields a quorum-minted attestation. **Fails.**

### 2. Revocation propagates from consensus, in real time

`isAttested` re-reads `ISeal.verifySeal` on every call. When a subject withdraws
consent, a model is decertified, or a jurisdiction changes and the chain revokes
the seal, every consumer — a provider gateway, a research pipeline, a settlement
path — sees the attestation invalid on the very next read, with no Shiora
transaction and no cache to invalidate.

> **DB/rollup test:** a signed attestation cannot be un-signed; a cached copy or
> bridged state drifts from the source of truth. Instant
> revocation-from-consensus is unavailable. **Fails.**

### 3. Verification is bridge-free — the precompile reads consensus-native state

`ISeal` (0x0900) is a precompile: the contract calls it and it reads the seal
keeper's state in the same execution. For health data — where a wrong
"this data was handled under an attested confidential enclave" claim is a
patient-safety and legal exposure — inserting a bridge (the ecosystem's dominant
loss category) between the claim and its proof is unacceptable.

> **Rollup test:** an L2 reaching L1 seal state needs a bridge/relay — added
> trust and latency. **Fails.**

### 4. Sovereignty and data residency are enforced where the compute runs

Health regulation (HIPAA, GDPR special-category data, UAE health-data law,
women's-health-specific rules) demands provable jurisdiction of the processing
and confidentiality of the underlying data. CEAP encodes `dataResidency`,
`allowedBackends`, `requireVendorRoot` into the seal, and the validator set
enforces them where the computation happens — while **no PHI ever touches the
chain** (only the subject address and a scope hash do). The registry's
`setCompliancePolicy` then makes those the admission rule.

> **Rollup test:** a rollup inherits the base layer's validators and
> jurisdiction; it cannot promise a health authority that the computation ran
> under validators in its jurisdiction on vendor-rooted hardware. **Fails.**

### 5. Post-quantum finality for records that must outlive the patient

A health attestation's soundness must survive decades of medical-record
retention and litigation. Digital Seals are quorum-signed with PQC (ML-DSA) via
ABCI++ vote extensions — the attestation minted today is finalized under a
signature scheme built for a store-now-decrypt-later adversary.

> **Signature test:** an ECDSA enclave signature is not PQC-final and cannot be
> made so retroactively. **Fails.**

---

## What this is _not_

It is not "put health data on a blockchain." **No PHI is placed on-chain** — an
attestation binds a subject address and a scope hash, the same on-chain surface
Shiora's existing consent contracts already use. It is also not a claim that
Shiora's whole contract layer is production: this is the ONE tested,
consensus-anchored contract, and it does not change the shipped app (see
`SECURITY.md`). The L1 requirement is narrow and load-bearing: the _root of
trust for a health attestation_ is a consensus-minted, PQC-finalized,
confidentially-attested seal, checked bridge-free — the honest, real version of
the self-signed/unverified attestations the rest of the layer gestures at.

## The honest boundary

- The strength of an attestation is the strength of the seal behind it: only as
  strong as the CEAP backend that produced it. Consult the chain's
  confidential-execution status ledger for which backends are
  production-operational vs. maturing; never present a maturing backend as
  fully operational.
- This tier anchors attestations; it does not itself run clinical AI or make
  medical claims. The clinical model that a seal attests is a separate,
  program-governed artifact (registration/validation is a clinical
  responsibility).
- The contract awaits a Tier-1 external audit before mainnet (launch gate).
  See `SECURITY.md`.
