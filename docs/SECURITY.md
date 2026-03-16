# Shiora Health AI -- Security Documentation

## Security Model Overview

Shiora Health AI implements a defense-in-depth security architecture designed to protect sensitive women's health data at every layer. The core principle is that health data is encrypted before it leaves the user's browser and can only be decrypted inside a Trusted Execution Environment (TEE) -- never on a standard server.

### Security Layers

```
Layer 1: Client-Side Encryption (AES-256-GCM)
   |
Layer 2: Transport Security (TLS 1.3 + Strict CSP)
   |
Layer 3: TEE Processing (Intel SGX / AWS Nitro)
   |
Layer 4: Blockchain Verification (Aethelred L1)
   |
Layer 5: Access Control (Smart Contract-Enforced)
   |
Layer 6: Audit Trail (On-Chain, Immutable)
```

## Encryption Standards

### Client-Side Encryption

All health data is encrypted in the browser before transmission using:

- **Algorithm**: AES-256-GCM (Galois/Counter Mode)
- **Key size**: 256-bit
- **IV**: 96-bit random nonce per encryption
- **Authentication tag**: 128-bit

#### Key Derivation

```
User Master Key
      |
  HKDF-SHA256 (with salt + context)
      |
  Per-Record Encryption Key (256-bit)
```

- User master keys are derived from the wallet private key using HKDF
- Each record gets a unique encryption key derived from the master key
- Keys are never transmitted or stored on servers

#### Encryption Flow

```
1. Generate random 96-bit IV
2. Derive per-record key from master key + record ID
3. Encrypt plaintext with AES-256-GCM(key, IV, plaintext)
4. Output: IV || ciphertext || auth_tag
5. Upload encrypted blob to IPFS
```

### Data at Rest

- Health records stored on IPFS as encrypted blobs
- Encryption metadata (algorithm, IV length) stored on-chain
- No plaintext data exists outside the user's browser or TEE enclaves

### Data in Transit

- All API communication over TLS 1.3
- Certificate pinning recommended for mobile clients
- WebSocket connections use WSS (TLS-encrypted)
- HSTS enforced with max-age=31536000

## TEE Attestation Flow

### Overview

Trusted Execution Environments (TEEs) provide hardware-enforced isolation for processing sensitive health data. TEE attestation cryptographically proves that:

1. The enclave is running unmodified, signed code
2. The AI model weights have not been tampered with
3. The computation was performed correctly
4. No data was leaked outside the enclave

### Supported Platforms

| Platform   | Hardware                     | Use Case                     |
|------------|------------------------------|------------------------------|
| Intel SGX  | Intel Xeon with SGX support  | Primary inference platform   |
| AWS Nitro  | AWS EC2 instances            | Cloud-native deployments     |
| AMD SEV    | AMD EPYC processors         | Alternative compute          |

### Attestation Protocol

```
1. INITIALIZE
   Enclave loads signed AI model binary
   Enclave generates ephemeral keypair (enclave_pk, enclave_sk)
   Platform generates hardware measurement (MR_ENCLAVE)

2. CHALLENGE
   Client sends random nonce to enclave
   Client verifies enclave identity (MR_ENCLAVE matches expected value)

3. ATTEST
   Enclave signs: attestation = Sign(enclave_sk, {
     mr_enclave,
     mr_signer,
     model_hash,
     nonce,
     timestamp,
     platform_info
   })

4. VERIFY
   Client verifies attestation signature
   Client verifies MR_ENCLAVE matches expected value
   Client verifies model_hash matches known model
   Attestation hash registered on Aethelred L1

5. PROCESS
   Client sends encrypted data to enclave
   Enclave decrypts data inside secure memory
   Enclave runs AI inference
   Enclave encrypts results with client's public key
   Enclave generates inference attestation

6. DELIVER
   Client receives encrypted results + attestation
   Client decrypts results
   Inference attestation registered on blockchain
```

### Attestation Verification

Anyone can verify a TEE attestation:

```
GET /api/tee/attestation/:hash
```

The response includes the attestation validity, platform, timestamp, and the on-chain block height where it was registered.

