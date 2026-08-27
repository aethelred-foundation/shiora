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

**Production enforcement (consultant §7).** A production boot **fails closed**
without Vault Transit: the preflight adds `KEY_CUSTODY_NOT_TRANSIT` when
`SHIORA_TRANSIT_KEY_NAME` (+ `SHIORA_VAULT_ADDR`/`TOKEN`) is unset, so production
can never silently custody PHI DEKs with the in-process local KEK — a
"reversible cutover" cannot become a silent downgrade. Every DEK wrap is metered
by backend (`shiora_dek_wrap_total{backend}`); in production the `local-kek`
count must stay **zero** (all new writes go through Transit), and a non-zero
value is a custody regression to alert on. The stock of not-yet-migrated legacy
envelopes is drained to zero by the re-seal job after a cut-over (§Rotation).

**Adoption status: ADOPTED.** The PHI envelope path is async end to end and
wraps/unwraps every DEK through `getDekWrapper()`: `envelope.ts` → both
encrypted repositories (`encrypted-documents.ts`, `encrypted-records.ts`) →
the re-seal job (`kek-reseal.ts`) → the IPFS object service. Configuring
Transit switches the entire PHI write path onto Vault custody with no code
change; the local KEK remains the development/single-tenant backend behind
the same seam. See §Envelope wire format for how mixed-custody reads work
during (and after) a cut-over.

### Envelope wire format & mixed-custody reads

Sealed values record which custody wrapped their DEK:

- `sealed.v` — the wrapping-key version (unchanged semantics): the local KEK
  version, or the Transit key version parsed from the `vault:v<N>:...`
  ciphertext.
- `sealed.wrap` — the custody backend, `local-kek` or `vault-transit`.
  Envelopes sealed **before** this adoption carry no `wrap` field and keep the
  legacy inline local-KEK wrap (base64url `iv:tag:ciphertext`, AAD-bound to
  the `shiora/dek-wrap/v1` domain); they remain readable until re-sealed.

Every envelope opens through the backend it names, so reads are
mixed-custody safe throughout a migration: after a Transit cut-over,
historical local-KEK and legacy envelopes still open through the local path,
while a Transit-wrapped envelope opens ONLY through Vault and fails closed
when Transit is not configured. The re-seal job migrates custody as well as
key versions — an envelope is rewritten when its backend differs from the
active one (the legacy format included) or its version is superseded — so one
completed run after a cut-over leaves the whole corpus under the new custody
and retires the legacy format. The job learns the current Transit key version
by wrapping a throwaway probe DEK, because its token deliberately lacks
key-metadata read rights (see §Environments & separation).

At process startup, a configured Transit deployment also wraps one throwaway
DEK through the scoped production key. The probe has a bounded network timeout
and the process fails closed when the key, policy, or service is unavailable;
the plaintext probe is zeroed and never persisted.

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

## Client sealing (wallet-derived) — excluded from the pilot (consultant §4)

The on-device field-sealing key is derived from a wallet signature (HKDF,
`useFieldKey` → `client-field-encryption.ts`). The review flagged the risk that
account recovery may restore the *account* without restoring *data* sealed to a
lost wallet.

**Resolution for the pilot — the risk does not reach the pilot corridor:**

- Wallet-derived client sealing is used in **exactly one place**: the optional
  free-text field of the **cycle/symptom vault** (`VaultComponents.tsx`). It is
  **browser-only** — no server route reads or writes a client-sealed value.
- The `vault` surface is **deferred under `SHIORA_PROFILE=pilot`** (it answers
  `503 FEATURE_DISABLED`, `docs/PILOT_SCOPE.md`). So **no pilot-enabled field is
  sealed to a wallet-derived key**, and there is nothing a lost wallet can make
  unrecoverable in the pilot. Enforced by an invariant test
  (`src/__tests__/security/client-sealing-pilot-exclusion.test.ts`).
- Every **pilot-enabled** encrypted field (records, consent, clinical notes,
  profile, notifications, recovery codes) uses **server-custodied envelope
  encryption** (DEK wrapped by the KEK/Transit, §Custody), owner-scoped by the
  authenticated identity — recoverable for as long as the account identity is
  recoverable, independent of any single wallet key.

**When the vault is later enabled**, the wallet-derived mode is offered only as
an explicitly-disclosed **"non-recoverable private vault"** (the loss
consequence stated before use) and kept **out of any clinical or emergency
workflow** (break-glass reads server-custodied records only). The production
direction remains: bind the client key to a random data key wrapped to multiple
authorized passkeys/devices (WebAuthn PRF), or a designed recovery key that can
rewrap it — keeping the wallet as an identity/consent-signing mechanism, not the
sole root of health-data decryption.

## Algorithm agility

Envelopes carry the algorithm implicitly (AES-256-GCM) and the key version
explicitly. Any future algorithm change introduces a new envelope `alg` field
with a migration through the re-seal job — old envelopes remain readable until
re-sealed, then the old path is removed. Post-quantum note: data-at-rest
symmetric crypto (AES-256) is not the PQ-exposed surface; key custody and
transport are addressed at the Vault/TLS layer, and the Aethelred L1 provides
ML-DSA/ML-KEM for chain-side operations.
