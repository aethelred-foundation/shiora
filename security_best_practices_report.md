# Shiora Security Best Practices Report

## Executive Summary

I completed a production-hardening pass across the Shiora dApp’s API boundary and deployment baseline. The repo now has signed session cookies, stricter API middleware, safer origin handling, and stateful runtime behavior for core record/access/consent flows. The application also builds successfully and the current automated suite passes with 398 tests.

Shiora is still **not yet 100% production-ready** for a regulated-industry launch. The biggest remaining blockers are architectural rather than syntax-level: the UI data layer is still largely mock-backed, wallet authentication is still placeholder-grade, the server store is still in-memory, and the project remains on a Next.js 14 dependency line that should be upgraded before public deployment.

## Critical Remaining Findings

### SBP-001 — Unsupported Next.js dependency line remains a deployment blocker

- Severity: Critical
- Location: `package.json:23`, `package.json:42`
- Evidence: The app still declares `next: "^14.1.0"` and `eslint-config-next: "^14.1.0"`.
- Impact: The current dependency line is older than the patched modern lines called out in the stack guidance, so this remains a real supply-chain and framework exposure risk for an internet-facing healthcare app.
- Fix: Upgrade to a supported, patched Next.js line and re-run the full test/build matrix after the dependency install.
- Mitigation: Block public deployment until the framework upgrade is completed and validated.

### SBP-002 — The frontend application layer is still mostly mock-backed

- Severity: Critical
- Location: `src/hooks/useHealthRecords.ts:4-6`, `src/hooks/useHealthRecords.ts:93-99`, `src/hooks/useAccessControl.ts:4-6`, `src/hooks/useAccessControl.ts:112-118`
- Evidence: The user-facing hooks explicitly describe themselves as mock service layers and continue to generate deterministic fake data client-side.
- Impact: Even with hardened API routes, the UI is not yet end-to-end wired to real server behavior, so the product cannot honestly be treated as a fully functional production dApp.
- Fix: Replace the mock hook service layers with real fetch/mutation clients against the secured API routes, then add integration tests that exercise browser-to-API flows.
- Mitigation: Treat the current app as a hardened prototype until the hook layer is migrated.

### SBP-003 — Wallet authentication is still placeholder-grade

- Severity: High
- Location: `src/app/api/wallet/connect/route.ts:48-56`
- Evidence: The connect route now requires a non-empty signature, but it still explicitly documents that chain-native verification has not been implemented yet.
- Impact: A determined attacker could bypass the current wallet proof gate if this shipped unchanged, which is unacceptable for health-data authorization.
- Fix: Replace the placeholder check with real Aethelred wallet signature verification and a replay-resistant challenge flow.
- Mitigation: Keep this flow behind controlled environments until cryptographic verification is implemented.

### SBP-004 — Stateful API data is still process-local rather than durable

- Severity: High
- Location: `src/lib/api/store.ts:23-32`, `src/lib/api/store.ts:103-114`
- Evidence: Records, grants, consents, and listings are now stored in a shared in-memory runtime store on `globalThis`.
- Impact: Data resets on process restart, does not coordinate across instances, and cannot satisfy auditability, durability, or HA expectations for regulated production workloads.
- Fix: Replace the runtime store with durable infrastructure such as Postgres plus audited object storage/IPFS/KMS integration.
- Mitigation: Use the current store only for controlled demos, local integration, or preview deployments.

## Remediated Findings

### SBP-005 — Added signed session cookies and verification helpers

- Severity: Fixed
- Location: `src/lib/api/session.ts:46-124`
- Evidence: Sessions are now HMAC-signed, verified with constant-time comparison, and stored in `HttpOnly`, `SameSite=Lax` cookies.
- Impact: This removes the previous “opaque mock session token in JSON” pattern and establishes a safer baseline for wallet-backed API auth.

### SBP-006 — Added stricter API middleware and origin controls

- Severity: Fixed
- Location: `src/lib/api/middleware.ts:31-66`, `src/lib/api/middleware.ts:147-246`, `src/middleware.ts:1-72`
- Evidence: The API now has request fingerprint rate limiting, authenticated session extraction, origin checks for mutating requests, request IDs, and no-store behavior at the edge layer.
- Impact: This closes several easy abuse paths around spoofed identity, overly-permissive cross-origin access, and cache leakage.

### SBP-007 — Core sensitive routes now require auth and keep coherent runtime state

- Severity: Fixed
- Location: `src/app/api/records/route.ts:29-131`, `src/app/api/records/[id]/route.ts:28-143`, `src/app/api/access/route.ts:29-121`, `src/app/api/consent/route.ts:34-175`
- Evidence: The key health-data and consent flows now require authenticated wallets and persist changes through the shared server store instead of returning non-persistent mock success objects.
- Impact: The platform boundary is materially closer to a real application instead of a purely decorative API surface.

### SBP-008 — Deployment metadata baseline is cleaner and build-safe

- Severity: Fixed
- Location: `src/app/layout.tsx:5-35`, `.env.example:8-20`, `next.config.js`
- Evidence: Metadata now defines `metadataBase`, `themeColor` moved to `viewport`, and the repo documents the new server-side session/origin env requirements.
- Impact: This removes build-time metadata issues and makes the deployment contract more explicit for operators.

## Verification

- `npm run type-check`
- `npm test -- --runInBand`
- `npm run build`

## Recommended Next Steps

1. Upgrade Next.js and re-lock dependencies on a supported release line.
2. Replace all mock hook service layers with real API clients.
3. Implement chain-native wallet signature verification with replay protection.
4. Replace the in-memory runtime store with durable, replicated infrastructure.
5. Add observability, audit-log export, secret rotation, and disaster-recovery controls before any regulated deployment.
