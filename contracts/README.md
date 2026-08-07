# Shiora Contract Sources

## Supported public-testnet scope

Exactly one contract is supported for deployment:
`seal/ShioraSealAttestation.sol`, plus its vendored `ISeal` interface. The
Hardhat configuration deliberately sets `sources: "./seal"` so compile, test,
and deployment commands cannot silently include any other directory.

Everything under `core/`, `privacy/`, and `defi/` is a historical design
artifact. Those contracts are untested, unwired, and out of scope. **Do not
deploy them.** A green Hardhat run vouches only for the seal tier.

The canonical fresh-install procedure and environment contract are in
[`../docs/PUBLIC_TESTNET_RUNBOOK.md`](../docs/PUBLIC_TESTNET_RUNBOOK.md) and
[`.env.public-testnet.example`](.env.public-testnet.example).

## Directory Structure

```
contracts/
├── seal/           # Supported: ShioraSealAttestation + ISeal interface
├── test/           # Seal-tier tests
├── scripts/        # Public-testnet deploy + live-node validation
├── core/           # Out of scope: historical design artifacts
├── privacy/        # Out of scope: historical design artifacts
├── defi/           # Out of scope: historical design artifacts
├── interfaces/     # Out of scope: historical shared interfaces
└── README.md
```

## Historical source catalog

The table below documents files that remain for review and migration history;
it is not a deployment manifest.

| Contract                  | Directory  | Purpose                                                                                                                                                                                                                                                                   |
| ------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ShioraAccessControl`     | `core/`    | Granular, time-limited access grants for encrypted health data. Only the record owner can grant, modify, or revoke provider access. Grants auto-expire based on specified duration.                                                                                       |
| `ShioraRecordRegistry`    | `core/`    | On-chain registration of encrypted health record metadata. Records are stored on IPFS; only the CID, content hash, encryption type, and TEE attestation are registered on-chain for integrity verification and immutable audit trails.                                    |
| `ShioraTEEVerifier`       | `core/`    | Stores TEE attestations on-chain, verifies attestation signatures, manages a workload registry, and tracks verified inferences inside secure enclaves (Intel SGX, AWS Nitro, AMD SEV).                                                                                    |
| `ShioraConsentManager`    | `privacy/` | Manages granular, time-limited, scope-limited, revocable consent permissions for health data sharing between patients and providers. Supports multiple scopes, auto-renewal, and off-chain privacy policy references.                                                     |
| `ShioraReproductiveVault` | `privacy/` | Encrypted data compartments with per-compartment access control and jurisdictional compliance flags. Designed for sensitive reproductive and women's health data requiring enhanced privacy protections and jurisdiction-aware governance.                                |
| `ShioraZKVerifier`        | `privacy/` | On-chain verification of zero-knowledge proofs for health-related claims (age range, condition present, medication active, data quality, provider verified, fertility window). Only registered verifiers can verify claims; claims expire after their specified duration. |
| `ShioraGovernance`        | `defi/`    | On-chain governance with proposal creation, weighted voting, vote delegation, configurable quorum thresholds, and timelock-style execution. Voting power is determined by staked SHIO tokens.                                                                             |
| `ShioraStaking`           | `defi/`    | SHIO token staking for governance voting weight and protocol rewards. Stake positions are time-locked with a 7-day cooldown for unstaking. 1 staked SHIO = 1 vote of governance power.                                                                                    |
| `ShioraMarketplace`       | `defi/`    | Health data marketplace for anonymized, TEE-verified datasets. Revenue split: seller (85%), protocol treasury (10%), stakers (5%). Listings carry quality scores and expire after a configurable duration (max 90 days).                                                  |

## Historical interfaces

`interfaces/IShiora.sol` describes the historical contracts above. It is not
part of the supported seal-tier build or deployment.

## Dependencies

| Package                   | Version | Usage                                                                 |
| ------------------------- | ------- | --------------------------------------------------------------------- |
| `@openzeppelin/contracts` | 5.0.2   | `Ownable`, `ReentrancyGuard`, `Pausable`, `ECDSA`, `MessageHashUtils` |

Install dependencies:

```bash
npm install @openzeppelin/contracts@5.0.2
```

## Development

### Compile

```bash
npx hardhat compile
```

### Test

```bash
npx hardhat test
```

### Deploy

Copy and populate the deployment-only template, then follow the canonical
runbook. The command below sends live public-testnet transactions only when an
operator invokes it with approved values:

```bash
cp .env.public-testnet.example .env.public-testnet
set -a
. ./.env.public-testnet
set +a
npm run deploy:public-testnet
```

The deployer becomes the initial `Ownable2Step` owner, and the script sets and
reads back the approved CEAP policy. It refuses any chain other than `7332`.

The Shiora application does not consume this contract address. In particular,
do not use it as `SHIORA_L1_ANCHOR_TO`; it cannot receive the application's raw
audit-root calldata.

### Code Coverage

```bash
npx hardhat coverage
```

## Security

These contracts manage sensitive health data references and financial operations. Before any mainnet deployment:

- **Professional audit** -- Engage at least one reputable smart contract auditing firm (e.g., Trail of Bits, OpenZeppelin, Spearbit, Cyfrin).
- **Formal verification** -- Consider formal verification for critical state transitions in `ShioraAccessControl`, `ShioraConsentManager`, and `ShioraReproductiveVault`.
- **Invariant testing** -- Write Foundry invariant tests for token accounting in `ShioraStaking` and `ShioraMarketplace`.
- **Bug bounty** -- Launch a bug bounty program (Immunefi or similar) before or at mainnet launch.
- **Upgradability** -- These contracts are currently non-upgradable. If upgradability is required, adopt the UUPS or Transparent Proxy pattern with a timelock.
- **Access control** -- All contracts use `Ownable` for admin operations. Consider migrating to `AccessControl` with role-based permissions for production deployments with multiple administrators.
- **Pausability** -- All contracts inherit `Pausable`. Establish a clear incident response runbook for pausing contracts in an emergency.

## License

Apache-2.0
