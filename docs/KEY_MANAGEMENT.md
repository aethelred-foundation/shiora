# Shiora — Key Management Architecture

Adopted 2026-07-11 per external consultant review. This is the formal key
architecture: what keys exist, where they live, how they rotate, and what
happens on compromise. The implementation seams referenced here are in
`src/lib/crypto/` (`key-provider.ts`, `dek-wrapper.ts`, `derived-secrets.ts`,
`envelope.ts`).

## Key inventory & domains

| Key | Purpose | Custody | Derivation |
|---|---|---|---|
| **KEK** (key-encryption key) | Wraps per-record DEKs | Vault/KMS (production) | Root; versioned |
| **DEK** (per record/document) | AES-256-GCM PHI envelope | Random per write, stored only wrapped | `crypto.randomBytes(32)` |
| Session HMAC key | Signs session cookies | Derived | HKDF(`shiora/session-hmac/v1`) |
| Challenge HMAC key | Signs auth challenges | Derived | HKDF(`challenge-hmac/v1`) |
| Audit-chain MAC key | Keys the tamper-evident chain | Derived | HKDF(`audit-chain-mac/v1`) |
| Step-up assertion key | Signs MFA step-up assertions | Derived | HKDF(`mfa-stepup/v1`) |
| Blind-index key | Searchable-encryption tokens | Derived | HKDF(`blind-index/v1`) |
| Audit-export signing key | Signs WORM export bundles | Derived | HKDF(`audit-export/v1`) |
| Webhook signing secrets | Per-subscription HMAC | Random per subscription, stored sealed | — |
| Client sealing key | On-device field encryption | Never server-side | Wallet-signature HKDF (see §Client sealing) |

Every HMAC domain is separated by an HKDF label (RFC 5869) — one leaked
derived key never exposes another domain (Tier-1 finding L-03).

## Custody model

**Development** — `SHIORA_DATA_ENCRYPTION_KEY` env key (in-memory data only).

**Production (interim, approved for staging only)** — KEK fetched once at boot
from Vault KV-v2 (`vault-key-provider.ts`), held in process memory, never in
config files.

**Production (target, per consultant review)** — **Vault Transit** via the
`DekWrapper` seam (`dek-wrapper.ts`): the application submits each DEK to
`transit/encrypt` and each wrapped DEK to `transit/decrypt`; **the master key
never enters application memory**. Implemented and fully tested
(`VaultTransitDekWrapper`, selected when `SHIORA_TRANSIT_KEY_NAME` +
`SHIORA_VAULT_ADDR`/`TOKEN` are set; TLS enforced to non-local Vault;
fail-closed on every transport/status/shape surprise). AWS KMS / GCP KMS
`Encrypt`/`Decrypt` are drop-in behind the same interface.

**Adoption status (honest):** the PHI envelope read/write path
(`envelope.ts` → encrypted repositories) still wraps DEKs with the in-process
KEK synchronously. Re-plumbing it onto the async `DekWrapper` seam (making
seal/open async through both repositories, the re-seal job, and the IPFS
service) is the tracked next engineering step and a pilot go/no-go gate — the
custody backend is ready; the plumbing is the remaining work.

## Environments & separation

- Separate Vault namespaces/keys per environment: `shiora-kek-dev`,
  `shiora-kek-staging`, `shiora-kek-prod`. No key material crosses
  environments; a staging restore into production is a key mismatch by design.
- The application's Vault token carries a policy scoped to exactly its Transit
  key's `encrypt`/`decrypt` (not `keys`, not `export`, not other paths).
- Vault audit logs export to an independent security account, not the
  application's cloud account.

## Rotation

- **KEK/Transit rotation:** rotate the Vault Transit key (or bump
  `SHIORA_DATA_ENCRYPTION_KEY_VERSION` under interim custody). New writes wrap
  under the new version immediately; the **back catalog** is re-wrapped by the
  batched, cursor-resumable re-seal job (`POST /api/system/kek-reseal`) until
  it reports completion. Envelopes record the wrapping version
  (`sealed.v`), so mixed-version reads work throughout.
- **Derived keys** rotate with their root and their HKDF label version
  (`.../v1` → `/v2`) — bump the label only with a migration plan for data the
  old MAC signed.
- Cadence: annually, on personnel change with key access, and on any
  suspicion of compromise.

## Compromise runbook

1. **Suspicion of KEK/token exposure:** revoke the application's Vault token
   (Transit custody makes this an immediate, total cut-off), issue a new one,
   rotate the Transit key, run the re-seal job to completion.
2. **Confirmed data + key exposure:** treat as a breach (incident process,
   notification obligations per DPA/ADHICS); rotate everything; force
   re-authentication by bumping the session epoch ("sign out everywhere").
3. **Two-person rule:** destructive key operations (Transit key deletion,
   removal of a historical KEK version, retention-window changes) require two
   authorized operators — enforced organizationally and, where the backend
   supports it (Vault `min_decryption_version` changes), by policy.

## Backups and crypto-shredding

- Database backups contain **only wrapped DEKs and sealed ciphertext** — a
  backup is useless without key custody, and restoring one cannot resurrect
  crypto-shredded records: the shred tombstones the wrapped DEK in the row,
  and the restore brings back ciphertext whose DEK no longer exists anywhere.
- Never back up KEK material alongside the database, and never snapshot Vault
  into the same storage account as data backups.
- After a restore, run the audit chain `verify()` and compare the release
  manifest before serving traffic (see `docs/RELEASE_PROCESS.md`).

## Client sealing (wallet-derived) — production caveat

The on-device field-sealing key is currently derived from a wallet signature
(HKDF). The consultant review flags the operational risk: wallet loss means
data loss, and signature-encoding differences across wallets can break
derivation. Production direction: bind the client sealing key to a passkey/
device-held key (WebAuthn PRF where available) with an explicit, documented
recovery design, keeping the wallet as an account-binding and consent-signing
mechanism — not the sole root of health-data decryption. Until that lands,
client sealing remains limited to the vault's optional free-text field, with
the loss consequence stated in the UI.

## Algorithm agility

Envelopes carry the algorithm implicitly (AES-256-GCM) and the key version
explicitly. Any future algorithm change introduces a new envelope `alg` field
with a migration through the re-seal job — old envelopes remain readable until
re-sealed, then the old path is removed. Post-quantum note: data-at-rest
symmetric crypto (AES-256) is not the PQ-exposed surface; key custody and
transport are addressed at the Vault/TLS layer, and the Aethelred L1 provides
ML-DSA/ML-KEM for chain-side operations.
