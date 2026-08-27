# Shiora — Deployment Guide

> **Posture:** Shiora is pre-production, targeting a narrow invite-only pilot. This
> guide describes what the code actually requires and enforces today. The single
> source of truth for environment variables is [.env.example](../.env.example);
> if this document and that file ever disagree, `.env.example` wins.
>
> For an exact public-testnet installation (contract, application/API,
> environment templates, port, and acceptance checks), use
> [PUBLIC_TESTNET_RUNBOOK.md](PUBLIC_TESTNET_RUNBOOK.md).

## Prerequisites

- Node.js 20.x LTS
- Postgres 14+ (production; development runs fully in-memory)
- A reverse proxy terminating TLS (production)
- HashiCorp Vault or a managed KMS for key custody (production)

## Environments

| Environment | Datastore                                       | Key custody              | Transport                 |
| ----------- | ----------------------------------------------- | ------------------------ | ------------------------- |
| Development | In-memory (empty-start, non-durable)            | Dev env key              | HTTP localhost            |
| Staging     | Postgres                                        | Vault/KMS                | TLS + HSTS                |
| Production  | Postgres (**required — boot fails without it**) | Vault/KMS (**required**) | TLS + HSTS (**required**) |

## Production boot gates (enforced in code)

`assertProductionReadiness()` runs at Node startup (`src/instrumentation.node.ts`)
and **hard-fails a production boot** when any of these hold:

| Gate                             | Requirement                                                                                                                   |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `DATASTORE_NOT_DURABLE`          | `DATABASE_URL` must be set — the in-memory store must never hold PHI in production                                            |
| `NON_TLS_DATABASE`               | A remote `DATABASE_URL` must require certificate-protected TLS                                                                |
| `DATA_KEY_DEFAULT`               | Vault Transit must be configured, or a managed legacy KEK must exist while migrating historical envelopes — never the dev key |
| `SESSION_SECRET_DEFAULT`         | `SHIORA_SESSION_SECRET` must be set (`openssl rand -base64 48`)                                                               |
| `TRANSPORT_NOT_HARDENED`         | `SHIORA_ENABLE_HSTS=true` — PHI is served only behind TLS/HSTS                                                                |
| `INSECURE_WALLET_HEADER_ENABLED` | The dev-only wallet-header bypass must be off                                                                                 |
| `ORIGIN_ALLOWLIST_EMPTY`         | At least one exact HTTPS browser origin must be configured                                                                    |
| `ADMIN_BOOTSTRAP_EMPTY`          | At least one production administrative wallet must be configured                                                              |

L1 audit anchoring is disabled for the public-testnet deployment until a
dedicated compatible audit-anchor receiver exists. Leave all
`SHIORA_L1_*` variables blank. `ShioraSealAttestation` is not an audit-anchor
receiver and must never be used as `SHIORA_L1_ANCHOR_TO`.

## Environment variables

See [.env.example](../.env.example) for the complete annotated set. Summary:

**Required in production**

- `DATABASE_URL` — managed Postgres connection string with TLS required
  (`sslmode=require`, `verify-ca`, or `verify-full` for non-local services).
- `SHIORA_SESSION_SECRET` — HMAC session-signing secret (32+ chars).
- `SHIORA_VAULT_ADDR` / `SHIORA_VAULT_TOKEN` /
  `SHIORA_TRANSIT_KEY_NAME` — production DEK custody. The Transit master key
  never enters application memory. Startup makes a bounded wrap probe and
  fails closed if the Transit key or scoped token is unavailable.
- `SHIORA_VAULT_KEK_PATH` is optional and used only to read/re-seal historical
  `local-kek` envelopes during a migration. Fresh production deployments do
  not configure `SHIORA_DATA_ENCRYPTION_KEY`.
- `SHIORA_ALLOWED_ORIGINS` — exact browser origins (no wildcards).
- `SHIORA_ENABLE_HSTS=true`.
- `SHIORA_ADMIN_ADDRESSES` — RBAC bootstrap allowlist.

