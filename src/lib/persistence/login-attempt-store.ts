// ============================================================
// Shiora on Aethelred — Failed-login lockout store (GAP-09)
//
// Signature verification could be retried at the per-IP/per-account rate limit
// indefinitely. This adds a per-address failure counter with exponential
// backoff: after a threshold of consecutive failures the wallet address is
// locked for a window that doubles with each further failure (capped), so a
// targeted brute-force is throttled to a crawl. A success clears the counter,
// and it self-resets after a quiet period.
// ============================================================

import { PgLoginAttemptStore } from './pg-login-attempt-store';
import { getPgClient } from './sql-client';

/** Consecutive failures before the first lockout. */
export const LOCK_THRESHOLD = 5;
/** First lockout duration; doubles per failure beyond the threshold. */
export const BASE_LOCK_MS = 30_000;
/** Cap on the lockout window. */
export const MAX_LOCK_MS = 60 * 60_000;
/** Quiet period after which the failure counter resets to zero. */
export const ATTEMPT_RESET_MS = 15 * 60_000;

export interface AttemptRecord {
  failures: number;
  lastFailure: number;
  lockedUntil: number;
}

export interface FailureOutcome {
  failures: number;
  /** When the address is unlocked, or null if not (yet) locked. */
  lockedUntil: number | null;
}

export interface LoginAttemptStore {
  /** Current lockout expiry if the address is locked now, else null. */
  lockedUntil(address: string, now?: number): Promise<number | null>;
  /** Record a failed attempt and apply the backoff policy. */
  recordFailure(address: string, now?: number): Promise<FailureOutcome>;
  /** Clear the counter after a successful login. */
  clear(address: string): Promise<void>;
}

/** Pure backoff policy shared by both drivers. */
export function nextRecord(prev: AttemptRecord | undefined, now: number): AttemptRecord {
  const stale = !prev || now - prev.lastFailure > ATTEMPT_RESET_MS;
  const failures = (stale ? 0 : prev!.failures) + 1;
  let lockedUntil = 0;
  if (failures >= LOCK_THRESHOLD) {
    const over = failures - LOCK_THRESHOLD;
    lockedUntil = now + Math.min(BASE_LOCK_MS * 2 ** over, MAX_LOCK_MS);
  }
  return { failures, lastFailure: now, lockedUntil };
}

const SWEEP_INTERVAL_MS = 60_000;

export class InMemoryLoginAttemptStore implements LoginAttemptStore {
  private readonly attempts = new Map<string, AttemptRecord>();
  private lastSweep = 0;

  async lockedUntil(address: string, now: number = Date.now()): Promise<number | null> {
    const entry = this.attempts.get(address);
    return entry && entry.lockedUntil > now ? entry.lockedUntil : null;
  }

  async recordFailure(address: string, now: number = Date.now()): Promise<FailureOutcome> {
    this.sweep(now);
    const record = nextRecord(this.attempts.get(address), now);
    this.attempts.set(address, record);
    return { failures: record.failures, lockedUntil: record.lockedUntil > now ? record.lockedUntil : null };
  }

  async clear(address: string): Promise<void> {
    this.attempts.delete(address);
  }

  /** Drop counters that are unlocked and past the reset window. */
  async prune(now: number = Date.now()): Promise<number> {
    let removed = 0;
    for (const [address, entry] of Array.from(this.attempts.entries())) {
      if (entry.lockedUntil <= now && now - entry.lastFailure > ATTEMPT_RESET_MS) {
        this.attempts.delete(address);
        removed += 1;
      }
    }
    return removed;
  }

  private sweep(now: number): void {
    if (now - this.lastSweep < SWEEP_INTERVAL_MS) {
      return;
    }
    this.lastSweep = now;
    for (const [address, entry] of Array.from(this.attempts.entries())) {
      if (entry.lockedUntil <= now && now - entry.lastFailure > ATTEMPT_RESET_MS) {
        this.attempts.delete(address);
      }
    }
  }
}

function shouldUsePostgres(): boolean {
  return !!process.env.DATABASE_URL;
}

let cachedStore: LoginAttemptStore | null = null;

export function getLoginAttemptStore(): LoginAttemptStore {
  if (!cachedStore) {
    cachedStore = shouldUsePostgres()
      ? new PgLoginAttemptStore(getPgClient())
      : new InMemoryLoginAttemptStore();
  }
  return cachedStore;
}

export function __resetLoginAttemptStoreForTests(): void {
  cachedStore = null;
}
