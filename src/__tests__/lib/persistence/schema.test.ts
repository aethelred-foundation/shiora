/** @jest-environment node */

import {
  AUDIT_CHAIN_DDL,
  HEALTH_RECORDS_DDL,
  HEALTH_RECORDS_OWNER_INDEX_DDL,
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

  it('orders migrations: tables before their index dependency is fine, audit last', () => {
    expect(MIGRATIONS).toEqual([
      HEALTH_RECORDS_DDL,
      HEALTH_RECORDS_OWNER_INDEX_DDL,
      AUDIT_CHAIN_DDL,
    ]);
  });
});