## Access Control Model

### Permission Hierarchy

```
Patient (Data Owner)
  |
  +-- Full Control
  |     - Encrypt/decrypt own data
  |     - Grant/revoke provider access
  |     - View audit trail
  |     - Delete records
  |
  +-- Provider (Grantee)
        - Time-limited access window
        - Scope-restricted data access
        - TEE-only decryption
        - Actions audited on-chain
```

### Grant Properties

| Property    | Description                                   |
|-------------|-----------------------------------------------|
| Scope       | Which record types the provider can access     |
| Duration    | Time-limited expiry (e.g., 90 days)            |
| canView     | Permission to view records inside TEE          |
| canDownload | Permission to export decrypted data from TEE   |
| canShare    | Permission to share records with other providers |

### Smart Contract Enforcement

Access grants are enforced by the `AccessControlManager` smart contract:

```
function checkAccess(
  patientAddress,
  providerAddress,
  recordType,
  actionType
) -> bool

// The contract verifies:
// 1. Grant exists for this patient-provider pair
// 2. Grant has not expired
// 3. Grant has not been revoked
// 4. Record type is within granted scope
// 5. Action type is permitted (view/download/share)
```

### Revocation

Patients can instantly revoke provider access:

1. Patient calls `revokeGrant(grantId)` on the smart contract
2. Smart contract marks grant as revoked (effective immediately)
3. Provider can no longer decrypt or access any data
4. Revocation event logged on-chain with transaction hash

## HIPAA Compliance Considerations

### Covered Areas

| HIPAA Requirement          | Shiora Implementation                     |
|----------------------------|-------------------------------------------|
| Access controls            | Smart contract-enforced, wallet-based auth |
| Audit controls             | Immutable on-chain audit trail            |
| Integrity controls         | CID content-addressing, TEE attestations  |
| Transmission security      | TLS 1.3, E2E encryption (AES-256-GCM)    |
| Encryption at rest         | AES-256-GCM, keys derived from wallet     |
| Unique user identification | Aethelred wallet addresses                |
| Emergency access           | Multi-sig emergency recovery mechanism    |
| Automatic logoff           | JWT expiry, session timeout               |
| Backup and recovery        | IPFS multi-node pinning, on-chain CIDs    |
| Risk analysis              | Regular security audits, penetration tests |

### PHI Handling

- No Protected Health Information (PHI) is stored in plaintext on servers
- PHI exists only in encrypted form on IPFS and in plaintext only inside TEE enclaves
- API responses for health records return encrypted data, not plaintext
- Search/filtering operates on metadata only, never on PHI content

### Business Associate Agreements

Shiora operates with the following data handling guarantees:

- Infrastructure providers (cloud hosting) never have access to decryption keys
- IPFS nodes store only encrypted blobs (cannot read content)
- TEE enclaves process data in hardware-isolated memory
- No third-party analytics or tracking services have access to health data

## Security Headers

The application sets the following security headers via `next.config.js`:

| Header                    | Value                                    |
|---------------------------|------------------------------------------|
| X-Frame-Options           | DENY                                     |
| X-Content-Type-Options    | nosniff                                  |
| X-XSS-Protection          | 1; mode=block                            |
| Referrer-Policy           | strict-origin-when-cross-origin          |
| Strict-Transport-Security | max-age=31536000; includeSubDomains      |
| Permissions-Policy        | camera=(), microphone=(), geolocation=(), payment=() |
| Content-Security-Policy   | default-src 'self'; frame-ancestors 'none'; object-src 'none' |

## Bug Bounty Program

### Scope

The following assets are in scope for the bug bounty program:

- Shiora web application (shiora.health)
- Shiora API (api.shiora.health)
- Smart contracts on Aethelred L1
- TEE enclave implementation
- IPFS integration layer

### Severity Levels and Rewards

| Severity | Description                                           | Reward Range     |
|----------|-------------------------------------------------------|------------------|
| Critical | Unauthorized access to PHI, key compromise, TEE bypass | $5,000 - $25,000 |
| High     | Authentication bypass, privilege escalation            | $2,000 - $5,000  |
| Medium   | Information disclosure, CSRF, improper access control  | $500 - $2,000    |
| Low      | Minor information leaks, missing headers               | $100 - $500      |

