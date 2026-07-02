// ============================================================
// Shiora on Aethelred — Postgres Schema (production datastore)
//
// DDL for the encrypted health-record datastore and the persisted audit
// chain. PHI is stored only in the `sealed_phi` JSONB column as an AES-256-GCM
// envelope (see src/lib/crypto/envelope.ts); the column never holds plaintext.
// Applied by the Postgres adapter's `migrate()` and verified end-to-end against
// an in-process Postgres engine in scripts/verify-datastore (see COMPLIANCE.md
// C-DB-1). Kept as plain SQL so it is reviewable and portable.
// ============================================================

export const HEALTH_RECORDS_DDL = `
CREATE TABLE IF NOT EXISTS health_records (
  id            text PRIMARY KEY,
  owner_address text NOT NULL,
  type          text NOT NULL,
  date          bigint NOT NULL,
  upload_date   bigint NOT NULL,
  cid           text NOT NULL,
  tx_hash       text NOT NULL,
  attestation   text NOT NULL,
  size          integer NOT NULL,
  provider      text NOT NULL,
  status        text NOT NULL,
  ipfs_nodes    integer NOT NULL,
  block_height  bigint NOT NULL,
  encryption    text NOT NULL,
  sealed_phi    jsonb NOT NULL,
  deleted       boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
`.trim();

export const HEALTH_RECORDS_OWNER_INDEX_DDL = `
CREATE INDEX IF NOT EXISTS idx_health_records_owner
  ON health_records (owner_address)
  WHERE deleted = false;
`.trim();

export const AUDIT_CHAIN_DDL = `
CREATE TABLE IF NOT EXISTS audit_chain (
  seq        bigint PRIMARY KEY,
  prev_hash  text NOT NULL,
  hash       text NOT NULL,
  entry      jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
`.trim();

export const DOCUMENTS_DDL = `
CREATE TABLE IF NOT EXISTS documents (
  collection text NOT NULL,
  owner_key  text NOT NULL,
  id         text NOT NULL,
  sealed     jsonb NOT NULL,
  deleted    boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (collection, id)
);
`.trim();

export const DOCUMENTS_OWNER_INDEX_DDL = `
CREATE INDEX IF NOT EXISTS idx_documents_owner
  ON documents (collection, owner_key)
  WHERE deleted = false;
`.trim();

// Cross-instance fixed-window rate limiting. One row per (key, window_start)
// bucket; the counter is incremented atomically with INSERT ... ON CONFLICT so
// horizontally-scaled instances share a single source of truth (see
// src/lib/persistence/pg-rate-limiter.ts). window_start is a bigint epoch-ms
// bucket boundary; stale rows are pruned out-of-band.
export const RATE_LIMITS_DDL = `
CREATE TABLE IF NOT EXISTS rate_limits (
  key          text    NOT NULL,
  window_start bigint  NOT NULL,
  count        integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (key, window_start)
);
`.trim();

export const RATE_LIMITS_WINDOW_INDEX_DDL = `
CREATE INDEX IF NOT EXISTS idx_rate_limits_window
  ON rate_limits (window_start);
`.trim();

// Single-use authentication nonces. A row exists only for a nonce that has been
// consumed; the PRIMARY KEY makes the first INSERT win and every replay lose.
export const USED_NONCES_DDL = `
CREATE TABLE IF NOT EXISTS used_nonces (
  nonce      text   NOT NULL,
  expires_at bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (nonce)
);
`.trim();

export const USED_NONCES_EXPIRY_INDEX_DDL = `
CREATE INDEX IF NOT EXISTS idx_used_nonces_expiry
  ON used_nonces (expires_at);
`.trim();

/** Ordered list of statements that bring a fresh database up to schema. */
export const MIGRATIONS: readonly string[] = [
  HEALTH_RECORDS_DDL,
  HEALTH_RECORDS_OWNER_INDEX_DDL,
  AUDIT_CHAIN_DDL,
  DOCUMENTS_DDL,
  DOCUMENTS_OWNER_INDEX_DDL,
  RATE_LIMITS_DDL,
  RATE_LIMITS_WINDOW_INDEX_DDL,
  USED_NONCES_DDL,
  USED_NONCES_EXPIRY_INDEX_DDL,
];
