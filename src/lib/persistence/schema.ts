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

// Explicitly revoked session tokens (logout / "this device"). A row exists only
// for a jti that has been revoked; it is kept until the token would expire
// anyway, then pruned.
export const REVOKED_TOKENS_DDL = `
CREATE TABLE IF NOT EXISTS revoked_tokens (
  jti        text   NOT NULL,
  expires_at bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (jti)
);
`.trim();

export const REVOKED_TOKENS_EXPIRY_INDEX_DDL = `
CREATE INDEX IF NOT EXISTS idx_revoked_tokens_expiry
  ON revoked_tokens (expires_at);
`.trim();

// Per-subject "sign out everywhere" cutoff: any token issued at or before
// min_issued_at is invalid. One row per wallet address.
export const SESSION_EPOCHS_DDL = `
CREATE TABLE IF NOT EXISTS session_epochs (
  subject        text   NOT NULL,
  min_issued_at  bigint NOT NULL,
  updated_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (subject)
);
`.trim();

/** Ordered list of statements that bring a fresh database up to schema. */
// Issued-session index (GAP-08): one row per issued token so users can see
// and revoke individual devices. Rows expire with the token and are pruned
// by store maintenance.
export const SESSIONS_DDL = `
CREATE TABLE IF NOT EXISTS sessions (
  jti TEXT PRIMARY KEY,
  subject TEXT NOT NULL,
  issued_at BIGINT NOT NULL,
  expires_at BIGINT NOT NULL,
  user_agent TEXT NOT NULL DEFAULT '',
  ip TEXT NOT NULL DEFAULT ''
)`.trim();

export const SESSIONS_SUBJECT_INDEX_DDL = `
CREATE INDEX IF NOT EXISTS sessions_subject_idx ON sessions (subject, expires_at)`.trim();

// Idempotency keys (GAP-17): stores the outcome of a mutating request keyed by
// a client-supplied Idempotency-Key so a retry replays the original response
// instead of acting twice. status NULL marks an in-flight request.
export const IDEMPOTENCY_DDL = `
CREATE TABLE IF NOT EXISTS idempotency_keys (
  key         TEXT PRIMARY KEY,
  fingerprint TEXT NOT NULL,
  status      INTEGER,
  body        TEXT,
  created_at  BIGINT NOT NULL,
  expires_at  BIGINT NOT NULL
)`.trim();

export const IDEMPOTENCY_EXPIRY_INDEX_DDL = `
CREATE INDEX IF NOT EXISTS idempotency_keys_expiry_idx ON idempotency_keys (expires_at)`.trim();

// Optimistic-concurrency version columns (GAP-18). Additive ALTERs so existing
// tables gain the column with a safe default; new tables already have it via
// the CREATE statements below is not needed — these ALTERs are idempotent.
export const HEALTH_RECORDS_VERSION_DDL =
  `ALTER TABLE health_records ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1`;
export const DOCUMENTS_VERSION_DDL =
  `ALTER TABLE documents ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1`;

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
  REVOKED_TOKENS_DDL,
  REVOKED_TOKENS_EXPIRY_INDEX_DDL,
  SESSION_EPOCHS_DDL,
  SESSIONS_DDL,
  SESSIONS_SUBJECT_INDEX_DDL,
  IDEMPOTENCY_DDL,
  IDEMPOTENCY_EXPIRY_INDEX_DDL,
  HEALTH_RECORDS_VERSION_DDL,
  DOCUMENTS_VERSION_DDL,
];
