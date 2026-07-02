/** @jest-environment node */

import {
  InMemoryIdempotencyStore,
  getIdempotencyStore,
  __resetIdempotencyStoreForTests,
} from '@/lib/persistence/idempotency-store';
import { PgIdempotencyStore } from '@/lib/persistence/pg-idempotency-store';
import type { SqlClient } from '@/lib/persistence/sql-client';

afterEach(() => __resetIdempotencyStoreForTests());

const FUTURE = () => Date.now() + 60_000;

describe('InMemoryIdempotencyStore', () => {
  it('reserves a key on first use, then reports in-flight until completion', async () => {
    const store = new InMemoryIdempotencyStore();
    expect(await store.begin('k1', 'POST /x', FUTURE())).toEqual({ kind: 'started' });
    // A concurrent retry before completion is told to wait.
    expect(await store.begin('k1', 'POST /x', FUTURE())).toEqual({ kind: 'in_flight' });
  });

  it('replays the recorded response after completion', async () => {
    const store = new InMemoryIdempotencyStore();
    await store.begin('k1', 'POST /x', FUTURE());
    await store.complete('k1', 201, '{"id":"rec-1"}');

    expect(await store.begin('k1', 'POST /x', FUTURE())).toEqual({
      kind: 'replay',
      response: { status: 201, body: '{"id":"rec-1"}' },
    });
  });

  it('replays an empty body safely', async () => {
    const store = new InMemoryIdempotencyStore();
    await store.begin('k1', 'POST /x', FUTURE());
    // complete never called with a body → stored body stays null → replayed as ''.
    // Simulate by completing with an empty string.
    await store.complete('k1', 204, '');
    expect(await store.begin('k1', 'POST /x', FUTURE())).toEqual({
      kind: 'replay',
      response: { status: 204, body: '' },
    });
  });

  it('rejects the same key reused for a different endpoint', async () => {
    const store = new InMemoryIdempotencyStore();
    await store.begin('k1', 'POST /x', FUTURE());
    expect(await store.begin('k1', 'POST /y', FUTURE())).toEqual({ kind: 'mismatch' });
  });

  it('treats an expired reservation as absent (fresh start)', async () => {
    const store = new InMemoryIdempotencyStore();
    await store.begin('k1', 'POST /x', Date.now() - 1); // already expired
    expect(await store.begin('k1', 'POST /x', FUTURE())).toEqual({ kind: 'started' });
  });

  it('complete on an unknown key is a no-op', async () => {
    const store = new InMemoryIdempotencyStore();
    await expect(store.complete('ghost', 200, 'x')).resolves.toBeUndefined();
  });

  it('prunes expired reservations and sweeps on begin (keeping live entries)', async () => {
    const store = new InMemoryIdempotencyStore();
    const base = 2_000_000_000_000;
    const nowSpy = jest.spyOn(Date, 'now');
    nowSpy.mockReturnValue(base);
    await store.begin('short', 'POST /x', base + 1_000);
    await store.begin('long', 'POST /y', base + 10_000_000);
    await store.begin('durable', 'POST /d', base + 100_000_000); // outlives the sweep

    expect(await store.prune(base + 5_000)).toBe(1); // 'short' removed
    expect(await store.prune(base + 5_000)).toBe(0);

    // Sweep path (past the interval): 'long' is evicted, 'durable' is kept.
    nowSpy.mockReturnValue(base + 20_000_000);
    await store.begin('trigger', 'POST /z', base + 21_000_000);
    expect(await store.begin('durable', 'POST /d', base + 100_000_000)).toEqual({ kind: 'in_flight' });

    // prune() with the default now (real clock) drops the far-in-the-mock-past rows.
    nowSpy.mockRestore();
    expect(await store.prune()).toBeGreaterThanOrEqual(0);
  });
});

describe('getIdempotencyStore selection', () => {
  it('is in-memory without DATABASE_URL, cached', () => {
    delete process.env.DATABASE_URL;
    __resetIdempotencyStoreForTests();
    const a = getIdempotencyStore();
    expect(a).toBeInstanceOf(InMemoryIdempotencyStore);
    expect(getIdempotencyStore()).toBe(a);
  });

  it('is Postgres-backed with DATABASE_URL', () => {
    process.env.DATABASE_URL = 'postgres://localhost:5432/test';
    __resetIdempotencyStoreForTests();
    try {
      expect(getIdempotencyStore()).toBeInstanceOf(PgIdempotencyStore);
    } finally {
      delete process.env.DATABASE_URL;
      __resetIdempotencyStoreForTests();
    }
  });
});

describe('PgIdempotencyStore', () => {
  const mk = (impl: SqlClient['query']): SqlClient => ({ query: jest.fn(impl) });

  it('reports started when the reservation INSERT succeeds', async () => {
    const store = new PgIdempotencyStore(mk(async (text) =>
      text.includes('INSERT') ? { rows: [{ key: 'k1' }] as never[] } : { rows: [] as never[] }));
    expect(await store.begin('k1', 'POST /x', Date.now() + 1000)).toEqual({ kind: 'started' });
  });

  it('replays / reports in-flight / mismatch from the existing live row', async () => {
    const withRow = (row: Record<string, unknown>) => new PgIdempotencyStore(mk(async (text) =>
      text.includes('INSERT') ? { rows: [] as never[] } : { rows: [row] as never[] }));

    expect(await withRow({ fingerprint: 'POST /x', status: 201, body: '{"ok":1}' })
      .begin('k', 'POST /x', 1)).toEqual({ kind: 'replay', response: { status: 201, body: '{"ok":1}' } });
    expect(await withRow({ fingerprint: 'POST /x', status: null, body: null })
      .begin('k', 'POST /x', 1)).toEqual({ kind: 'in_flight' });
    expect(await withRow({ fingerprint: 'POST /other', status: 200, body: 'x' })
      .begin('k', 'POST /x', 1)).toEqual({ kind: 'mismatch' });
    // Null body replays as ''.
    expect(await withRow({ fingerprint: 'POST /x', status: 200, body: null })
      .begin('k', 'POST /x', 1)).toEqual({ kind: 'replay', response: { status: 200, body: '' } });
  });

  it('complete updates the row; prune deletes expired (default now)', async () => {
    const query = jest.fn(async (text: string) =>
      text.includes('DELETE') ? { rows: [{ key: 'a' }, { key: 'b' }] as never[] } : { rows: [] as never[] });
    const store = new PgIdempotencyStore({ query });
    await store.complete('k', 200, 'body');
    expect(query).toHaveBeenCalledWith(expect.stringContaining('UPDATE idempotency_keys'), ['k', 200, 'body']);
    expect(await store.prune(123)).toBe(2);
    expect(await store.prune()).toBe(2);
  });

  it('migrate runs both DDL statements', async () => {
    const query = jest.fn(async () => ({ rows: [] as never[] }));
    await new PgIdempotencyStore({ query }).migrate();
    expect(query).toHaveBeenCalledTimes(2);
  });
});
