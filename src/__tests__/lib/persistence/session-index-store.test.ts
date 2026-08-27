/** @jest-environment node */

import {
  InMemorySessionIndexStore,
  getSessionIndexStore,
  __resetSessionIndexStoreForTests,
  type SessionRecord,
} from '@/lib/persistence/session-index-store';
import { PgSessionIndexStore } from '@/lib/persistence/pg-session-index-store';
import type { SqlClient } from '@/lib/persistence/sql-client';

afterEach(() => __resetSessionIndexStoreForTests());

function rec(over: Partial<SessionRecord> = {}): SessionRecord {
  return {
    jti: 'jti-1',
    subject: 'aeth1subject',
    issuedAt: 1_000,
    expiresAt: Date.now() + 60_000,
    userAgent: 'TestBrowser/1.0',
    ip: '10.0.0.1',
    ...over,
  };
}

describe('InMemorySessionIndexStore', () => {
  it('records and lists unexpired sessions for a subject, newest first', async () => {
    const store = new InMemorySessionIndexStore();
    await store.record(rec({ jti: 'a', issuedAt: 1000 }));
    await store.record(rec({ jti: 'b', issuedAt: 3000 }));
    await store.record(rec({ jti: 'c', issuedAt: 2000 }));
    await store.record(rec({ jti: 'other', subject: 'aeth1other' }));

    const sessions = await store.listForSubject('aeth1subject');
    expect(sessions.map((s) => s.jti)).toEqual(['b', 'c', 'a']);
  });

  it('is idempotent on jti (first write wins)', async () => {
    const store = new InMemorySessionIndexStore();
    await store.record(rec({ jti: 'dup', ip: 'first' }));
    await store.record(rec({ jti: 'dup', ip: 'second' }));
    expect((await store.get('dup'))!.ip).toBe('first');
  });

  it('excludes expired sessions from list and get', async () => {
    const store = new InMemorySessionIndexStore();
    const now = Date.now();
    await store.record(rec({ jti: 'gone', expiresAt: now - 1 }));
    await store.record(rec({ jti: 'alive', expiresAt: now + 60_000 }));

    expect(await store.get('gone')).toBeNull();
    expect(await store.get('missing')).toBeNull();
    expect((await store.listForSubject('aeth1subject')).map((s) => s.jti)).toEqual(['alive']);
  });

  it('sweeps expired sessions on write after the sweep interval', async () => {
    const store = new InMemorySessionIndexStore();
    const base = 2_000_000_000_000;
    const nowSpy = jest.spyOn(Date, 'now');
    nowSpy.mockReturnValue(base);
    await store.record(rec({ jti: 'short', expiresAt: base + 1_000 }));
    await store.record(rec({ jti: 'long', expiresAt: base + 10_000_000 }));
    nowSpy.mockReturnValue(base + 120_000);
    await store.record(rec({ jti: 'trigger', expiresAt: base + 200_000 })); // triggers sweep
    expect(await store.get('short', base + 120_000)).toBeNull(); // evicted
    expect(await store.get('long', base + 120_000)).not.toBeNull(); // kept
    nowSpy.mockRestore();
  });
});

describe('getSessionIndexStore selection', () => {
  it('is in-memory without DATABASE_URL, cached across calls', () => {
    delete process.env.DATABASE_URL;
    __resetSessionIndexStoreForTests();
    const a = getSessionIndexStore();
    expect(a).toBeInstanceOf(InMemorySessionIndexStore);
    expect(getSessionIndexStore()).toBe(a);
  });

  it('is Postgres-backed with DATABASE_URL', () => {
    process.env.DATABASE_URL = 'postgres://localhost:5432/test';
    __resetSessionIndexStoreForTests();
    try {
      expect(getSessionIndexStore()).toBeInstanceOf(PgSessionIndexStore);
    } finally {
      delete process.env.DATABASE_URL;
      __resetSessionIndexStoreForTests();
    }
  });
});

describe('PgSessionIndexStore', () => {
  const row = {
    jti: 'j-1',
    subject: 'aeth1x',
    issued_at: '1000',
    expires_at: '99999',
    user_agent: 'UA',
    ip: '1.2.3.4',
  };

  it('records with an idempotent insert', async () => {
    const query = jest.fn(async () => ({ rows: [] as never[] }));
    await new PgSessionIndexStore({ query }).record(rec({ jti: 'j-1' }));
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('ON CONFLICT (jti) DO NOTHING'),
      expect.arrayContaining(['j-1', 'aeth1subject']),
    );
  });

  it('lists rows mapped to records', async () => {
    const client: SqlClient = { query: jest.fn(async () => ({ rows: [row] as never[] })) };
    const store = new PgSessionIndexStore(client);
    const sessions = await store.listForSubject('aeth1x', 5000);
    expect((await store.listForSubject('aeth1x')).length).toBe(1); // default now
    expect(sessions).toEqual([{
      jti: 'j-1',
      subject: 'aeth1x',
      issuedAt: 1000,
      expiresAt: 99999,
      userAgent: 'UA',
      ip: '1.2.3.4',
    }]);
  });

  it('gets a single row (present and absent)', async () => {
    const present = new PgSessionIndexStore({ query: jest.fn(async () => ({ rows: [row] as never[] })) });
    expect((await present.get('j-1'))!.jti).toBe('j-1');
    const absent = new PgSessionIndexStore({ query: jest.fn(async () => ({ rows: [] as never[] })) });
    expect(await absent.get('j-1')).toBeNull();
  });

  it('prunes expired rows and reports the count (default now)', async () => {
    const query = jest.fn(async () => ({ rows: [{ jti: 'a' }, { jti: 'b' }] as never[] }));
    const store = new PgSessionIndexStore({ query });
    expect(await store.prune(123)).toBe(2);
    expect(await store.prune()).toBe(2);
  });

  it('migrate runs both DDL statements', async () => {
    const query = jest.fn(async () => ({ rows: [] as never[] }));
    await new PgSessionIndexStore({ query }).migrate();
    expect(query).toHaveBeenCalledTimes(2);
  });
});
