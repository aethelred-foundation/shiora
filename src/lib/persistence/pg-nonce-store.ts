// ============================================================
// Shiora on Aethelred — Postgres Single-Use Nonce Store
//
// Cross-instance single-use enforcement. Claiming a nonce is one atomic
// statement:
//
//   INSERT INTO used_nonces (nonce, expires_at) VALUES ($1, $2)
//   ON CONFLICT (nonce) DO NOTHING RETURNING nonce
//
// Postgres serialises the primary-key insert, so exactly one caller — across
// every replica, even under concurrent replays of the same challenge — gets a
// returned row (fresh); all others get zero rows (already consumed). Expired
// rows are removed by prune(), which production schedules out-of-band.
// ============================================================

import type { SqlClient } from './sql-client';
import type { NonceStore } from './nonce-store';
import { USED_NONCES_DDL, USED_NONCES_EXPIRY_INDEX_DDL } from './schema';

export class PgNonceStore implements NonceStore {
  constructor(private readonly client: SqlClient) {}

  /** Create the used_nonces table and supporting index if absent. */
  async migrate(): Promise<void> {
    await this.client.query(USED_NONCES_DDL);
    await this.client.query(USED_NONCES_EXPIRY_INDEX_DDL);
  }

  async consume(nonce: string, expiresAt: number): Promise<boolean> {
    const { rows } = await this.client.query<{ nonce: string }>(
      `INSERT INTO used_nonces (nonce, expires_at)
         VALUES ($1, $2)
       ON CONFLICT (nonce) DO NOTHING
       RETURNING nonce`,
      [nonce, expiresAt],
    );
    return rows.length > 0;
  }

  /** Delete nonces whose expiry is older than now — they can no longer replay. */
  async prune(now: number = Date.now()): Promise<number> {
    const { rows } = await this.client.query<{ pruned: string | number }>(
      `WITH removed AS (
         DELETE FROM used_nonces WHERE expires_at < $1 RETURNING 1
       )
       SELECT count(*)::int AS pruned FROM removed`,
      [now],
    );
    return Number(rows[0].pruned);
  }
}
