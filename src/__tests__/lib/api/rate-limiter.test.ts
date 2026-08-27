/** @jest-environment node */

jest.mock('@/lib/persistence/sql-client', () => ({
  getPgClient: jest.fn(() => ({
    query: jest.fn().mockResolvedValue({ rows: [{ count: 1 }] }),
  })),
}));

import {
  InMemoryRateLimiter,
  getRateLimiter,
  __resetRateLimiterForTests,
} from '@/lib/api/rate-limiter';
import { PgRateLimiter } from '@/lib/persistence/pg-rate-limiter';

describe('InMemoryRateLimiter', () => {
  it('allows requests up to the limit and blocks beyond it', async () => {
    const limiter = new InMemoryRateLimiter();
    expect(await limiter.consume('k', 2, 60_000)).toEqual({ allowed: true, count: 1 });
    expect(await limiter.consume('k', 2, 60_000)).toEqual({ allowed: true, count: 2 });
    expect(await limiter.consume('k', 2, 60_000)).toEqual({ allowed: false, count: 3 });
  });

  it('isolates counts per key', async () => {
    const limiter = new InMemoryRateLimiter();
    await limiter.consume('a', 1, 60_000);
    expect(await limiter.consume('b', 1, 60_000)).toEqual({ allowed: true, count: 1 });
  });

  it('starts a fresh window once the previous one has elapsed', async () => {
    const limiter = new InMemoryRateLimiter();
    const realNow = Date.now;
    const t0 = realNow();
    Date.now = jest.fn(() => t0);
    try {
      await limiter.consume('k', 1, 1_000); // count 1
      expect((await limiter.consume('k', 1, 1_000)).allowed).toBe(false); // count 2, over limit
      Date.now = jest.fn(() => t0 + 2_000); // window elapsed
      expect(await limiter.consume('k', 1, 1_000)).toEqual({ allowed: true, count: 1 });
    } finally {
      Date.now = realNow;
    }
  });

  it('skips the sweep when consume is called again within the minute', async () => {
    const limiter = new InMemoryRateLimiter();
    const realNow = Date.now;
    const t0 = realNow();
    Date.now = jest.fn(() => t0);
    try {
      await limiter.consume('k', 5, 60_000); // first call performs the sweep (lastCleanupAt -> t0)
      // second call within the same minute takes the early-return path in maybeCleanup
      expect((await limiter.consume('k', 5, 60_000)).count).toBe(2);
    } finally {
      Date.now = realNow;
    }
  });

  it('evicts expired windows during the sweep and retains live ones', async () => {
    const limiter = new InMemoryRateLimiter();
    const realNow = Date.now;
    const t0 = realNow();
    Date.now = jest.fn(() => t0);
    try {
      await limiter.consume('expired', 5, 1_000); // resetAt t0 + 1_000
      await limiter.consume('live', 5, 600_000); // resetAt t0 + 600_000

      // Jump past the 60s sweep interval and past the 'expired' window, but not 'live'.
      Date.now = jest.fn(() => t0 + 120_000);
      await limiter.consume('trigger', 5, 1_000); // triggers the sweep

      // 'expired' was removed, so its next request starts a brand-new window.
      expect((await limiter.consume('expired', 5, 600_000)).count).toBe(1);
      // 'live' survived the sweep, so its counter continues.
      expect((await limiter.consume('live', 5, 600_000)).count).toBe(2);
    } finally {
      Date.now = realNow;
    }
  });
});

describe('getRateLimiter', () => {
  const original = process.env.DATABASE_URL;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = original;
    }
    __resetRateLimiterForTests();
  });

  it('uses the in-memory limiter when DATABASE_URL is unset', () => {
    delete process.env.DATABASE_URL;
    __resetRateLimiterForTests();
    expect(getRateLimiter()).toBeInstanceOf(InMemoryRateLimiter);
  });

  it('uses the Postgres limiter when DATABASE_URL is configured', () => {
    process.env.DATABASE_URL = 'postgres://localhost/shiora';
    __resetRateLimiterForTests();
    expect(getRateLimiter()).toBeInstanceOf(PgRateLimiter);
  });

  it('caches the selected limiter across calls', () => {
    delete process.env.DATABASE_URL;
    __resetRateLimiterForTests();
    expect(getRateLimiter()).toBe(getRateLimiter());
  });
});
