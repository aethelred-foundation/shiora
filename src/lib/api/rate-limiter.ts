// ============================================================
// Shiora on Aethelred — Rate Limiter Port
//
// A driver-agnostic fixed-window rate limiter. In-memory by default (single
// instance and tests); Postgres-backed when DATABASE_URL is configured so the
// same limit is enforced consistently across horizontally-scaled instances
// behind a load balancer. The selection mirrors the record/document/audit
// stores: one interface, two adapters, chosen by environment.
// ============================================================

import { getPgClient } from '@/lib/persistence/sql-client';
import { PgRateLimiter } from '@/lib/persistence/pg-rate-limiter';

export interface RateLimitDecision {
  /** Whether this request is within the limit and may proceed. */
  allowed: boolean;
  /** The request count observed in the current window (including this one). */
  count: number;
}

export interface RateLimiter {
  /**
   * Record one request against `key` and report whether it is within
   * `maxRequests` for the current `windowMs` fixed window.
   */
  consume(
    key: string,
    maxRequests: number,
    windowMs: number,
  ): Promise<RateLimitDecision>;
}

interface FixedWindow {
  count: number;
  resetAt: number;
}

/**
 * Single-instance fixed-window limiter backed by an in-process Map. Suitable
 * for local development, tests, and single-replica deployments. State is held
 * in memory, so it does not coordinate across instances — use the Postgres
 * adapter for multi-replica production.
 */
export class InMemoryRateLimiter implements RateLimiter {
  private readonly windows = new Map<string, FixedWindow>();
  private lastCleanupAt = 0;

  async consume(
    key: string,
    maxRequests: number,
    windowMs: number,
  ): Promise<RateLimitDecision> {
    const now = Date.now();
    this.maybeCleanup(now);

    const current = this.windows.get(key);
    if (!current || now > current.resetAt) {
      this.windows.set(key, { count: 1, resetAt: now + windowMs });
      return { allowed: true, count: 1 };
    }

    current.count += 1;
    return { allowed: current.count <= maxRequests, count: current.count };
  }

  /** Sweep expired windows at most once per minute to bound memory growth. */
  private maybeCleanup(now: number): void {
    if (now - this.lastCleanupAt < 60_000) return;
    this.lastCleanupAt = now;
    this.windows.forEach((window, key) => {
      if (now > window.resetAt) this.windows.delete(key);
    });
  }
}

let limiter: RateLimiter | null = null;

function createRateLimiter(): RateLimiter {
  if (process.env.DATABASE_URL) {
    return new PgRateLimiter(getPgClient());
  }
  return new InMemoryRateLimiter();
}

/** Process-wide limiter, selected by DATABASE_URL on first use and cached. */
export function getRateLimiter(): RateLimiter {
  if (!limiter) {
    limiter = createRateLimiter();
  }
  return limiter;
}

/** Test-only: drop the cached limiter so env changes take effect between cases. */
export function __resetRateLimiterForTests(): void {
  limiter = null;
}
