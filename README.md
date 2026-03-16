<div align="center">
  <br/>
  <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="#e84393" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19.5 12.572l-7.5 7.428l-7.5-7.428A5 5 0 1 1 12 6.006a5 5 0 1 1 7.5 6.572"/><path d="M12 6v4"/><path d="M10 10h4"/></svg>
  <h1>Shiora</h1>
  <p><strong>Sovereign health data. Verifiable AI. Zero-knowledge privacy.</strong></p>
  <p>
    <a href="https://github.com/aethelred-foundation/shiora/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/aethelred-foundation/shiora/ci.yml?branch=main&style=flat-square&label=CI" alt="CI"></a>
    <a href="https://codecov.io/gh/aethelred-foundation/shiora"><img src="https://img.shields.io/codecov/c/github/aethelred-foundation/shiora?style=flat-square&label=coverage" alt="Coverage"></a>
    <a href="SECURITY.md"><img src="https://img.shields.io/badge/security-HIPAA%20%2B%20GDPR-informational?style=flat-square" alt="Security"></a>
    <a href="LICENSE"><img src="https://img.shields.io/badge/license-Apache--2.0-blue?style=flat-square" alt="License"></a>
  </p>
  <p>
    <img src="https://img.shields.io/badge/Next.js-14-000000?style=flat-square&logo=next.js" alt="Next.js">
    <img src="https://img.shields.io/badge/Solidity-0.8.20-363636?style=flat-square&logo=solidity" alt="Solidity">
    <img src="https://img.shields.io/badge/TypeScript-5.3-3178C6?style=flat-square&logo=typescript" alt="TypeScript">
    <img src="https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react" alt="React">
  </p>
  <p>
    <a href="https://app.shiora.health">App</a> &middot;
    <a href="https://docs.aethelred.io">Docs</a> &middot;
    <a href="https://api.shiora.health">API Reference</a> &middot;
    <a href="https://discord.gg/aethelred">Discord</a> &middot;
    <a href="CONTRIBUTING.md">Contributing</a>
  </p>
</div>

---

## Overview

Shiora is a decentralized women's health AI platform built on **Aethelred** — a sovereign Layer 1 optimised for verifiable AI computation. It gives individuals full sovereignty over their medical records, reproductive health data, and AI-driven health insights using zero-knowledge proofs, trusted execution environments, and on-chain consent management.

> **Status** &mdash; Pre-mainnet. 13 smart contracts deployed to testnet, 393 tests passing across 20 suites.

---

## Table of Contents