**Optional / operational**

- `SHIORA_METRICS_TOKEN` — Prometheus scraper token for `/api/system/metrics`.
- `SHIORA_LOG_LEVEL` — structured JSON log level.
- `SHIORA_PG_*` — pool sizing and statement timeouts.
- `SHIORA_RETENTION_DAYS` — crypto-shred window for soft-deleted rows.
- `SHIORA_TRUSTED_PROXY_COUNT` — reverse-proxy hops for client-IP resolution.

The current public-testnet application intentionally leaves
`SHIORA_L1_RPC_URL`, `SHIORA_L1_ANCHOR_FROM`, `SHIORA_L1_ANCHOR_TO`, and
`SHIORA_L1_CHAIN_ID` unset. The local WORM anchor series remains active and
reports `status: local`.

There are **no** `JWT_*`, `TEE_*`, or public RPC/IPFS-gateway variables: sessions
are HMAC-signed cookies (not JWTs), and no TEE endpoint or chain client is part
of the deployed application.

## Build & run

```bash
npm ci
npm run build          # production build (standalone output)
npm run start          # serves on :3001 behind your TLS-terminating proxy
```

Database schema is applied by the versioned migration runner
(`src/lib/persistence/migrator.ts`); migrations are idempotent and additive.

## Operational endpoints

| Endpoint                       | Purpose                                                                  |
| ------------------------------ | ------------------------------------------------------------------------ |
| `GET /api/health/live`         | Liveness probe (dependency-free)                                         |
| `GET /api/health/ready`        | Readiness probe (config + datastore round-trip; 503 when degraded)       |
| `GET /api/system/status`       | Feature-maturity registry + production-readiness report                  |
| `GET /api/system/metrics`      | Prometheus metrics (scraper token or admin)                              |
| `POST /api/system/maintenance` | Durable-store GC + retention purge (admin)                               |
| `POST /api/system/kek-reseal`  | Re-wrap envelopes under the current KEK version (admin)                  |
| `GET /api/audit/export`        | Signed WORM audit-chain segment (admin)                                  |
| `POST /api/anchors`            | Append the audit head to the local WORM series (admin; scheduler-driven) |
| `GET /api/openapi`             | OpenAPI 3.1 contract                                                     |

## Scheduled operations

Point a scheduler (cron, or your orchestrator) at:

- `POST /api/system/maintenance` — daily; sweeps expired auth state and applies
  the retention policy (crypto-shreds soft-deleted rows past the window).
- `POST /api/system/kek-reseal` — after each KEK rotation, until it reports
  completion (batched and cursor-resumable).
- `POST /api/anchors` — periodic local WORM audit-head checkpoint. Do not
  configure an L1 broadcast until a dedicated compatible target is reviewed.

## Backups & disaster recovery

The application is stateless apart from Postgres; all PHI, audit, and
configuration state lives in the database, encrypted at the row level.

- Use managed Postgres with point-in-time recovery; back up independently of the
  primary cloud account.
- **A backup is not proven until restored** — production sign-off requires a
  full restore exercise, audit-chain `verify()` after restore, and a documented
  RTO/RPO. See the release gates in [RELEASE_PROCESS.md](RELEASE_PROCESS.md).
- Crypto-shredding interacts with backups: a restored backup may resurrect a
  _sealed_ envelope, but shredded DEKs are unrecoverable by design — restoring
  ciphertext does not restore the plaintext. Never back up KEK material alongside
  the database.

## Key custody

Production keys must live in a KMS/HSM or Vault; the KEK must never appear in
plain environment files. Rotation and re-seal procedures, key domains, and the
compromise runbook are documented in [KEY_MANAGEMENT.md](KEY_MANAGEMENT.md).

## Releases

Every release must be cut from an exact commit SHA through the process in
[RELEASE_PROCESS.md](RELEASE_PROCESS.md) — provenance manifest, history scan,
full gate (tests, E2E, lint, build), and signed artifacts.
