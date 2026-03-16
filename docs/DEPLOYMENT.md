# Shiora Health AI -- Deployment Guide

## Prerequisites

- Node.js 18.x or 20.x (LTS recommended)
- npm 9.x or later
- Git
- Access to the Aethelred L1 RPC endpoint
- IPFS node or gateway access
- TEE-enabled compute environment (Intel SGX or AWS Nitro) for AI inference

## Environment Variables

Create a `.env.local` file at the project root:

```bash
# ── Blockchain ────────────────────────────────────────────────
NEXT_PUBLIC_RPC_URL=https://rpc.mainnet.aethelred.org
NEXT_PUBLIC_CHAIN_ID=1337

# ── Shiora API ────────────────────────────────────────────────
NEXT_PUBLIC_SHIORA_API_URL=https://api.shiora.health
SHIORA_API_SECRET=<server-side-api-secret>

# ── IPFS ──────────────────────────────────────────────────────
NEXT_PUBLIC_IPFS_GATEWAY=https://gateway.ipfs.io/ipfs/
IPFS_API_URL=http://localhost:5001
IPFS_PINNING_SERVICE_KEY=<pinning-service-api-key>

# ── TEE ───────────────────────────────────────────────────────
TEE_ENCLAVE_URL=https://tee.shiora.health
TEE_ATTESTATION_KEY=<attestation-verification-key>

# ── Authentication ────────────────────────────────────────────
JWT_SECRET=<jwt-signing-secret>
JWT_EXPIRY=24h

# ── Database (optional, for caching/indexing) ─────────────────
DATABASE_URL=postgresql://user:password@localhost:5432/shiora

# ── Monitoring ────────────────────────────────────────────────
NEXT_PUBLIC_SENTRY_DSN=<sentry-dsn>
LOG_LEVEL=info
```

### Environment Variable Reference

| Variable                     | Required | Description                          |
|------------------------------|----------|--------------------------------------|
| NEXT_PUBLIC_RPC_URL          | Yes      | Aethelred L1 RPC endpoint           |
| NEXT_PUBLIC_SHIORA_API_URL   | Yes      | Backend API base URL                 |
| NEXT_PUBLIC_IPFS_GATEWAY     | Yes      | IPFS HTTP gateway URL                |
| NEXT_PUBLIC_CHAIN_ID         | Yes      | Blockchain chain ID                  |
| SHIORA_API_SECRET            | Yes      | Server-side API signing secret       |
| IPFS_API_URL                 | Yes      | IPFS node API endpoint               |
| IPFS_PINNING_SERVICE_KEY     | No       | Remote pinning service key           |
| TEE_ENCLAVE_URL              | Yes      | TEE enclave service endpoint         |
| TEE_ATTESTATION_KEY          | Yes      | Public key for attestation verification |
| JWT_SECRET                   | Yes      | JWT token signing secret             |
| JWT_EXPIRY                   | No       | JWT expiration time (default: 24h)   |
| DATABASE_URL                 | No       | PostgreSQL connection string         |
| NEXT_PUBLIC_SENTRY_DSN       | No       | Sentry error tracking DSN            |
| LOG_LEVEL                    | No       | Logging level (debug, info, warn, error) |

## Development Setup

### 1. Clone and Install

```bash
git clone https://github.com/aethelred/shiora.git
cd shiora
npm install
```

### 2. Set Up Environment

```bash
cp .env.example .env.local
# Edit .env.local with your configuration
```

### 3. Start Development Server

```bash
npm run dev
```

The application starts at `http://localhost:3001`.

### 4. Run Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Full validation (type-check + lint + format + test)
npm run validate
```

### 5. Code Quality

```bash
# Lint
npm run lint

# Type-check
npm run type-check

# Format code
npm run format

# Check formatting
npm run format:check
```

## Production Deployment

### Option 1: Vercel (Recommended)

#### Setup

1. Connect your repository to Vercel
2. Configure environment variables in Vercel dashboard
3. Set the framework preset to "Next.js"
4. Set the root directory to the Shiora project root

#### Deployment

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy to preview
vercel

# Deploy to production
vercel --prod
```

#### Vercel Configuration

The project includes a `next.config.js` with security headers that are automatically applied. No additional `vercel.json` is needed for basic deployment.

### Option 2: Docker

#### Dockerfile

```dockerfile
# ── Build Stage ───────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ARG NEXT_PUBLIC_RPC_URL
ARG NEXT_PUBLIC_SHIORA_API_URL
ARG NEXT_PUBLIC_IPFS_GATEWAY

RUN npm run build

# ── Production Stage ──────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

USER nextjs

EXPOSE 3001

ENV PORT=3001
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
```

#### Docker Compose

