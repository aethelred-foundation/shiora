/** @jest-environment node */

const pgQuery = jest.fn().mockResolvedValue({ rows: [] });

jest.mock('@/lib/persistence/sql-client', () => ({
  getPgClient: jest.fn(() => ({ query: pgQuery })),
}));

import { PersistentAuditLog, getAuditLog, __resetAuditLogForTests } from '@/lib/api/audit-log';
import { InMemoryDocumentStore } from '@/lib/persistence/document-store';

function entry(action: 'RECORD_CREATE' | 'GRANT_CREATE' | 'ROLE_ASSIGN', actor: string, resource: string, timestamp?: string) {
  return { action, actor, resource, resourceId: 'r1', success: true, timestamp } as const;
}

describe('PersistentAuditLog', () => {
  const original = process.env.DATABASE_URL;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = original;
    }
    __resetAuditLogForTests();
    jest.clearAllMocks();
  });

  it('persists a tamper-evident chain that verifies', async () => {
    const log = new PersistentAuditLog(new InMemoryDocumentStore());
    const a = await log.record(entry('RECORD_CREATE', 'aeth1a', 'record'));
    const b = await log.record(entry('GRANT_CREATE', 'aeth1b', 'access-grant'));

    expect(a.seq).toBe(0);
    expect(b.seq).toBe(1);
    expect(b.prevHash).toBe(a.hash);

    const verification = await log.verify();
    expect(verification.valid).toBe(true);
    expect(verification.length).toBe(2);
  });

  it('rehydrates the chain head from the store for a new instance', async () => {
    const store = new InMemoryDocumentStore();
    const first = new PersistentAuditLog(store);
    await first.record(entry('RECORD_CREATE', 'aeth1a', 'record'));
    await first.record(entry('GRANT_CREATE', 'aeth1b', 'access-grant'));

    // A fresh instance over the same store must continue the existing chain.
    const second = new PersistentAuditLog(store);
    const third = await second.record(entry('ROLE_ASSIGN', 'aeth1c', 'role'));
    expect(third.seq).toBe(2);

    expect((await second.verify()).valid).toBe(true);
    expect((await second.list()).length).toBe(3);
  });

  it('lists most-recent-first and applies filters', async () => {
    const log = new PersistentAuditLog(new InMemoryDocumentStore());
    await log.record(entry('RECORD_CREATE', 'aeth1a', 'record', '2026-01-01T00:00:00.000Z'));
    await log.record(entry('GRANT_CREATE', 'aeth1b', 'access-grant', '2026-02-01T00:00:00.000Z'));
    await log.record(entry('ROLE_ASSIGN', 'aeth1a', 'role', '2026-03-01T00:00:00.000Z'));

    const all = await log.list();
    expect(all[0].action).toBe('ROLE_ASSIGN'); // newest first

    expect(await log.list({ actor: 'aeth1a' })).toHaveLength(2);
    expect(await log.list({ action: 'GRANT_CREATE' })).toHaveLength(1);
    expect(await log.list({ resource: 'role' })).toHaveLength(1);
    expect(await log.list({ since: '2026-02-15T00:00:00.000Z' })).toHaveLength(1);
    expect(await log.list({ limit: 1 })).toHaveLength(1);
  });

  it('exposes a process-wide singleton that resets for tests', async () => {
    delete process.env.DATABASE_URL;
    __resetAuditLogForTests();
    const log = getAuditLog();
    expect(getAuditLog()).toBe(log); // same instance
    await log.record(entry('RECORD_CREATE', 'aeth1a', 'record'));
    expect((await log.list()).length).toBe(1);
  });

  it('uses the Postgres-backed store when DATABASE_URL is configured', async () => {
    process.env.DATABASE_URL = 'postgres://localhost/shiora';
    __resetAuditLogForTests();
    expect(await getAuditLog().list()).toEqual([]);
    expect(pgQuery).toHaveBeenCalled();
  });
});
