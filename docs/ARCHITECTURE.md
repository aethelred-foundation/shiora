# Shiora architecture

## Production boundary

Shiora is a privacy-focused health-record and provider-access application on
the Aethelred public testnet. Production is deliberately limited to the
authenticated corridor that has durable, audited implementations:

- wallet-backed authentication and session management;
- encrypted health records;
- time-bound provider access and consent;
- FHIR R4 import and mapping;
- privacy controls, access history, and security settings;
- operational health, release, API-schema, and live network telemetry.

Production always resolves to the fail-closed `pilot` profile. Deferred APIs
return `503 FEATURE_DISABLED` before their handlers execute, and deferred pages
are rewritten to the application 404. Setting `SHIORA_PROFILE=full` cannot
enable them in production.

## Runtime topology

```text
Browser
  |
  | HTTPS
  v
Next.js application
  |-- page middleware: nonce-based CSP and production page gating
  |-- API middleware: origin checks, request IDs, no-store, maturity headers
  |-- wallet challenge and signed session verification
  |
  +--> Postgres
  |      encrypted PHI, access grants, consent, sessions, audit chain
  |
  +--> managed key service
  |      data-key wrapping and key-version custody
  |
  +--> Aethelred EVM JSON-RPC
         chain ID, latest/recent blocks, gas utilization, transaction rate
```

Optional services are configuration-gated and fail closed. A missing database,
key provider, required TLS setting, or configured integration prevents the
corresponding production operation from claiming success.

## Frontend

The application uses Next.js 15 App Router, React 18, strict TypeScript,
Tailwind CSS, TanStack Query, and Zod.

Production navigation exposes only:

| Route       | Purpose                                                 |
| ----------- | ------------------------------------------------------- |
| `/`         | Owner-scoped record, storage, access, and audit summary |
| `/records`  | Upload, list, inspect, and remove encrypted records     |
| `/access`   | Grant, modify, revoke, and inspect provider access      |
| `/fhir`     | Import and map supported FHIR R4 resources              |
| `/settings` | Session, security, recovery, and account controls       |

`AppProvider` owns only authenticated wallet state, notifications, and search
state. It does not generate wallet addresses, balances, health metrics, chain
metrics, enclave status, or transaction history. Wallet restoration is accepted
only after the server revalidates the session, and the public-testnet chain ID
is pinned to `7332`.

Live remote state is handled by TanStack Query:

- record and access hooks query authenticated APIs;
- the network hook polls `/api/network/status`;
- unavailable dependencies render an explicit unavailable state;
- no client timer fabricates changing operational values.

## API and trust boundaries

### Authentication

The wallet flow obtains a single-use server challenge, signs the required
message through the selected wallet, and exchanges it for a signed,
server-revocable session. Production requests rely on the session; client
headers cannot bypass wallet verification.

Sensitive actions enforce authorization and, where configured, step-up
authentication. Mutating requests are rejected when their browser origin is
not allow-listed.

### Records

Record plaintext is encrypted with a per-record data-encryption key using
AES-256-GCM. The data key is wrapped by the configured key provider and the
ciphertext is bound to its owner and record identifier through authenticated
additional data. Production refuses to use the in-memory datastore.

```text
authenticated owner
  -> validate request and provenance
  -> generate per-record data key
  -> encrypt and bind owner:record-id
  -> wrap data key with current key version
  -> persist ciphertext and metadata
  -> append tamper-evident audit event
```

### Provider access

Grant validation is related to the authenticated owner, verified provider,
selected record scope, expiry, and policy constraints. Access is never granted
merely because a file was uploaded. A provider read succeeds only when a
current grant covers the requested record, and the read is appended to the
owner-visible audit history.

### FHIR

FHIR imports accept only supported R4 resource shapes, validate the request,
preserve provenance, and route resulting records through the same encryption
and owner-scoping boundary. Unsupported or malformed resources fail with a
structured validation error.

## Live Aethelred telemetry

`GET /api/network/status` requires `SHIORA_L1_RPC_URL`. The server queries:

- `eth_chainId`;
- `eth_getBlockByNumber` for the latest and recent blocks.

The response derives block height, recent blocks, transaction rate, and
gas-based network load from the RPC result. Epoch and token price are `null`
because the EVM interface does not provide an auditable source for them.
Missing configuration returns `503`; an unavailable or invalid RPC response
returns `502`.

## Deferred capabilities

Advanced clinical, confidential-compute, marketplace, governance, staking,
reward, research, genomics, digital-twin, and related demonstration surfaces
are excluded from production. Development fixtures may exercise those
interfaces in tests, but they cannot be enabled in a production process by an
environment override.

The authoritative production boundary is:

- `src/lib/api/feature-flags.ts`;
- `src/lib/api/config-lint.ts`;
- `src/middleware.ts`;
- `docs/PILOT_SCOPE.md`.

## Security controls

- nonce-based Content Security Policy for page responses;
- no-execution CSP and `no-store` for APIs;
- strict origin validation for mutations;
- signed, revocable sessions with secure production cookies;
- MFA and recovery controls;
- encrypted PHI with versioned key rotation;
- append-only tamper-evident audit events;
- durable rate limiting and idempotency;
- production configuration linting;
- liveness, readiness, release provenance, and service-status endpoints.

## Deployment requirements

Before processing live PHI, operators must provide and validate:

1. TLS termination and approved browser origins;
2. managed Postgres with backups and restore testing;
3. managed key custody and a documented rotation procedure;
4. Aethelred public-testnet RPC connectivity for live telemetry;
5. production secrets and release provenance;
6. external security, privacy, and regulatory approvals required by the pilot.

Run `npm run config:lint`, `npm run type-check`, `npm run lint`, the test suite,
and `npm run build` as release gates. `/api/health/ready` must pass in the
deployed environment before traffic is admitted.
