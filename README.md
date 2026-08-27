<div align="center">
  <br/>
  <img src="README-logo.svg" alt="Shiora" width="200" />
  <h1>Shiora</h1>
  <p><strong>Sovereign women's-health data platform on the Aethelred ecosystem.</strong></p>
  <p>
    <a href="https://github.com/aethelred-foundation/shiora/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/aethelred-foundation/shiora/ci.yml?branch=main&style=flat-square&label=CI" alt="CI"></a>
    <a href="LICENSE"><img src="https://img.shields.io/badge/license-Apache--2.0-blue?style=flat-square" alt="License"></a>
    <img src="https://img.shields.io/badge/Next.js-15-000000?style=flat-square&logo=next.js" alt="Next.js">
    <img src="https://img.shields.io/badge/TypeScript-strict-3178C6?style=flat-square&logo=typescript" alt="TypeScript">
  </p>
</div>

---

## What Shiora is

Shiora gives a woman a trustworthy corridor for her health data: receive or import records, store them encrypted, grant and revoke access with granular consent, see exactly who touched her data, export it, and erase it irreversibly. The same capability-gated backend serves six audiences — individuals, providers, health plans, employers, researchers, and governments — under least-privilege role and capability enforcement.

> **Status: pre-production.** Shiora is in a controlled production-hardening phase targeting a narrow, invite-only pilot. It is **not** yet approved for unrestricted live-PHI use. No certification (HIPAA, SOC 2, HITRUST) is claimed; external security audit is pending. See [docs/CONSULTANT_STATUS_REPORT.md](docs/CONSULTANT_STATUS_REPORT.md) for the full, honest assessment.

## Claims match implementation

Every feature carries a maturity label in a machine-readable registry ([`src/lib/api/maturity.ts`](src/lib/api/maturity.ts)), surfaced at `GET /api/system/status` and stamped on every API response via an `X-Shiora-Maturity` header. A CI test fails the build if a label drifts.

| Tier           | Count | Meaning                                                                                                                                                      |
| -------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Production** | 26    | Real implementation — encrypted + audited where PHI is involved, Postgres-ready                                                                              |
| **Pilot**      | 10    | Functional and integrated, with one named remaining gap each                                                                                                 |
| **Simulated**  | 7     | Honestly labeled placeholders — deliberately **not** faked (they need hardware, a regulatory pathway, an external service, or a validated inference service) |

The simulated tier includes TEE attestation (verification code is real; enclave hardware is a deployment step), on-chain anchoring (contract proven against the real Aethelred node; live RPC target pending), clinical decision support, genomics, digital twin, inference explainability, and emergency response.

## Core capabilities (production tier)

- **Encrypted health records** — AES-256-GCM envelope encryption, per-record data keys wrapped by a versioned KEK, AAD-bound, owner-scoped.
- **Consent & access grants** — granular, time-bound, auto-expiring; providers see exactly what a patient shared, nothing else.
- **Tamper-evident audit** — HMAC-keyed hash-chained log, multi-process safe, publicly verifiable, with a subject dimension ("who accessed my data") and signed WORM export.
- **GDPR data-subject rights** — Access (Art. 15), Portability (Art. 20, real JSON/CSV/XML), Erasure (Art. 17 via **crypto-shredding**), retention enforcement (Art. 5(1)(e)).
- **Authentication** — Cosmos wallet (secp256k1, low-S enforced, single-use challenges), HMAC-signed `__Host-` sessions with server-side revocation, TOTP MFA with step-up, WebAuthn/FIDO2 passkeys.
- **Privacy computation** — transparent-setup zero-knowledge set-membership proofs, Shamir secret-sharing secure aggregation, blind-index searchable encryption, k-anonymity population analytics.
- **Operations** — structured JSON logs, Prometheus metrics, health probes, graceful degradation, distributed rate limiting, idempotency keys, optimistic concurrency, OpenAPI 3.1 contract (`GET /api/openapi`).
- **Internationalization & accessibility** — English + Arabic with app-wide RTL; jest-axe and Playwright axe gates in both reading directions.

## Stack

Next.js 15 (App Router) · React 18 · TypeScript strict · Tailwind · TanStack Query · Postgres (`pg`) · Zod. All cryptography is Node `crypto` / Web Crypto. External inference is isolated behind an operator-managed gateway with no vendor SDK in the application bundle. Production dependency audits for both the application and contracts report 0 vulnerabilities.

## Quality gates

- Jest: 303 suites / 4,796 tests at **100% coverage** (statements, branches, functions, lines) — a hard gate, not a target.
- Playwright E2E suite (`npm run test:e2e`) including accessibility scans.
- Load/perf smoke gate (`npm run perf`) + committed baseline ([perf/BASELINE.md](perf/BASELINE.md)).
- TypeScript strict + ESLint clean; production build green.

## Getting started (development)

```bash
npm install
cp .env.example .env.local   # defaults run fully in-memory; no external services needed
npm run dev                  # http://localhost:3001
```

```bash
npm test                     # unit/integration suite
npm run test:coverage        # with the 100% gate
npm run test:e2e             # Playwright (downloads Chromium on first run)
npm run type-check && npm run lint
```

Development uses an in-memory datastore (empty-start, no seeded data).
Production is pinned to the fail-closed pilot corridor and **refuses** the
in-memory store: it requires `DATABASE_URL`, managed key custody, and TLS.
Deferred APIs return 503 and their pages return 404. See
[.env.example](.env.example), [docs/PILOT_SCOPE.md](docs/PILOT_SCOPE.md), and
[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). The exact public-testnet installation
procedure is [docs/PUBLIC_TESTNET_RUNBOOK.md](docs/PUBLIC_TESTNET_RUNBOOK.md).
L1 audit anchoring remains disabled there until a dedicated compatible receiver
exists; the seal-attestation registry is not that receiver.

## Documentation

| Document                                                                                                | Purpose                                                        |
| ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| [docs/CONSULTANT_STATUS_REPORT.md](docs/CONSULTANT_STATUS_REPORT.md)                                    | Complete platform status, honest posture, open decisions       |
| [docs/TECHNOLOGY_GAP_ASSESSMENT.md](docs/TECHNOLOGY_GAP_ASSESSMENT.md)                                  | 28-gap hardening ledger (all closed, commit-referenced)        |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · [docs/API.md](docs/API.md)                               | System and API reference                                       |
| [docs/SECURITY.md](docs/SECURITY.md) · [docs/SECURITY_REMEDIATION.md](docs/SECURITY_REMEDIATION.md)     | Security posture and Tier-1 self-audit remediation             |
| [docs/COMPLIANCE.md](docs/COMPLIANCE.md) + [docs/compliance/](docs/compliance/)                         | HIPAA/GDPR control mapping and self-assessment work product    |
| [docs/ATTESTATION.md](docs/ATTESTATION.md)                                                              | TEE attestation verifier (SEV-SNP) — scope and honest boundary |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) · [docs/PRODUCTION_READINESS.md](docs/PRODUCTION_READINESS.md) | Operational requirements and gates                             |
| [docs/PUBLIC_TESTNET_RUNBOOK.md](docs/PUBLIC_TESTNET_RUNBOOK.md)                                        | Exact public-testnet fresh-install procedure                   |

## Honesty boundary

Shiora does **not** claim: HIPAA/SOC 2/HITRUST certification, SaMD clearance, live TEE processing, live mainnet anchoring, or diagnostic capability. Where marketing language and implementation have historically diverged, the implementation and this README are authoritative; anything not in the production tier of the maturity registry should be treated as not yet real.

## License

Apache-2.0 — see [LICENSE](LICENSE).
