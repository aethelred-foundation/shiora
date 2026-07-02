// ============================================================
// Shiora on Aethelred — Postgres Session Revocation Store
//
// Cross-instance session revocation. Per-token revocation is an idempotent
// upsert on the jti; the per-subject "sign out everywhere" cutoff is an upsert
// that only ever moves the cutoff forward (GREATEST), so a race between two
// revoke-all calls can never lower it. Both reads are single indexed lookups.
// ============================================================

import type { SqlClient } from './sql-client';
import type { RevocationStore } from './revocation-store';
import {
  REVOKED_TOKENS_DDL,
  REVOKED_TOKENS_EXPIRY_INDEX_DDL,
  SESSION_EPOCHS_DDL,
} from './schema';

export class PgRevocationStore implements RevocationStore {
  constructor(private readonly client: SqlClient) {}

  /** Create the revocation tables and index if absent. */
  async migrate(): Promise<void> {
    await this.client.query(REVOKED_TOKENS_DDL);
    await this.client.query(REVOKED_TOKENS_EXPIRY_INDEX_DDL);
    await this.client.query(SESSION_EPOCHS_DDL);
  }

  async revokeToken(jti: string, expiresAt: number): Promise<void> {
    await this.client.query(
      `INSERT INTO revoked_tokens (jti, expires_at)
         VALUES ($1, $2)
       ON CONFLICT (jti) DO NOTHING`,
      [jti, expiresAt],
    );
  }

  async isTokenRevoked(jti: string): Promise<boolean> {
    const { rows } = await this.client.query<{ jti: string }>(
      `SELECT jti FROM revoked_tokens WHERE jti = $1`,
      [jti],
    );
    return rows.length > 0;
  }

  async revokeAllForSubject(subject: string, cutoff: number): Promise<void> {
    await this.client.query(
      `INSERT INTO session_epochs (subject, min_issued_at)
         VALUES ($1, $2)
       ON CONFLICT (subject)
         DO UPDATE SET min_issued_at = GREATEST(session_epochs.min_issued_at, EXCLUDED.min_issued_at),
                       updated_at = now()`,
      [subject, cutoff],
    );
  }

  async earliestValidIssuedAt(subject: string): Promise<number> {
    const { rows } = await this.client.query<{ min_issued_at: string | number }>(
      `SELECT min_issued_at FROM session_epochs WHERE subject = $1`,
      [subject],
    );
    return rows.length > 0 ? Number(rows[0].min_issued_at) : 0;
  }

  /** Delete revoked-token rows past their expiry — they can no longer be presented. */
  async prune(now: number = Date.now()): Promise<number> {
    const { rows } = await this.client.query<{ pruned: string | number }>(
      `WITH removed AS (
         DELETE FROM revoked_tokens WHERE expires_at < $1 RETURNING 1
       )
       SELECT count(*)::int AS pruned FROM removed`,
      [now],
    );
    return Number(rows[0].pruned);
  }
}
