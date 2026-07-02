// ============================================================
// Shiora on Aethelred — Single-Use Nonce Store
//
// Authentication challenges must be single-use: an HMAC-signed, unexpired
// challenge that has already been redeemed for a session must never be
// redeemable again, or a captured (challenge, signature) pair could be replayed
// within its TTL to mint additional sessions (audit H-02). This store records
// which nonces have been consumed and atomically rejects reuse.
//
// One interface, two adapters chosen by environment (mirrors the rate limiter):
// in-memory for dev/tests/single replica, Postgres for cross-instance
// production where the atomic INSERT ... ON CONFLICT makes the first redemption
// win even under concurrent, multi-replica requests.
// ============================================================

import { getPgClient } from '@/lib/persistence/sql-client';
import { PgNonceStore } from '@/lib/persistence/pg-nonce-store';
import { shouldUsePostgres } from '@/lib/persistence/datastore-mode';

export interface NonceStore {
  /**
   * Atomically claim `nonce`. Returns true exactly once (the first time), and
   * false on every subsequent call — including concurrent racers, of which only
   * one may win. `expiresAt` (epoch ms) lets the store forget the nonce after it
   * can no longer be replayed anyway.
   */
  consume(nonce: string, expiresAt: number): Promise<boolean>;
}

/**
 * In-memory single-use nonce store. Consumed nonces are held until their expiry
 * and swept at most once per minute to bound memory growth. Single-instance
 * only — use the Postgres adapter for multi-replica production.
 */
export class InMemoryNonceStore implements NonceStore {
  private readonly consumed = new Map<string, number>();
  private lastCleanupAt = 0;

  async consume(nonce: string, expiresAt: number): Promise<boolean> {
    const now = Date.now();
    this.maybeCleanup(now);

    if (this.consumed.has(nonce)) {
      return false;
    }
    this.consumed.set(nonce, expiresAt);
    return true;
  }

  private maybeCleanup(now: number): void {
    if (now - this.lastCleanupAt < 60_000) return;
    this.lastCleanupAt = now;
    this.consumed.forEach((expiresAt, nonce) => {
      if (now > expiresAt) this.consumed.delete(nonce);
    });
  }
}

let store: NonceStore | null = null;

function createNonceStore(): NonceStore {
  if (shouldUsePostgres()) {
    return new PgNonceStore(getPgClient());
  }
  return new InMemoryNonceStore();
}

/** Process-wide nonce store, selected by DATABASE_URL on first use and cached. */
export function getNonceStore(): NonceStore {
  if (!store) {
    store = createNonceStore();
  }
  return store;
}

/** Test-only: drop the cached store so env changes take effect between cases. */
export function __resetNonceStoreForTests(): void {
  store = null;
}