<table>
<tr>
<td width="50%" valign="top">

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
- [Project Structure](#project-structure)
- [Smart Contracts](#smart-contracts)

</td>
<td width="50%" valign="top">

- [API Routes](#api-routes)
- [Testing](#testing)
- [Security](#security)
- [Performance](#performance)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)

</td>
</tr>
</table>

---

## Features

<table>
<tr>
<td width="50%">

**Health Records & Privacy**
- Encrypted health records with IPFS content addressing
- FHIR-compatible bridge for clinical interoperability
- Granular consent management with on-chain audit trails
- Privacy rights dashboard for GDPR/HIPAA compliance

</td>
<td width="50%">

**Reproductive Health Vault**
- Compartmentalized encrypted storage for sensitive data
- Cycle tracking with privacy-preserving analytics
- ZK attestations for selective health disclosure
- Emergency access protocols with time-locked recovery

</td>
</tr>
<tr>
<td width="50%">

**AI & Clinical Intelligence**
- AI health chat with explainability and verifiable inference
- Clinical decision support with evidence-based pathways
- Predictive health alerts with anomaly detection
- Digital twin modelling with genomic integration

</td>
<td width="50%">

**Community & Governance**
- DAO governance with proposal voting and execution
- Decentralized data marketplace with revenue sharing
- Research data contributions with anonymization controls
- Provider reputation system with on-chain scoring

</td>
</tr>
</table>

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Frontend Layer                              │
│          Next.js 14 App Router  /  React 18  /  Tailwind CSS       │
│                                                                     │
│   Dashboard  Records  Vault  Chat  Alerts  Clinical  Community     │
│   Compliance  Emergency  FHIR  Genomics  Governance  Insights      │
│   Marketplace  MPC  Research  Settings  TEE Explorer  Twin         │
│   Wearables                                                         │
├─────────────────────────────────────────────────────────────────────┤
│                        API Route Layer                              │
│              57 Next.js Route Handlers  /  24 Domains              │
│                                                                     │
│   health  records  consent  vault  chat  alerts  clinical          │
│   community  compliance  emergency  fhir  genomics  governance     │
│   insights  ipfs  marketplace  mpc  network  privacy  providers    │
│   research  rewards  staking  tee  twin  wallet  wearables         │
│   xai  zkp                                                         │
├─────────────────────────────────────────────────────────────────────┤
│                     Smart Contract Layer                            │
│              Solidity 0.8.20  /  OpenZeppelin  /  EVM              │
│                                                                     │
│   ┌─────────────┐  ┌──────────────┐  ┌──────────────────────┐     │
│   │    Core      │  │   Privacy     │  │       DeFi           │     │
│   │             │  │              │  │                      │     │
│   │ AccessCtrl  │  │ ConsentMgr   │  │ Governance           │     │
│   │ RecordReg   │  │ ReproVault   │  │ Marketplace          │     │
│   │ TEEVerifier │  │ ZKVerifier   │  │ Staking              │     │
│   │ ClinPath    │  │ MPCOrch      │  │                      │     │
│   │ DigitalTwin │  │              │  │                      │     │
│   │ EmergProto  │  │              │  │                      │     │
│   └─────────────┘  └──────────────┘  └──────────────────────┘     │
├─────────────────────────────────────────────────────────────────────┤
│                       Privacy Layer                                │
│        ZK Proofs  /  TEE Attestation  /  MPC Orchestration         │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

<table>
<tr><td><strong>Category</strong></td><td><strong>Technology</strong></td></tr>
<tr><td>Framework</td><td>Next.js 14, React 18</td></tr>
<tr><td>Language</td><td>TypeScript 5.3</td></tr>
<tr><td>Styling</td><td>Tailwind CSS 3.4</td></tr>
<tr><td>Charts</td><td>Recharts 2.10</td></tr>
<tr><td>Data Fetching</td><td>React Query 5 (TanStack)</td></tr>
<tr><td>Validation</td><td>Zod</td></tr>
<tr><td>Smart Contracts</td><td>Solidity 0.8.20, OpenZeppelin</td></tr>
<tr><td>Testing</td><td>Jest 29, Testing Library, MSW 2</td></tr>
<tr><td>Linting</td><td>ESLint 8, Prettier 3</td></tr>
<tr><td>Custom Hooks</td><td>25 domain-specific React hooks</td></tr>
</table>

---

## Quick Start

### Prerequisites

| Tool | Version |
|------|---------|
| Node.js | >= 18.0.0 |
| npm | >= 9.0.0 |

### Installation

```bash
# 1. Clone
git clone https://github.com/aethelred-foundation/shiora.git
cd shiora

# 2. Install dependencies
npm install

# 3. Configure
cp .env.example .env.local
# Edit .env.local with your configuration

# 4. Start development server
npm run dev
```

The application will be available at `http://localhost:3001`.

<details>
<summary>Environment variables</summary>

```bash
# Blockchain
NEXT_PUBLIC_RPC_URL=http://localhost:8545
NEXT_PUBLIC_CHAIN_ID=1337

# IPFS
IPFS_GATEWAY_URL=https://gateway.pinata.cloud
IPFS_API_KEY=your-pinata-api-key

# AI / Inference
AI_INFERENCE_URL=http://localhost:8080
AI_MODEL_ID=shiora-health-v1

# TEE
TEE_ATTESTATION_URL=http://localhost:9090

# Privacy
ZKP_PROVER_URL=http://localhost:7070
MPC_ORCHESTRATOR_URL=http://localhost:7071

# Analytics
NEXT_PUBLIC_ANALYTICS_ID=your-analytics-id
```

</details>

---

## Project Structure

```
shiora/
├── contracts/                       # Solidity smart contracts
│   ├── core/                        # Core protocol contracts
│   │   ├── ShioraAccessControl.sol      Access control & permissions
│   │   ├── ShioraClinicalPathway.sol    Clinical decision pathways
│   │   ├── ShioraDigitalTwin.sol        Digital twin modelling
│   │   ├── ShioraEmergencyProtocol.sol  Emergency access & recovery
│   │   ├── ShioraRecordRegistry.sol     Health record metadata
│   │   └── ShioraTEEVerifier.sol        TEE attestation verification
│   ├── privacy/                     # Privacy layer contracts
│   │   ├── ShioraConsentManager.sol     On-chain consent registry
│   │   ├── ShioraMPCOrchestrator.sol    MPC computation coordination
│   │   ├── ShioraReproductiveVault.sol  Encrypted reproductive vault
│   │   └── ShioraZKVerifier.sol         ZK proof verification
│   ├── defi/                        # Governance & marketplace
│   │   ├── ShioraGovernance.sol         DAO governance & voting
│   │   ├── ShioraMarketplace.sol        Data marketplace & revenue
│   │   └── ShioraStaking.sol            Token staking & rewards
│   └── interfaces/                  # Contract interfaces
│
├── src/
│   ├── app/                         # Next.js App Router
│   │   ├── api/                     # 57 route handlers across 24 domains
│   │   ├── records/                 # Health records page
│   │   ├── vault/                   # Reproductive health vault
│   │   ├── chat/                    # AI health chat
│   │   ├── alerts/                  # Predictive alerts
│   │   ├── clinical/                # Clinical decision support
│   │   ├── community/               # Community features
│   │   ├── compliance/              # Compliance dashboard
│   │   ├── emergency/               # Emergency protocols
│   │   ├── fhir/                    # FHIR bridge
│   │   ├── genomics/                # Genomic insights
│   │   ├── governance/              # DAO governance
│   │   ├── insights/                # Health analytics
│   │   ├── marketplace/             # Data marketplace
│   │   ├── mpc/                     # MPC dashboard
│   │   ├── research/                # Research contributions
│   │   ├── settings/                # User settings
│   │   ├── tee-explorer/            # TEE attestation explorer
│   │   ├── twin/                    # Digital twin
│   │   └── wearables/               # Wearable devices
│   ├── components/                  # React components by domain
│   ├── contexts/                    # React context providers
│   ├── hooks/                       # 25 custom React hooks
│   ├── lib/                         # Utilities and API clients
│   ├── mocks/                       # MSW mock handlers
│   ├── types/                       # TypeScript type definitions
│   └── __tests__/                   # 20 test suites (393 tests)
│
├── docs/                            # Architecture and design docs
├── public/                          # Static assets
├── coverage/                        # Test coverage reports
├── next.config.js
├── tailwind.config.js
├── tsconfig.json
├── jest.config.js
└── package.json
```

---

## Smart Contracts

All contracts target the Aethelred L1 EVM and are written in Solidity 0.8.20 with OpenZeppelin base contracts.

<table>
<tr><td><strong>Contract</strong></td><td><strong>Category</strong></td><td><strong>Description</strong></td></tr>
<tr><td><code>ShioraAccessControl</code></td><td>Core</td><td>Role-based access control for health data with granular permissions</td></tr>
<tr><td><code>ShioraRecordRegistry</code></td><td>Core</td><td>Health record metadata registry with IPFS content addressing</td></tr>
<tr><td><code>ShioraTEEVerifier</code></td><td>Core</td><td>Trusted execution environment attestation verification</td></tr>
<tr><td><code>ShioraClinicalPathway</code></td><td>Core</td><td>Evidence-based clinical decision pathway engine</td></tr>
<tr><td><code>ShioraDigitalTwin</code></td><td>Core</td><td>On-chain digital twin state and genomic integration</td></tr>
<tr><td><code>ShioraEmergencyProtocol</code></td><td>Core</td><td>Emergency access with time-locked recovery and guardian system</td></tr>
<tr><td><code>ShioraConsentManager</code></td><td>Privacy</td><td>On-chain consent registry with time-bound grants and revocation</td></tr>
<tr><td><code>ShioraReproductiveVault</code></td><td>Privacy</td><td>Encrypted reproductive health vault with compartmentalized storage</td></tr>
<tr><td><code>ShioraZKVerifier</code></td><td>Privacy</td><td>Zero-knowledge proof verification for private health attestations</td></tr>
<tr><td><code>ShioraMPCOrchestrator</code></td><td>Privacy</td><td>Multi-party computation coordination for collaborative analytics</td></tr>
<tr><td><code>ShioraGovernance</code></td><td>DeFi</td><td>DAO governance with proposal creation, voting, and execution</td></tr>
<tr><td><code>ShioraMarketplace</code></td><td>DeFi</td><td>Decentralized data marketplace with listing and revenue splits</td></tr>
<tr><td><code>ShioraStaking</code></td><td>DeFi</td><td>Token staking for governance weight and platform rewards</td></tr>
</table>

---

## API Routes

57 route handlers organised across 24 domains via the Next.js App Router:

<table>
<tr>
<td width="50%" valign="top">

| Route | Domain |
|-------|--------|
| `/api/health` | Core health data |
| `/api/records` | Health record CRUD |
| `/api/consent` | Consent management |
| `/api/vault` | Reproductive health vault |
| `/api/chat` | AI health chat inference |
| `/api/alerts` | Predictive health alerts |
| `/api/clinical` | Clinical decision support |
| `/api/community` | Community features |
| `/api/compliance` | Regulatory compliance |
| `/api/emergency` | Emergency protocols |
| `/api/fhir` | FHIR bridge operations |
| `/api/genomics` | Genomic data pipelines |

</td>
<td width="50%" valign="top">

| Route | Domain |
|-------|--------|
| `/api/governance` | DAO governance |
| `/api/insights` | Health analytics |
| `/api/ipfs` | IPFS pinning & retrieval |
| `/api/marketplace` | Data marketplace |
| `/api/mpc` | MPC orchestration |
| `/api/network` | Blockchain network status |
| `/api/privacy` | Privacy rights operations |
| `/api/providers` | Healthcare provider data |
| `/api/research` | Research data operations |
| `/api/rewards` | Platform rewards |
| `/api/staking` | Staking operations |
| `/api/tee` | TEE attestation |
| `/api/twin` | Digital twin |
| `/api/wallet` | Wallet operations |
| `/api/wearables` | Wearable device data |
| `/api/xai` | Explainable AI |
| `/api/zkp` | ZKP generation & verification |

</td>
</tr>
</table>

---

## Testing

393 tests across 20 suites covering hooks, API routes, components, and integration scenarios.

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage

# Run specific suite
npm test -- --testPathPattern=hooks
npm test -- --testPathPattern=api
```

| Suite Category | Suites | Tests |
|----------------|--------|-------|
| Custom Hooks | 8 | 156 |
| API Routes | 6 | 124 |
| Components | 4 | 78 |
| Integration | 2 | 35 |

---

## Security

**Compliance posture:**
HIPAA-aligned data handling, GDPR privacy rights dashboard, on-chain consent audit trails, right-to-erasure support.

**Privacy layer:**
Zero-knowledge proofs for selective health disclosure, TEE attestation for confidential computation, MPC orchestration for collaborative analytics without data exposure, compartmentalized vault encryption.

**Smart contract layer:**
Reentrancy guards (checks-effects-interactions), checked arithmetic, role-based access control, emergency pause mechanism, time-locked recovery, guardian-based emergency access.

**Application layer:**
Zod input validation on all API routes, CORS policy, CSP headers, XSS sanitisation, parameterised queries, rate limiting per endpoint.

---

## Performance

| Metric | Target | Current |
|--------|--------|---------|
| First Contentful Paint | < 1.5 s | 1.1 s |
| Largest Contentful Paint | < 2.5 s | 2.0 s |
| Time to Interactive | < 3.5 s | 2.4 s |
| API Response Time (p95) | < 200 ms | 140 ms |
| ZK Proof Generation | < 5 s | 3.2 s |
| TEE Attestation Verify | < 500 ms | 320 ms |

Optimisations: Next.js App Router streaming, React Server Components, code splitting, TanStack Query caching, Tailwind CSS purging, Brotli compression.

---

## Development

```bash
npm run lint && npm run lint:fix    # ESLint
npm run format                      # Prettier
npm run type-check                  # TypeScript strict mode
npm run validate                    # All checks (type-check + lint + format + tests)
```

### Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server on port 3001 |
| `npm run build` | Create production build |
| `npm start` | Start production server |
| `npm test` | Run test suite |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run test:watch` | Run tests in watch mode |
| `npm run lint` | Run ESLint |
| `npm run type-check` | Run TypeScript compiler checks |
| `npm run format` | Format code with Prettier |
| `npm run validate` | Run all checks |

### CI/CD Pipeline

**On every PR:** lint + format, type-check, unit tests, integration tests, build verification, security audit.

**On merge to main:** build, deploy to staging, smoke tests, deploy to production.

---

## API Reference

```bash
# Health records
GET  /api/records
POST /api/records
GET  /api/records/:id

# Consent management
GET  /api/consent
POST /api/consent/grant
POST /api/consent/revoke

# Reproductive vault
GET  /api/vault
POST /api/vault/store
POST /api/vault/share

# AI chat
POST /api/chat
GET  /api/chat/history

# ZKP
POST /api/zkp/generate
POST /api/zkp/verify
```

Full reference: [api.shiora.health](https://api.shiora.health)

---

## Contributing

We welcome contributions. Please see the [Contributing Guide](CONTRIBUTING.md) before opening a PR.

| Standard | Requirement |
|----------|-------------|
| Commits | [Conventional Commits](https://www.conventionalcommits.org/) |
| Types | TypeScript strict mode, no `any` |
| Tests | All new code must include tests |
| Lint | Zero warnings on `npm run validate` |
| Privacy | No PII in logs, tests, or mock data |

1. Fork the repository
2. Create a feature branch &mdash; `git checkout -b feature/my-feature`
3. Run `npm run validate`
4. Commit with Conventional Commits
5. Open a Pull Request

---

## License

Apache 2.0 &mdash; see [LICENSE](LICENSE) for details.

---

## Acknowledgements

[Aethelred](https://aethelred.io) &middot; [OpenZeppelin](https://openzeppelin.com/) &middot; [Next.js](https://nextjs.org/) &middot; [Tailwind CSS](https://tailwindcss.com/) &middot; [TanStack Query](https://tanstack.com/query) &middot; [Zod](https://zod.dev/)

---

<p align="center">
  <a href="https://app.shiora.health">App</a> &middot;
  <a href="https://docs.aethelred.io">Docs</a> &middot;
  <a href="https://discord.gg/aethelred">Discord</a> &middot;
  <a href="https://twitter.com/aethelred">Twitter</a> &middot;
  <a href="mailto:support@aethelred.io">Support</a>
</p>
<p align="center">
  Copyright &copy; 2024&ndash;2026 Aethelred Foundation
</p>
