/** @jest-environment node */

import {
  InMemoryRevocationStore,
  getRevocationStore,
  __resetRevocationStoreForTests,
} from '@/lib/persistence/revocation-store';
import { PgRevocationStore } from '@/lib/persistence/pg-revocation-store';
import type { SqlClient } from '@/lib/persistence/sql-client';

afterEach(() => __resetRevocationStoreForTests());

describe('InMemoryRevocationStore', () => {
  it('revokes and reports individual tokens', async () => {
    const store = new InMemoryRevocationStore();
    expect(await store.isTokenRevoked('jti-1')).toBe(false);
    await store.revokeToken('jti-1', Date.now() + 60_000);
    expect(await store.isTokenRevoked('jti-1')).toBe(true);
    expect(await store.isTokenRevoked('jti-2')).toBe(false);
  });

  it('tracks a monotonic per-subject cutoff (never moves backwards)', async () => {
    const store = new InMemoryRevocationStore();
    expect(await store.earliestValidIssuedAt('aeth1x')).toBe(0);
    await store.revokeAllForSubject('aeth1x', 1000);
    expect(await store.earliestValidIssuedAt('aeth1x')).toBe(1000);
    await store.revokeAllForSubject('aeth1x', 500); // earlier — ignored
    expect(await store.earliestValidIssuedAt('aeth1x')).toBe(1000);
    await store.revokeAllForSubject('aeth1x', 2000);
    expect(await store.earliestValidIssuedAt('aeth1x')).toBe(2000);
  });

  it('sweeps expired revoked tokens', async () => {
    const store = new InMemoryRevocationStore();
    const base = 2_000_000_000_000;
    const nowSpy = jest.spyOn(Date, 'now');
    nowSpy.mockReturnValue(base);
    await store.revokeToken('short', base + 1_000);
    await store.revokeToken('long', base + 10_000_000);
    nowSpy.mockReturnValue(base + 120_000);
    await store.revokeToken('trigger', base + 200_000); // triggers sweep
    expect(await store.isTokenRevoked('short')).toBe(false); // evicted
    expect(await store.isTokenRevoked('long')).toBe(true); // kept
    nowSpy.mockRestore();
  });
});

describe('getRevocationStore selection', () => {
  it('is in-memory without DATABASE_URL, cached across calls', () => {
    delete process.env.DATABASE_URL;
    __resetRevocationStoreForTests();
    const a = getRevocationStore();
    expect(a).toBeInstanceOf(InMemoryRevocationStore);
    expect(getRevocationStore()).toBe(a);
  });

  it('is Postgres-backed with DATABASE_URL', () => {
    process.env.DATABASE_URL = 'postgres://localhost:5432/test';
    __resetRevocationStoreForTests();
    try {
      expect(getRevocationStore()).toBeInstanceOf(PgRevocationStore);
    } finally {
      delete process.env.DATABASE_URL;
      __resetRevocationStoreForTests();
    }
  });
});

describe('PgRevocationStore', () => {
  const mk = (impl: SqlClient['query']): SqlClient => ({ query: jest.fn(impl) });

  it('revokes and checks individual tokens', async () => {
    let stored = false;
    const store = new PgRevocationStore(mk(async (text: string) => {
      if (text.includes('INSERT INTO revoked_tokens')) { stored = true; return { rows: [] as never[] }; }
      return { rows: (stored ? [{ jti: 'j' }] : []) as never[] };
    }));
    await store.revokeToken('j', Date.now() + 1000);
    expect(await store.isTokenRevoked('j')).toBe(true);
  });

  it('reads the subject cutoff (present and absent)', async () => {
    const present = new PgRevocationStore(mk(async () => ({ rows: [{ min_issued_at: 4242 }] as never[] })));
    expect(await present.earliestValidIssuedAt('aeth1x')).toBe(4242);
    const absent = new PgRevocationStore(mk(async () => ({ rows: [] as never[] })));
    expect(await absent.earliestValidIssuedAt('aeth1x')).toBe(0);
  });

  it('revokeAllForSubject issues the GREATEST upsert', async () => {
    const query = jest.fn(async () => ({ rows: [] as never[] }));
    await new PgRevocationStore({ query }).revokeAllForSubject('aeth1x', 9000);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('GREATEST'), ['aeth1x', 9000]);
  });

  it('migrate runs three DDL statements', async () => {
    const query = jest.fn(async () => ({ rows: [] as never[] }));
    await new PgRevocationStore({ query }).migrate();
    expect(query).toHaveBeenCalledTimes(3);
  });

  it('prune deletes expired tokens and reports the count (default now)', async () => {
    const query = jest.fn(async () => ({ rows: [{ pruned: 2 }] as never[] }));
    const store = new PgRevocationStore({ query });
    expect(await store.prune(Date.now())).toBe(2);
    expect(await store.prune()).toBe(2);
  });
});
