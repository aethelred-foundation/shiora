# Shiora Smart Contracts

On-chain protocol layer for Shiora Health AI on the Aethelred sovereign L1. These contracts govern health record registration, privacy-preserving data sharing, consent management, zero-knowledge verification, marketplace economics, staking, and decentralized governance.

All contracts target **Solidity ^0.8.20** and inherit from **OpenZeppelin 5.0.2** base contracts (`Ownable`, `ReentrancyGuard`, `Pausable`, `ECDSA`, `MessageHashUtils`).

## Directory Structure

```
contracts/
├── core/           # Infrastructure: access control, record registry, TEE attestation
├── privacy/        # Privacy primitives: consent, reproductive vault, ZK proofs
├── defi/           # Token economics: governance, staking, marketplace
├── interfaces/     # Shared interface definitions (IShiora.sol)
└── README.md
```

## Contract Reference

| Contract | Directory | Purpose |
|---|---|---|
| `ShioraAccessControl` | `core/` | Granular, time-limited access grants for encrypted health data. Only the record owner can grant, modify, or revoke provider access. Grants auto-expire based on specified duration. |
| `ShioraRecordRegistry` | `core/` | On-chain registration of encrypted health record metadata. Records are stored on IPFS; only the CID, content hash, encryption type, and TEE attestation are registered on-chain for integrity verification and immutable audit trails. |
| `ShioraTEEVerifier` | `core/` | Stores TEE attestations on-chain, verifies attestation signatures, manages a model registry, and tracks AI inferences inside secure enclaves (Intel SGX, AWS Nitro, AMD SEV). |
| `ShioraConsentManager` | `privacy/` | Manages granular, time-limited, scope-limited, revocable consent permissions for health data sharing between patients and providers. Supports multiple scopes, auto-renewal, and off-chain privacy policy references. |
| `ShioraReproductiveVault` | `privacy/` | Encrypted data compartments with per-compartment access control and jurisdictional compliance flags. Designed for sensitive reproductive and women's health data requiring enhanced privacy protections and jurisdiction-aware governance. |
| `ShioraZKVerifier` | `privacy/` | On-chain verification of zero-knowledge proofs for health-related claims (age range, condition present, medication active, data quality, provider verified, fertility window). Only registered verifiers can verify claims; claims expire after their specified duration. |
| `ShioraGovernance` | `defi/` | On-chain governance with proposal creation, weighted voting, vote delegation, configurable quorum thresholds, and timelock-style execution. Voting power is determined by staked SHIO tokens. |
| `ShioraStaking` | `defi/` | SHIO token staking for governance voting weight and protocol rewards. Stake positions are time-locked with a 7-day cooldown for unstaking. 1 staked SHIO = 1 vote of governance power. |
| `ShioraMarketplace` | `defi/` | Health data marketplace for anonymized, TEE-verified datasets. Revenue split: seller (85%), protocol treasury (10%), stakers (5%). Listings carry quality scores and expire after a configurable duration (max 90 days). |

## Interfaces

`interfaces/IShiora.sol` contains the canonical interface definitions for all nine contracts. External integrations and cross-contract calls should reference these interfaces rather than importing concrete implementations.

## Dependencies

| Package | Version | Usage |
|---|---|---|
| `@openzeppelin/contracts` | 5.0.2 | `Ownable`, `ReentrancyGuard`, `Pausable`, `ECDSA`, `MessageHashUtils` |

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

Deployment scripts are located in the project root under `scripts/` (or `ignition/` if using Hardhat Ignition). Refer to the project-level documentation for network configuration and deployment procedures.

```bash
npx hardhat run scripts/deploy.ts --network <network>
```

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
