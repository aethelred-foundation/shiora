/** @jest-environment node */

const pgQuery = jest.fn().mockResolvedValue({ rows: [] });
jest.mock('@/lib/persistence/sql-client', () => ({
  getPgClient: jest.fn(() => ({ query: pgQuery })),
}));

import {
  InMemoryChallengeStore,
  getChallengeStore,
  __resetChallengeStoreForTests,
} from '@/lib/persistence/challenge-store';
import { PgChallengeStore } from '@/lib/persistence/pg-challenge-store';

const OWNER = 'aeth1owner';

afterEach(() => {
  __resetChallengeStoreForTests();
  delete process.env.DATABASE_URL;
  jest.clearAllMocks();
});

describe('InMemoryChallengeStore', () => {
  it('returns a pending challenge exactly once (single-use)', async () => {
    const store = new InMemoryChallengeStore();
    await store.put(OWNER, 'registration', 'c1', Date.now() + 60_000);
    expect(await store.take(OWNER, 'registration')).toBe('c1');
    expect(await store.take(OWNER, 'registration')).toBeNull();
  });

  it('scopes slots by ceremony: a registration challenge is invisible to authentication', async () => {
    const store = new InMemoryChallengeStore();
    await store.put(OWNER, 'registration', 'reg', Date.now() + 60_000);
    expect(await store.take(OWNER, 'authentication')).toBeNull();
    expect(await store.take(OWNER, 'registration')).toBe('reg');
  });

  it('replaces the pending challenge when a new ceremony starts', async () => {
    const store = new InMemoryChallengeStore();
    await store.put(OWNER, 'authentication', 'old', Date.now() + 60_000);
    await store.put(OWNER, 'authentication', 'new', Date.now() + 60_000);
    expect(await store.take(OWNER, 'authentication')).toBe('new');
    expect(await store.take(OWNER, 'authentication')).toBeNull();
  });

  it('treats an expired slot as missing and consumes it', async () => {
    const store = new InMemoryChallengeStore();
    await store.put(OWNER, 'registration', 'stale', Date.now() - 1);
    expect(await store.take(OWNER, 'registration')).toBeNull();
  });

  it('sweeps expired slots opportunistically, keeping live ones (bounded memory)', async () => {
    const base = 1_000_000_000_000;
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(base);
    const store = new InMemoryChallengeStore();
    await store.put('a', 'registration', 'c', base + 1); // expires before the sweep
    await store.put('c', 'registration', 'keep', base + 999_999); // survives the sweep
    // Advance past a's expiry AND the 60s sweep interval, then trigger a put.
    nowSpy.mockReturnValue(base + 120_000);
    await store.put('b', 'registration', 'c2', base + 180_000);
    expect(await store.take('a', 'registration')).toBeNull();
    expect(await store.take('b', 'registration')).toBe('c2');
    expect(await store.take('c', 'registration')).toBe('keep');
    nowSpy.mockRestore();
  });
});

describe('getChallengeStore', () => {
  it('selects the in-memory store by default and caches the instance', () => {
    const first = getChallengeStore();
    expect(first).toBeInstanceOf(InMemoryChallengeStore);
    expect(getChallengeStore()).toBe(first);
  });

  it('selects the Postgres store when DATABASE_URL is configured', () => {
    process.env.DATABASE_URL = 'postgres://localhost/shiora';
    __resetChallengeStoreForTests();
    expect(getChallengeStore()).toBeInstanceOf(PgChallengeStore);
  });
});
