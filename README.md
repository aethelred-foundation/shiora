# Shiora Health AI

**Sovereign health data management powered by verifiable AI on Aethelred L1**

[![Build Status](https://img.shields.io/github/actions/workflow/status/aethelred/shiora/ci.yml?branch=main)](https://github.com/aethelred/shiora/actions)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-3178C6.svg)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14-000000.svg)](https://nextjs.org/)

---

Shiora is a decentralized health data platform that gives individuals full sovereignty over their medical records, reproductive health data, and AI-driven health insights. Built on the [Aethelred](https://aethelred.org) sovereign L1 blockchain, Shiora combines zero-knowledge proofs, trusted execution environments, and on-chain consent management to ensure that health data remains private, verifiable, and under the user's control.

## Features

- **14 pages** covering the full health data lifecycle
- **9 smart contracts** for on-chain consent, access control, governance, staking, and marketplace logic
- **57 API routes** powering health records, consent, vault, chat, research, and more
- **393 tests** across 20 suites ensuring correctness and reliability
- Zero-knowledge proof generation and verification for private health attestations
- Trusted execution environment (TEE) integration for confidential computation
- FHIR-compatible health record bridge for interoperability with existing systems
- Granular consent management with on-chain audit trails
- Encrypted reproductive health vault with compartmentalized access
- AI health chat with explainability and verifiable inference
- Predictive health alerts with privacy-preserving analytics
- Decentralized data marketplace with revenue sharing
- Community governance with proposal voting and staking
- Wearable device integration with real-time data sync
- Provider reputation system with on-chain scoring
- Privacy rights dashboard for GDPR/HIPAA compliance tooling
- Research data contribution with anonymization controls

## Tech Stack

| Category | Technology |
|---|---|
| Framework | Next.js 14, React 18 |
| Language | TypeScript 5.3 |
| Styling | Tailwind CSS 3.4 |
| Charts | Recharts 2.10 |
| Data Fetching | React Query 5 (TanStack) |
| Validation | Zod |
| Smart Contracts | Solidity 0.8.20, OpenZeppelin |
| Testing | Jest 29, Testing Library, MSW 2 |
| Linting | ESLint 8, Prettier 3 |

## Quick Start

### Prerequisites

- Node.js 18+
- npm 9+

### Installation

```bash
# Clone the repository
git clone https://github.com/aethelred/shiora.git
cd shiora

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local

# Start development server
npm run dev
```

The application will be available at `http://localhost:3001`.

### Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server on port 3001 |
| `npm run build` | Create production build |
| `npm start` | Start production server |
| `npm test` | Run test suite |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run lint` | Run ESLint |
| `npm run type-check` | Run TypeScript compiler checks |
| `npm run format` | Format code with Prettier |
| `npm run validate` | Run type-check, lint, format check, and tests |

## Project Structure

```
shiora/
├── contracts/                    # Solidity smart contracts
│   ├── interfaces/               # Contract interfaces
│   ├── ShioraAccessControl.sol
│   ├── ShioraConsentManager.sol
│   ├── ShioraGovernance.sol
│   ├── ShioraMarketplace.sol
│   ├── ShioraRecordRegistry.sol
│   ├── ShioraReproductiveVault.sol
│   ├── ShioraStaking.sol
│   ├── ShioraTEEVerifier.sol
│   └── ShioraZKVerifier.sol
├── src/
│   ├── app/                      # Next.js App Router pages and API routes
│   │   ├── api/                  # 57 API route handlers
│   │   ├── access/               # Access control page
│   │   ├── alerts/               # Predictive alerts page
│   │   ├── chat/                 # AI health chat page
│   │   ├── community/            # Community governance page
│   │   ├── fhir/                 # FHIR bridge page
│   │   ├── governance/           # DAO governance page
│   │   ├── insights/             # Health insights page
│   │   ├── marketplace/          # Data marketplace page
│   │   ├── records/              # Health records page
│   │   ├── research/             # Research contributions page
│   │   ├── settings/             # Settings page
│   │   ├── vault/                # Reproductive health vault page
│   │   └── wearables/            # Wearable devices page
│   ├── components/               # React components organized by domain
│   │   ├── alerts/               # Predictive alert components
│   │   ├── chat/                 # Chat interface components
│   │   ├── community/            # Community components
│   │   ├── consent/              # Consent management components
│   │   ├── fhir/                 # FHIR bridge components
│   │   ├── governance/           # Governance and staking components
│   │   ├── layout/               # Layout providers and onboarding
│   │   ├── marketplace/          # Marketplace components
│   │   ├── modals/               # Modal dialogs
│   │   ├── privacy/              # Privacy rights components
│   │   ├── reputation/           # Provider reputation components
│   │   ├── research/             # Research components
│   │   ├── rewards/              # Rewards components
│   │   ├── ui/                   # Shared UI primitives
│   │   ├── vault/                # Vault components
│   │   ├── wearables/            # Wearable components
│   │   ├── xai/                  # Explainable AI components
│   │   └── zkp/                  # Zero-knowledge proof components
│   ├── contexts/                 # React context providers
│   ├── hooks/                    # Custom React hooks (25 hooks)
│   ├── lib/                      # Utility libraries and API clients
│   ├── mocks/                    # MSW mock handlers for testing
│   ├── types/                    # TypeScript type definitions
│   └── __tests__/                # Test suites (20 suites, 393 tests)
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
├── jest.config.ts
└── package.json
```

## Smart Contracts

All contracts are written in Solidity 0.8.20 and target the Aethelred L1 EVM.

| Contract | Description |
|---|---|
| `ShioraAccessControl` | Role-based access control for health data with granular permissions |
| `ShioraConsentManager` | On-chain consent registry with time-bound grants and revocation |
| `ShioraGovernance` | DAO governance with proposal creation, voting, and execution |
| `ShioraMarketplace` | Decentralized data marketplace with listing, purchasing, and revenue splits |
| `ShioraRecordRegistry` | Health record metadata registry with IPFS content addressing |
| `ShioraReproductiveVault` | Encrypted reproductive health vault with compartmentalized storage |
| `ShioraStaking` | Token staking for governance weight and platform rewards |
| `ShioraTEEVerifier` | Trusted execution environment attestation verification |
| `ShioraZKVerifier` | Zero-knowledge proof verification for private health attestations |

## API Routes

The application exposes 57 API route handlers organized by domain:

- `/api/access` -- Access control operations
- `/api/alerts` -- Predictive health alerts
- `/api/chat` -- AI health chat inference
- `/api/community` -- Community features
- `/api/consent` -- Consent management
- `/api/fhir` -- FHIR bridge operations
- `/api/governance` -- DAO governance
- `/api/health` -- Core health data
- `/api/insights` -- Health insights and analytics
- `/api/ipfs` -- IPFS pinning and retrieval
- `/api/marketplace` -- Data marketplace
- `/api/network` -- Blockchain network status
- `/api/privacy` -- Privacy rights operations
- `/api/providers` -- Healthcare provider data
- `/api/records` -- Health record CRUD
- `/api/research` -- Research data operations
- `/api/rewards` -- Platform rewards
- `/api/staking` -- Staking operations
- `/api/tee` -- TEE attestation
- `/api/vault` -- Reproductive health vault
- `/api/wallet` -- Wallet operations
- `/api/wearables` -- Wearable device data
- `/api/xai` -- Explainable AI endpoints
- `/api/zkp` -- ZKP generation and verification

## Testing

Shiora includes a comprehensive test suite with 393 tests across 20 suites covering hooks, API routes, components, and integration scenarios.

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, code style guidelines, and the pull request process.

## License

Licensed under the [Apache License 2.0](LICENSE).

Copyright 2024-2026 Aethelred Foundation.

## Links

- [Aethelred L1](https://aethelred.org) -- The sovereign blockchain powering Shiora
- [Aethelred Documentation](https://docs.aethelred.org)
- [Shiora API](https://api.shiora.health)
