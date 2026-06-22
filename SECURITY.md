# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| Latest  | Yes       |

## Reporting a Vulnerability

The Aethelred Foundation takes security seriously. If you discover a security vulnerability in Shiora, please report it responsibly.

### How to Report

1. **Do NOT** open a public GitHub issue for security vulnerabilities.
2. Email **security@aethelred.io** with:
   - A description of the vulnerability
   - Steps to reproduce
   - Potential impact assessment
   - Any suggested fixes (optional)

### What to Expect

- **Acknowledgment** within 48 hours of your report.
- **Assessment** within 5 business days with an initial severity classification.
- **Resolution timeline** communicated based on severity:
  - **Critical**: Fix within 24-48 hours
  - **High**: Fix within 7 days
  - **Medium**: Fix within 30 days
  - **Low**: Fix in next scheduled release

### Scope

This policy applies to:
- The Shiora frontend application
- The backend API and AI services
- Smart contracts
- TEE attestation infrastructure
- CI/CD infrastructure

### Recognition

We credit reporters in our security advisories (unless anonymity is requested).

## Detailed Security Documentation

For comprehensive technical security documentation including the defense-in-depth architecture, encryption model, HIPAA/GDPR compliance details, and TEE attestation design, see [docs/SECURITY.md](docs/SECURITY.md).

## Security Measures

- All dependencies are monitored via Dependabot and `npm audit`
- Authentication uses secp256k1 wallet-signature verification with HMAC-signed, `__Host-`-scoped sessions
- Protected Health Information is encrypted at rest using AES-256-GCM envelope encryption with per-record keys (`src/lib/crypto/envelope.ts`)
- Access and mutation events are recorded in a tamper-evident, hash-chained audit log (`src/lib/crypto/audit-chain.ts`)
- Target architecture adds client-side encryption and TEE-only processing of decrypted data

Shiora is **designed for** HIPAA and GDPR. The current control status — what is
implemented today versus in progress — is tracked in
[docs/COMPLIANCE.md](docs/COMPLIANCE.md).
