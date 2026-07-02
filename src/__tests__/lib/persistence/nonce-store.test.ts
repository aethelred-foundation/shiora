/** @jest-environment node */

import {
  InMemoryNonceStore,
  getNonceStore,
  __resetNonceStoreForTests,
} from '@/lib/persistence/nonce-store';
import { PgNonceStore } from '@/lib/persistence/pg-nonce-store';
import type { SqlClient } from '@/lib/persistence/sql-client';

afterEach(() => __resetNonceStoreForTests());

describe('InMemoryNonceStore', () => {
  it('consumes a fresh nonce exactly once', async () => {
    const store = new InMemoryNonceStore();
    const expiresAt = Date.now() + 60_000;
    expect(await store.consume('nonce-a', expiresAt)).toBe(true);
    expect(await store.consume('nonce-a', expiresAt)).toBe(false); // replay
    expect(await store.consume('nonce-b', expiresAt)).toBe(true); // distinct nonce
  });

  it('sweeps expired nonces so memory does not grow unbounded', async () => {
    const store = new InMemoryNonceStore();
    const base = 1_000_000_000_000;
    const nowSpy = jest.spyOn(Date, 'now');

    // At `base`, consume one soon-expiring and one long-lived nonce so the
    // sweep later sees both branches (evict expired, keep non-expired).
    nowSpy.mockReturnValue(base);
    expect(await store.consume('short-lived', base + 1_000)).toBe(true);
    expect(await store.consume('long-lived', base + 10_000_000)).toBe(true);

    // Jump past the short expiry AND past the 60s cleanup interval; the next
    // consume triggers a sweep.
    nowSpy.mockReturnValue(base + 120_000);
    expect(await store.consume('trigger-sweep', base + 200_000)).toBe(true);

    // The expired nonce was evicted (re-consumable); the long-lived one was
    // kept (still a replay).
    expect(await store.consume('short-lived', base + 200_000)).toBe(true);
    expect(await store.consume('long-lived', base + 200_000)).toBe(false);
    nowSpy.mockRestore();
  });
});

describe('getNonceStore selection', () => {
  it('returns the in-memory store when DATABASE_URL is unset, cached across calls', () => {
    delete process.env.DATABASE_URL;
    __resetNonceStoreForTests();
    const a = getNonceStore();
    expect(a).toBeInstanceOf(InMemoryNonceStore);
    expect(getNonceStore()).toBe(a); // cached singleton
  });

  it('returns the Postgres store when DATABASE_URL is set', () => {
    process.env.DATABASE_URL = 'postgres://localhost:5432/test';
    __resetNonceStoreForTests();
    try {
      expect(getNonceStore()).toBeInstanceOf(PgNonceStore);
    } finally {
      delete process.env.DATABASE_URL;
      __resetNonceStoreForTests();
    }
  });
});

describe('PgNonceStore', () => {
  function mockClient(impl: SqlClient['query']): SqlClient {
    return { query: jest.fn(impl) };
  }

  it('claims a fresh nonce (row returned) and rejects a replay (no row)', async () => {
    let inserted = false;
    const client = mockClient(async (_text: string) => {
      if (!inserted) {
        inserted = true;
        return { rows: [{ nonce: 'n1' }] as never[] };
      }
      return { rows: [] as never[] }; // ON CONFLICT DO NOTHING → no row
    });
    const store = new PgNonceStore(client);
    expect(await store.consume('n1', Date.now() + 1000)).toBe(true);
    expect(await store.consume('n1', Date.now() + 1000)).toBe(false);
  });

  it('migrate runs the DDL statements', async () => {
    const query = jest.fn(async () => ({ rows: [] as never[] }));
    await new PgNonceStore({ query }).migrate();
    expect(query).toHaveBeenCalledTimes(2); // table + index
  });

  it('prune deletes expired nonces and reports the count', async () => {
    const query = jest.fn(async () => ({ rows: [{ pruned: 3 }] as never[] }));
    const removed = await new PgNonceStore({ query }).prune(Date.now());
    expect(removed).toBe(3);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('prune defaults `now` to the current time', async () => {
    const query = jest.fn(async () => ({ rows: [{ pruned: 0 }] as never[] }));
    expect(await new PgNonceStore({ query }).prune()).toBe(0);
  });
});
