# Shiora Health AI -- Architecture

## System Overview

Shiora Health AI is a privacy-first women's health platform built on the Aethelred sovereign L1 blockchain. It combines end-to-end encrypted health records, TEE-verified AI inference, and decentralized storage (IPFS) to deliver a platform where sensitive health data never leaves the user's control.

```
+--------------------------------------------------+
|                   Frontend                        |
|         Next.js 14 App Router (React 18)          |
|  +------+  +---------+  +--------+  +---------+  |
|  | Dash |  | Records |  |Insights|  | Access  |  |
|  +------+  +---------+  +--------+  +---------+  |
|       |         |            |            |       |
|       +---------+-----+------+-----+------+      |
|                       |                           |
|            React Context (AppProvider)             |
|            TanStack Query (data fetching)          |
+--------------------------------------------------+
                        |
                   HTTPS / WSS
                        |
+--------------------------------------------------+
|                   Backend                         |
|             Next.js API Routes                    |
|  +--------+  +--------+  +-------+  +--------+   |
|  |Records |  |Insights|  |Access |  |  TEE   |   |
|  |  API   |  |  API   |  |  API  |  |  API   |   |
|  +--------+  +--------+  +-------+  +--------+   |
|       |           |           |          |        |
+-------+-----------+-----------+----------+--------+
        |           |           |          |
   +----+----+ +----+----+ +---+---+ +----+----+
   |  IPFS   | |TEE Encl.| |Smart  | |Aethelred|
   |  Nodes  | |(SGX/    | |Contr. | |  L1 RPC |
   |         | | Nitro)  | |       | |         |
   +---------+ +---------+ +-------+ +---------+
```

## Frontend Architecture

### Technology Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript (strict mode)
- **UI**: React 18, Tailwind CSS, Lucide React icons
- **Charts**: Recharts for data visualizations
- **Data fetching**: TanStack Query (React Query v5)
- **State management**: React Context (AppProvider)

### Directory Structure

```
src/
  app/                    # Next.js App Router pages
    page.tsx              # Dashboard (home)
    layout.tsx            # Root layout with Providers
    error.tsx             # Error boundary page
    loading.tsx           # Global loading state
    not-found.tsx         # 404 page
    records/
      page.tsx            # Health Records management
      loading.tsx         # Records loading state
    insights/
      page.tsx            # AI Insights and predictions
      loading.tsx         # Insights loading state
    access/
      page.tsx            # Access Control management
      loading.tsx         # Access loading state
  components/
    SharedComponents.tsx  # Badge, Modal, Tabs, TopNav, Footer, etc.
    PagePrimitives.tsx    # MedicalCard, StatusBadge, Sparkline, etc.
    Providers.tsx         # QueryClient + AppProvider wrapper
    ErrorBoundary.tsx     # React class-based error boundary
    EmptyState.tsx        # Empty state placeholder component
    Skeleton.tsx          # Loading skeleton components
  contexts/
    AppContext.tsx         # Global state: wallet, TEE, real-time, notifications
  lib/
    utils.ts              # Deterministic RNG, formatting, crypto helpers
    constants.ts          # Brand colors, AI models, status styles, nav links
  hooks/                  # Custom React hooks (extensible)
  types/                  # TypeScript type definitions (extensible)
```

### State Architecture

The `AppProvider` context manages:

1. **Wallet State**: Connection status, address, token balances ($SHIO, AETHEL)
2. **Health Data State**: Record counts, encryption status, storage usage, IPFS nodes
3. **TEE State**: Platform, attestation counts, enclave uptime, inference completions
4. **Real-Time State**: Block height, TPS, epoch, network load, $SHIO price (3s interval)
5. **Notification Queue**: Success/error/warning/info toasts with auto-dismissal (5s)
6. **Search State**: Global search overlay toggle (Cmd+K)

### Component Architecture

Components are organized into two layers:

- **SharedComponents**: App-wide UI primitives (Badge, Modal, Tabs, TopNav, Footer, ToastContainer, SearchOverlay)
- **PagePrimitives**: Domain-specific components (MedicalCard, StatusBadge, EncryptionBadge, TEEBadge, HealthMetricCard, Sparkline, ChartTooltip)

### Mock Data Strategy

All mock data uses deterministic seeded random number generation (`seededRandom` based on `Math.sin`) to ensure SSR and client rendering produce identical outputs, preventing hydration mismatches.

## Backend Architecture

### API Routes (Next.js Route Handlers)

```
/api/records          GET    List records (filter by type, search, paginate)
/api/records          POST   Upload new encrypted record
/api/records/:id      GET    Get record details
/api/records/:id      DELETE Remove record

/api/access/grants    GET    List access grants (filter by status)
/api/access/grants    POST   Create new grant
/api/access/grants/:id PATCH Update grant (modify scope, revoke)
/api/access/grants/:id DELETE Remove grant
/api/access/audit     GET    Get audit log entries

/api/insights         GET    Get all insights data
/api/insights/cycle   GET    Cycle prediction data
/api/insights/anomalies GET  Anomaly detection results

/api/tee/status       GET    TEE enclave status
/api/tee/attestation/:hash GET  Verify attestation

/api/health/overview  GET    Health data summary
/api/network/status   GET    Blockchain network status
```