### Reporting

Report vulnerabilities to: security@shiora.health

Include in your report:
1. Description of the vulnerability
2. Steps to reproduce
3. Potential impact assessment
4. Suggested remediation (optional)

### Response Timeline

| Action              | Target Time |
|---------------------|-------------|
| Acknowledgement     | 24 hours    |
| Triage              | 72 hours    |
| Fix deployed        | 7-14 days   |
| Reward payout       | 30 days     |

### Out of Scope

- Denial of service (DoS/DDoS)
- Social engineering attacks
- Physical attacks
- Attacks requiring compromised user devices
- Issues in third-party dependencies without a working exploit

## Security Audit Checklist

### Pre-Deployment

- [ ] All environment variables are set correctly (no defaults in production)
- [ ] JWT_SECRET is a cryptographically random 256-bit value
- [ ] TEE_ATTESTATION_KEY matches the production enclave signer
- [ ] IPFS_PINNING_SERVICE_KEY has minimal required permissions
- [ ] Database credentials use strong passwords
- [ ] TLS certificates are valid and not expiring soon
- [ ] Content-Security-Policy is configured correctly
- [ ] CORS is restricted to allowed origins only
- [ ] Rate limiting is enabled on all endpoints
- [ ] Error responses do not leak internal details

### Smart Contract Audit

- [ ] Access control functions require valid signatures
- [ ] Grant expiry is enforced at the contract level
- [ ] Revocation is immediate and irreversible
- [ ] No reentrancy vulnerabilities
- [ ] Integer overflow/underflow protections
- [ ] Event emission for all state changes
- [ ] Emergency pause mechanism available
- [ ] Multi-sig admin for contract upgrades

### TEE Security Audit

- [ ] MR_ENCLAVE matches the expected signed binary
- [ ] Model weights hash matches the expected value
- [ ] Attestation includes all required fields
- [ ] Side-channel attack mitigations are in place
- [ ] Enclave memory is properly cleaned after processing
- [ ] Sealing keys are rotated on schedule
- [ ] Attestation verification works on all supported platforms

### Operational Security

- [ ] Logs do not contain PHI or encryption keys
- [ ] Monitoring alerts are configured for anomalous access patterns
- [ ] Incident response plan is documented and tested
- [ ] Backup and recovery procedures are verified
- [ ] Access to production systems requires MFA
- [ ] Deployment pipeline requires code review approval
- [ ] Dependency vulnerability scanning is automated
- [ ] Security patches are applied within 72 hours of disclosure

### Client-Side Security

- [ ] Encryption keys are derived correctly from wallet
- [ ] AES-256-GCM IV is unique per encryption
- [ ] Sensitive data is cleared from memory after use
- [ ] No PHI in localStorage, sessionStorage, or cookies
- [ ] Service worker does not cache sensitive responses
- [ ] Input validation on all user-provided data
- [ ] XSS protections (CSP, sanitization)
- [ ] CSRF protections on all state-changing operations

## Incident Response

### Severity Classification

| Level    | Description                                       | Response Time |
|----------|---------------------------------------------------|---------------|
| P0       | PHI exposure, key compromise, TEE bypass          | Immediate     |
| P1       | Authentication bypass, unauthorized access         | 1 hour        |
| P2       | Data integrity issues, service degradation         | 4 hours       |
| P3       | Minor vulnerabilities, non-critical bugs           | 24 hours      |

### Response Steps

1. **Detect**: Automated monitoring or external report
2. **Contain**: Isolate affected systems, revoke compromised credentials
3. **Assess**: Determine scope, affected users, data exposure
4. **Remediate**: Deploy fix, rotate keys, update attestation keys
5. **Notify**: Inform affected users per HIPAA breach notification rules
6. **Review**: Post-incident review, update security controls

### Emergency Contacts

- Security team: security@shiora.health
- On-call engineer: via PagerDuty
- Legal/compliance: compliance@shiora.health