```yaml
version: '3.8'

services:
  shiora:
    build:
      context: .
      args:
        NEXT_PUBLIC_RPC_URL: ${NEXT_PUBLIC_RPC_URL}
        NEXT_PUBLIC_SHIORA_API_URL: ${NEXT_PUBLIC_SHIORA_API_URL}
        NEXT_PUBLIC_IPFS_GATEWAY: ${NEXT_PUBLIC_IPFS_GATEWAY}
    ports:
      - "3001:3001"
    env_file:
      - .env.local
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:3001/"]
      interval: 30s
      timeout: 10s
      retries: 3

  ipfs:
    image: ipfs/kubo:latest
    ports:
      - "5001:5001"
      - "8080:8080"
    volumes:
      - ipfs_data:/data/ipfs
    restart: unless-stopped

volumes:
  ipfs_data:
```

#### Build and Run

```bash
# Build
docker compose build

# Run
docker compose up -d

# View logs
docker compose logs -f shiora
```

### Option 3: Self-Hosted (PM2)

```bash
# Build the production app
npm run build

# Start with PM2
npx pm2 start npm --name "shiora" -- start

# Or use the ecosystem config
npx pm2 start ecosystem.config.js
```

#### PM2 Ecosystem Config (`ecosystem.config.js`)

```javascript
module.exports = {
  apps: [{
    name: 'shiora',
    script: 'npm',
    args: 'start',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3001,
    },
    max_memory_restart: '500M',
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
  }],
};
```

## Smart Contract Deployment

### Prerequisites

- Aethelred CLI (`aethel-cli`) installed
- Wallet with sufficient AETHEL tokens for gas
- Access to Aethelred L1 testnet or mainnet

### Deployment Steps

```bash
# 1. Compile contracts
aethel-cli compile contracts/

# 2. Deploy to testnet
aethel-cli deploy --network testnet \
  --contract HealthRecordRegistry \
  --args <constructor-args>

# 3. Deploy AccessControlManager
aethel-cli deploy --network testnet \
  --contract AccessControlManager \
  --args <registry-address>

# 4. Deploy TEEAttestationVerifier
aethel-cli deploy --network testnet \
  --contract TEEAttestationVerifier \
  --args <trusted-enclave-key>

# 5. Verify contracts
aethel-cli verify --network testnet \
  --address <deployed-address>
```

### Contract Addresses (Mainnet)

| Contract                 | Address                                    |
|--------------------------|--------------------------------------------|
| HealthRecordRegistry     | `aeth1contract_health_registry...`         |
| AccessControlManager     | `aeth1contract_access_control...`          |
| TEEAttestationVerifier   | `aeth1contract_tee_verifier...`            |
| ShioraToken ($SHIO)      | `aeth1contract_shio_token...`              |

## IPFS Node Setup

### Running a Local IPFS Node

```bash
# Install IPFS
npm install -g ipfs

# Initialize node
ipfs init

# Start daemon
ipfs daemon

# Verify
ipfs id
```

### Pinning Configuration

For production, configure a remote pinning service:

```bash
# Add Pinata as remote pinning service
ipfs pin remote service add pinata https://api.pinata.cloud/psa <api-key>

# Pin a CID
ipfs pin remote add --service=pinata <CID>
```

## Monitoring Setup

### Health Checks

The application exposes the following health check endpoints:

```
GET /                   # Application health (200 = healthy)
GET /api/health/overview  # Backend health with data summary
GET /api/tee/status     # TEE enclave health
```

### Recommended Monitoring Stack

1. **Error tracking**: Sentry (set `NEXT_PUBLIC_SENTRY_DSN`)
2. **APM**: Datadog or New Relic for performance monitoring
3. **Uptime**: UptimeRobot or Better Uptime
4. **Logs**: Elasticsearch + Kibana or Datadog Logs
5. **Metrics**: Prometheus + Grafana for custom metrics

### Key Metrics to Monitor

| Metric                    | Threshold        | Alert Level |
|---------------------------|------------------|-------------|
| Response time (p95)       | < 500ms          | Warning     |
| Response time (p99)       | < 1000ms         | Critical    |
| Error rate (5xx)          | < 0.1%           | Critical    |
| TEE enclave uptime        | > 99.9%          | Critical    |
| IPFS node availability    | > 95%            | Warning     |
| Block height sync lag     | < 10 blocks      | Warning     |
| Memory usage              | < 80%            | Warning     |
| CPU usage                 | < 70%            | Warning     |

### Logging

The application logs structured JSON to stdout/stderr:

```json
{
  "level": "info",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "message": "Record uploaded",
  "recordId": "rec-abc123",
  "cid": "Qm...",
  "txHash": "0x...",
  "duration": 245
}
```

## SSL/TLS Configuration

For self-hosted deployments, use a reverse proxy (nginx or Caddy) with automatic TLS:

### Caddy (Recommended)

```
shiora.health {
    reverse_proxy localhost:3001
}
```

### Nginx

```nginx
server {
    listen 443 ssl http2;
    server_name shiora.health;

    ssl_certificate /etc/letsencrypt/live/shiora.health/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/shiora.health/privkey.pem;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```
