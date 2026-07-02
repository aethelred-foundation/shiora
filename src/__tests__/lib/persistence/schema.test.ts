/** @jest-environment node */

import {
  AUDIT_CHAIN_DDL,
  DOCUMENTS_DDL,
  DOCUMENTS_OWNER_INDEX_DDL,
  HEALTH_RECORDS_DDL,
  HEALTH_RECORDS_OWNER_INDEX_DDL,
  RATE_LIMITS_DDL,
  RATE_LIMITS_WINDOW_INDEX_DDL,
  USED_NONCES_DDL,
  USED_NONCES_EXPIRY_INDEX_DDL,
  MIGRATIONS,
} from '@/lib/persistence/schema';

describe('persistence schema', () => {
  it('defines the health_records table with an encrypted PHI column', () => {
    expect(HEALTH_RECORDS_DDL).toContain('CREATE TABLE IF NOT EXISTS health_records');
    expect(HEALTH_RECORDS_DDL).toContain('sealed_phi    jsonb NOT NULL');
    expect(HEALTH_RECORDS_DDL).toContain('deleted       boolean NOT NULL DEFAULT false');
  });

  it('indexes non-deleted records by owner', () => {
    expect(HEALTH_RECORDS_OWNER_INDEX_DDL).toContain('idx_health_records_owner');
    expect(HEALTH_RECORDS_OWNER_INDEX_DDL).toContain('WHERE deleted = false');
  });

  it('defines the audit_chain table', () => {
    expect(AUDIT_CHAIN_DDL).toContain('CREATE TABLE IF NOT EXISTS audit_chain');
    expect(AUDIT_CHAIN_DDL).toContain('prev_hash  text NOT NULL');
  });

  it('defines the generic documents table with a sealed payload column', () => {
    expect(DOCUMENTS_DDL).toContain('CREATE TABLE IF NOT EXISTS documents');
    expect(DOCUMENTS_DDL).toContain('sealed     jsonb NOT NULL');
    expect(DOCUMENTS_DDL).toContain('PRIMARY KEY (collection, id)');
    expect(DOCUMENTS_OWNER_INDEX_DDL).toContain('idx_documents_owner');
  });

  it('defines the rate_limits table keyed by window bucket', () => {
    expect(RATE_LIMITS_DDL).toContain('CREATE TABLE IF NOT EXISTS rate_limits');
    expect(RATE_LIMITS_DDL).toContain('window_start bigint  NOT NULL');
    expect(RATE_LIMITS_DDL).toContain('PRIMARY KEY (key, window_start)');
    expect(RATE_LIMITS_WINDOW_INDEX_DDL).toContain('idx_rate_limits_window');
  });

  it('orders migrations: tables and their indexes, records, documents, rate limits, nonces', () => {
    expect(MIGRATIONS).toEqual([
      HEALTH_RECORDS_DDL,
      HEALTH_RECORDS_OWNER_INDEX_DDL,
      AUDIT_CHAIN_DDL,
      DOCUMENTS_DDL,
      DOCUMENTS_OWNER_INDEX_DDL,
      RATE_LIMITS_DDL,
      RATE_LIMITS_WINDOW_INDEX_DDL,
      USED_NONCES_DDL,
      USED_NONCES_EXPIRY_INDEX_DDL,
    ]);
  });

  it('single-use nonce DDL enforces a primary key on the nonce', () => {
    expect(USED_NONCES_DDL).toContain('CREATE TABLE IF NOT EXISTS used_nonces');
    expect(USED_NONCES_DDL).toContain('PRIMARY KEY (nonce)');
    expect(USED_NONCES_EXPIRY_INDEX_DDL).toContain('idx_used_nonces_expiry');
  });
});
