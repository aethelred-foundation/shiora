// ============================================================
// Shiora on Aethelred — Session Revocation Store
//
// Stateless session tokens cannot be un-issued once signed, so logout, key
// compromise, and "sign out everywhere" had no effect until the token expired
// (audit M-03). This store adds server-side revocation on two axes:
//
//   • Per-token: a specific jti is revoked (logout / "this device"). Kept until
//     the token would expire anyway, then pruned.
//   • Per-subject: a "sign out everywhere" cutoff — any token issued at or
//     before min_issued_at is treated as revoked.
//
// One interface, two adapters chosen by environment (mirrors the other stores).
// ============================================================

import { getPgClient } from '@/lib/persistence/sql-client';
import { PgRevocationStore } from '@/lib/persistence/pg-revocation-store';
import { shouldUsePostgres } from '@/lib/persistence/datastore-mode';

export interface RevocationStore {
  /** Revoke a single token by its jti until `expiresAt` (epoch ms). */
  revokeToken(jti: string, expiresAt: number): Promise<void>;
  /** Whether a token with this jti has been revoked. */
  isTokenRevoked(jti: string): Promise<boolean>;
  /** Revoke every session for `subject` issued at or before `cutoff` (epoch ms). */
  revokeAllForSubject(subject: string, cutoff: number): Promise<void>;
  /** The "sign out everywhere" cutoff for `subject` (0 when none set). */
  earliestValidIssuedAt(subject: string): Promise<number>;
}

/**
 * In-memory revocation store. Revoked jtis are held until their expiry and swept
 * at most once per minute to bound memory growth. Single-instance only — use the
 * Postgres adapter for multi-replica production.
 */
export class InMemoryRevocationStore implements RevocationStore {
  private readonly revokedTokens = new Map<string, number>();
  private readonly subjectCutoff = new Map<string, number>();
  private lastCleanupAt = 0;

  async revokeToken(jti: string, expiresAt: number): Promise<void> {
    this.maybeCleanup(Date.now());
    this.revokedTokens.set(jti, expiresAt);
  }

  async isTokenRevoked(jti: string): Promise<boolean> {
    return this.revokedTokens.has(jti);
  }

  async revokeAllForSubject(subject: string, cutoff: number): Promise<void> {
    const existing = this.subjectCutoff.get(subject) ?? 0;
    // Monotonic: never move the cutoff backwards.
    this.subjectCutoff.set(subject, Math.max(existing, cutoff));
  }

  async earliestValidIssuedAt(subject: string): Promise<number> {
    return this.subjectCutoff.get(subject) ?? 0;
  }

  private maybeCleanup(now: number): void {
    if (now - this.lastCleanupAt < 60_000) return;
    this.lastCleanupAt = now;
    this.revokedTokens.forEach((expiresAt, jti) => {
      if (now > expiresAt) this.revokedTokens.delete(jti);
    });
  }
}

let store: RevocationStore | null = null;

function createRevocationStore(): RevocationStore {
  if (shouldUsePostgres()) {
    return new PgRevocationStore(getPgClient());
  }
  return new InMemoryRevocationStore();
}

/** Process-wide revocation store, selected by DATABASE_URL and cached. */
export function getRevocationStore(): RevocationStore {
  if (!store) {
    store = createRevocationStore();
  }
  return store;
}

/** Test-only: drop the cached store so env changes take effect between cases. */
export function __resetRevocationStoreForTests(): void {
  store = null;
}
