/** @jest-environment node */

import {
  InMemoryLoginAttemptStore,
  getLoginAttemptStore,
  __resetLoginAttemptStoreForTests,
  nextRecord,
  LOCK_THRESHOLD,
  BASE_LOCK_MS,
  MAX_LOCK_MS,
  ATTEMPT_RESET_MS,
} from '@/lib/persistence/login-attempt-store';
import { PgLoginAttemptStore } from '@/lib/persistence/pg-login-attempt-store';
import type { SqlClient } from '@/lib/persistence/sql-client';

const ADDR = 'aeth1victim';

afterEach(() => __resetLoginAttemptStoreForTests());

describe('nextRecord backoff policy', () => {
  it('counts up and locks with exponential backoff past the threshold', () => {
    let rec = nextRecord(undefined, 1000);
    expect(rec.failures).toBe(1);
    expect(rec.lockedUntil).toBe(0); // below threshold

    // Advance to the threshold.
    for (let i = 2; i <= LOCK_THRESHOLD; i++) {
      rec = nextRecord(rec, 1000);
    }
    expect(rec.failures).toBe(LOCK_THRESHOLD);
    expect(rec.lockedUntil).toBe(1000 + BASE_LOCK_MS); // first lock = base

    const afterOneMore = nextRecord(rec, 1000);
    expect(afterOneMore.lockedUntil).toBe(1000 + BASE_LOCK_MS * 2); // doubles
  });

  it('caps the lockout window', () => {
    let rec: ReturnType<typeof nextRecord> | undefined;
    for (let i = 0; i < 40; i++) {
      rec = nextRecord(rec, 1000);
    }
    expect(rec!.lockedUntil).toBe(1000 + MAX_LOCK_MS);
  });

  it('resets the counter after a quiet period', () => {
    const first = nextRecord(undefined, 1000);
    const later = nextRecord(first, 1000 + ATTEMPT_RESET_MS + 1);
    expect(later.failures).toBe(1); // counter reset, back to 1
  });
});

describe('InMemoryLoginAttemptStore', () => {
  it('locks the address after enough failures and reports lockedUntil', async () => {
    const store = new InMemoryLoginAttemptStore();
    const now = 1_000_000;
    let outcome;
    for (let i = 0; i < LOCK_THRESHOLD; i++) {
      outcome = await store.recordFailure(ADDR, now);
    }
    expect(outcome!.lockedUntil).toBe(now + BASE_LOCK_MS);
    expect(await store.lockedUntil(ADDR, now)).toBe(now + BASE_LOCK_MS);
    // After the window, it is unlocked.
    expect(await store.lockedUntil(ADDR, now + BASE_LOCK_MS + 1)).toBeNull();
  });

  it('is not locked below the threshold', async () => {
    const store = new InMemoryLoginAttemptStore();
    await store.recordFailure(ADDR, 1000);
    expect(await store.lockedUntil(ADDR, 1000)).toBeNull();
  });

  it('defaults now to the real clock when not supplied', async () => {
    const store = new InMemoryLoginAttemptStore();
    const outcome = await store.recordFailure(ADDR); // default now
    expect(outcome.failures).toBe(1);
    expect(await store.lockedUntil(ADDR)).toBeNull(); // default now, below threshold
    expect(await store.prune()).toBe(0); // default now, nothing stale yet
  });

  it('clear() resets the counter', async () => {
    const store = new InMemoryLoginAttemptStore();
    for (let i = 0; i < LOCK_THRESHOLD; i++) await store.recordFailure(ADDR, 1000);
    await store.clear(ADDR);
    expect(await store.lockedUntil(ADDR, 1000)).toBeNull();
  });

  it('prune keeps still-locked counters, drops stale unlocked ones', async () => {
    const store = new InMemoryLoginAttemptStore();
    const base = 2_000_000_000_000;
    await store.recordFailure('stale', base); // 1 failure, unlocked
    // Enough failures to hit the 1h cap (which outlasts the 15m reset window).
    for (let i = 0; i < 15; i++) await store.recordFailure('locked', base);
    expect(await store.lockedUntil('locked', base)).toBe(base + MAX_LOCK_MS);

    // Past the reset window (15m): 'stale' is prunable but 'locked' is still locked (1h).
    expect(await store.prune(base + ATTEMPT_RESET_MS + 1)).toBe(1);
    expect(await store.lockedUntil('locked', base + ATTEMPT_RESET_MS + 1)).toBe(base + MAX_LOCK_MS);

    // Once the lock expires AND the window passes, 'locked' is prunable too.
    expect(await store.prune(base + MAX_LOCK_MS + 1)).toBe(1);
  });

  it('sweeps stale entries on a later recordFailure, keeping fresh ones', async () => {
    const store = new InMemoryLoginAttemptStore();
    const base = 2_000_000_000_000;
    await store.recordFailure('stale', base); // lastFailure = base
    await store.recordFailure('recent', base + 100_000); // within window; moves lastSweep to +100k

    // A failure far past both the 60s sweep interval AND the reset window from
    // 'stale' triggers a real sweep: 'stale' is evicted (past the window),
    // 'recent' survives (only 15m − 100s old, i.e. still within the window).
    const triggerAt = base + ATTEMPT_RESET_MS + 100_000;
    await store.recordFailure('trigger', triggerAt);

    // 'recent' was NOT swept: continuing its count returns 2, not 1.
    expect((await store.recordFailure('recent', triggerAt)).failures).toBe(2);
  });
});

