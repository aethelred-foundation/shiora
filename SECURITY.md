# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in Shiora, please report it responsibly.

**Email:** [security@shiora.health](mailto:security@shiora.health)

Please include:

1. A description of the vulnerability
2. Steps to reproduce the issue
3. The potential impact
4. Suggested remediation (optional)

### Response Timeline

| Action | Target |
|---|---|
| Acknowledgement | 24 hours |
| Triage | 72 hours |
| Fix deployed | 7-14 days |
| Reward payout | 30 days |

## Bug Bounty Program

Shiora runs a bug bounty program covering the web application, API, smart contracts, TEE enclave implementation, and IPFS integration layer.

| Severity | Reward Range |
|---|---|
| Critical | $5,000-$25,000 |
| High | $2,000-$5,000 |
| Medium | $500-$2,000 |
| Low | $100-$500 |

## Security Architecture

Shiora implements defense-in-depth across six layers:

- **Client-side encryption** - AES-256-GCM before data leaves the browser
- **Transport security** - TLS 1.3 with strict CSP
- **TEE processing** - Intel SGX / AWS Nitro hardware isolation
- **Blockchain verification** - On-chain attestation via Aethelred L1
- **Access control** - Smart-contract-enforced, wallet-based auth
- **Audit trail** - Immutable on-chain logging

## Compliance

Shiora is designed with HIPAA and GDPR compliance in mind, including on-chain consent audit trails, right-to-erasure support, and a privacy rights dashboard.

## Full Security Documentation

For the complete security model, encryption standards, TEE attestation protocol, access control details, HIPAA mapping, security headers, audit checklists, and incident response procedures, see [docs/SECURITY.md](docs/SECURITY.md).

## Supported Versions

| Version | Supported |
|---|---|
| Latest | Yes |

## Out of Scope

- Denial of service (DoS/DDoS)
- Social engineering attacks
- Physical attacks
- Attacks requiring compromised user devices
- Issues in third-party dependencies without a working exploit