### Validation & Middleware

- Request body validation with schema checks
- Authentication via wallet signature verification
- Rate limiting on sensitive endpoints
- CORS configuration for allowed origins
- CSP headers (Content-Security-Policy) set in `next.config.js`

## Blockchain Integration (Aethelred L1)

### Smart Contracts

1. **HealthRecordRegistry**: Registers encrypted CIDs on-chain, links records to patient addresses
2. **AccessControlManager**: Manages time-limited, scope-restricted provider access grants
3. **TEEAttestationVerifier**: Verifies TEE attestation proofs on-chain
4. **ShioraToken ($SHIO)**: Utility token for platform operations

### Transaction Flow

```
1. Patient uploads health data
2. Data encrypted client-side (AES-256-GCM)
3. Encrypted blob stored on IPFS -> returns CID
4. CID + metadata registered on Aethelred L1
5. Transaction hash returned to client
```

## TEE Integration

### Supported Platforms

- **Intel SGX**: Primary platform for AI model inference
- **AWS Nitro**: Cloud-native enclave for scalable deployments
- **AMD SEV**: Alternative secure computation environment

### Attestation Flow

```
1. Enclave loads signed AI model weights
2. Patient data decrypted INSIDE enclave only
3. AI inference runs on decrypted data
4. Results encrypted before leaving enclave
5. Cryptographic attestation generated
6. Attestation registered on Aethelred L1
7. Patient receives verified results + attestation hash
```

### AI Models (TEE-Verified)

| Model             | Type             | Accuracy | Purpose                          |
|-------------------|------------------|----------|----------------------------------|
| Cycle LSTM        | LSTM             | 96.2%    | Menstrual cycle timing prediction|
| Anomaly Detector  | Isolation Forest | 93.8%    | Unusual health pattern detection |
| Fertility XGBoost | XGBoost          | 91.5%    | Fertile window prediction        |
| Health Transformer| Transformer      | 94.7%    | Personalized health insights     |

## IPFS Storage

### Architecture

- Encrypted health records stored as content-addressed blobs on IPFS
- CIDs (Content Identifiers) registered on-chain for integrity verification
- Multi-node pinning for redundancy (47+ nodes in production)
- Gateway: `https://gateway.ipfs.io/ipfs/`

### Encryption Layer

```
Raw Health Data
      |
  AES-256-GCM Encryption (client-side)
      |
  Encrypted Blob
      |
  IPFS Upload -> CID (Qm...)
      |
  CID registered on Aethelred L1
```

## Security Model

### Defense in Depth

1. **Client-side encryption**: AES-256-GCM before data leaves the browser
2. **TEE processing**: Data decrypted only inside secure enclaves
3. **Blockchain verification**: All operations produce verifiable transaction hashes
4. **Access control**: Time-limited, scope-restricted, revocable provider access
5. **Transport security**: HTTPS with strict CSP, HSTS, X-Frame-Options: DENY
6. **Audit trail**: Every access event logged on-chain with transaction hash

### Security Headers (next.config.js)

- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- X-XSS-Protection: 1; mode=block
- Referrer-Policy: strict-origin-when-cross-origin
- Content-Security-Policy: strict default-src, frame-ancestors: none
- Strict-Transport-Security: max-age=31536000; includeSubDomains
- Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()

## Data Flow Diagrams

### Record Upload Flow

```
Patient Browser              Shiora API            IPFS          Aethelred L1
      |                          |                  |                 |
      |-- Encrypt (AES-256) ---->|                  |                 |
      |                          |-- Store blob --->|                 |
      |                          |<--- CID ---------|                 |
      |                          |-- Register CID --|---------------->|
      |                          |<-- Tx Hash ------|-----------------|
      |<-- Record Confirmation --|                  |                 |
```

### AI Inference Flow

```
Patient Browser        Shiora API        TEE Enclave        Aethelred L1
      |                    |                  |                   |
      |-- Request -------->|                  |                   |
      |                    |-- Encrypted data>|                   |
      |                    |                  |-- Decrypt ------->|
      |                    |                  |-- Run AI model -->|
      |                    |                  |-- Re-encrypt ---->|
      |                    |                  |-- Attestation --->|
      |                    |<-- Results ------|                   |
      |                    |-- Register att.--|------------------>|
      |<-- Verified result-|                  |                   |
```

### Provider Access Flow

```
Provider              Patient              Smart Contract        IPFS
   |                     |                       |                 |
   |-- Request access -->|                       |                 |
   |                     |-- Grant (on-chain) -->|                 |
   |                     |<-- Tx confirmed ------|                 |
   |<-- Access key ------|                       |                 |
   |-- Fetch record -----|----(verify grant)---->|                 |
   |                     |                       |-- Authorized -->|
   |<-- Encrypted data --|---(via TEE decrypt)---|<--- CID data --|
```