describe('getLoginAttemptStore selection', () => {
  it('is in-memory without DATABASE_URL, cached', () => {
    delete process.env.DATABASE_URL;
    __resetLoginAttemptStoreForTests();
    const a = getLoginAttemptStore();
    expect(a).toBeInstanceOf(InMemoryLoginAttemptStore);
    expect(getLoginAttemptStore()).toBe(a);
  });

  it('is Postgres-backed with DATABASE_URL', () => {
    process.env.DATABASE_URL = 'postgres://localhost:5432/test';
    __resetLoginAttemptStoreForTests();
    try {
      expect(getLoginAttemptStore()).toBeInstanceOf(PgLoginAttemptStore);
    } finally {
      delete process.env.DATABASE_URL;
      __resetLoginAttemptStoreForTests();
    }
  });
});

describe('PgLoginAttemptStore', () => {
  const mk = (impl: SqlClient['query']): SqlClient => ({ query: jest.fn(impl) });

  it('records a failure with the backoff policy (fresh address)', async () => {
    const calls: { text: string; params?: unknown[] }[] = [];
    const store = new PgLoginAttemptStore(mk(async (text, params) => {
      calls.push({ text, params });
      return { rows: [] as never[] }; // no prior row
    }));
    const outcome = await store.recordFailure(ADDR, 5000);
    expect(outcome.failures).toBe(1);
    expect(calls.some((c) => c.text.includes('INSERT INTO login_attempts'))).toBe(true);
  });

  it('applies backoff over an existing row and reports the lock', async () => {
    const prior = { failures: LOCK_THRESHOLD - 1, last_failure: 5000, locked_until: 0 };
    const store = new PgLoginAttemptStore(mk(async (text) =>
      text.includes('SELECT') ? { rows: [prior] as never[] } : { rows: [] as never[] }));
    const outcome = await store.recordFailure(ADDR, 5000);
    expect(outcome.failures).toBe(LOCK_THRESHOLD);
    expect(outcome.lockedUntil).toBe(5000 + BASE_LOCK_MS);
  });

  it('reads the lock (present and absent), including the default-now path', async () => {
    const locked = new PgLoginAttemptStore(mk(async () =>
      ({ rows: [{ failures: 6, last_failure: 1, locked_until: 9999 }] as never[] })));
    expect(await locked.lockedUntil(ADDR, 1000)).toBe(9999);
    expect(await locked.lockedUntil(ADDR)).toBeNull(); // default now (real clock) → 9999 is in the past

    const absent = new PgLoginAttemptStore(mk(async () => ({ rows: [] as never[] })));
    expect(await absent.lockedUntil(ADDR, 1000)).toBeNull();
  });

  it('recordFailure uses the default now when none is given', async () => {
    const store = new PgLoginAttemptStore(mk(async () => ({ rows: [] as never[] })));
    const outcome = await store.recordFailure(ADDR); // default now
    expect(outcome.failures).toBe(1);
  });

  it('clears and prunes', async () => {
    const query = jest.fn(async (text: string) =>
      text.includes('DELETE') && text.includes('locked_until')
        ? { rows: [{ address: 'a' }] as never[] }
        : { rows: [] as never[] });
    const store = new PgLoginAttemptStore({ query });
    await store.clear(ADDR);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM login_attempts WHERE address'), [ADDR]);
    expect(await store.prune(1000)).toBe(1);
    expect(await store.prune()).toBe(1); // default now
  });

  it('migrate runs both DDL statements', async () => {
    const query = jest.fn(async () => ({ rows: [] as never[] }));
    await new PgLoginAttemptStore({ query }).migrate();
    expect(query).toHaveBeenCalledTimes(2);
  });
});
