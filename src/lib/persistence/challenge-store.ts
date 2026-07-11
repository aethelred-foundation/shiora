// ============================================================
// Shiora on Aethelred — WebAuthn Challenge Store
//
// A passkey ceremony is a two-request round-trip: options (mints a challenge)
// then verify (consumes it). The pending challenge must be single-use and must
// survive process restarts and load-balancer failover — a per-instance cache
// is a correctness and security defect, not a scaling concern (consultant
// review). One slot per (owner, ceremony): starting a new ceremony replaces
// the pending one, and consumption atomically removes the slot so a captured
// response can never be replayed.
//
// One interface, two adapters chosen by environment (mirrors the nonce store):
// in-memory for dev/tests/single replica, Postgres for cross-instance
// production where DELETE ... RETURNING makes the first consumer win.
// ============================================================

import { getPgClient } from '@/lib/persistence/sql-client';
import { PgChallengeStore } from '@/lib/persistence/pg-challenge-store';
import { shouldUsePostgres } from '@/lib/persistence/datastore-mode';

export type CeremonyKind = 'registration' | 'authentication';

export interface ChallengeStore {
  /** Record `challenge` as the pending one for (owner, ceremony), replacing any prior. */
  put(owner: string, ceremony: CeremonyKind, challenge: string, expiresAt: number): Promise<void>;
  /**
   * Atomically remove and return the pending challenge for (owner, ceremony).
   * Returns null when none is pending, it has expired, or a concurrent racer
   * consumed it first.
   */
  take(owner: string, ceremony: CeremonyKind): Promise<string | null>;
}

/**
 * In-memory challenge store. Expired slots are swept opportunistically to
 * bound memory. Single-instance only — production uses the Postgres adapter.
 */
export class InMemoryChallengeStore implements ChallengeStore {
  private readonly pending = new Map<string, { challenge: string; expiresAt: number }>();
  private lastCleanupAt = 0;

  async put(owner: string, ceremony: CeremonyKind, challenge: string, expiresAt: number): Promise<void> {
    this.maybeCleanup(Date.now());
    this.pending.set(`${owner}:${ceremony}`, { challenge, expiresAt });
  }

  async take(owner: string, ceremony: CeremonyKind): Promise<string | null> {
    const key = `${owner}:${ceremony}`;
    const entry = this.pending.get(key);
    this.pending.delete(key); // single-use, even when expired
    if (!entry || entry.expiresAt <= Date.now()) {
      return null;
    }
    return entry.challenge;
  }

  private maybeCleanup(now: number): void {
    if (now - this.lastCleanupAt < 60_000) return;
    this.lastCleanupAt = now;
    this.pending.forEach((entry, key) => {
      if (now > entry.expiresAt) this.pending.delete(key);
    });
  }
}

let store: ChallengeStore | null = null;

/** The process-wide challenge store, selected by environment. */
export function getChallengeStore(): ChallengeStore {
  if (!store) {
    store = shouldUsePostgres()
      ? new PgChallengeStore(getPgClient())
      : new InMemoryChallengeStore();
  }
  return store;
}

export function __resetChallengeStoreForTests(): void {
  store = null;
}
