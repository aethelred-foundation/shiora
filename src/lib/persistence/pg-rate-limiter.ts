// ============================================================
// Shiora on Aethelred — Postgres Rate Limiter (cross-instance)
//
// Enforces a fixed-window request limit that holds across every application
// replica. Each (key, window_start) pair owns a counter row; the increment is
// a single atomic statement —
//
//   INSERT ... VALUES (key, window_start, 1)
//   ON CONFLICT (key, window_start) DO UPDATE SET count = count + 1
//   RETURNING count
//
// so concurrent requests (even on different instances) never read-modify-write
// race: Postgres serialises the row update and hands each caller back the new
// count. window_start = floor(now / windowMs) * windowMs aligns requests into
// shared buckets without storing a per-key reset timestamp. Old buckets are
// removed by prune(), which production schedules out-of-band.
// ============================================================

import type { SqlClient } from './sql-client';
import type { RateLimiter, RateLimitDecision } from '@/lib/api/rate-limiter';
import { RATE_LIMITS_DDL, RATE_LIMITS_WINDOW_INDEX_DDL } from './schema';

export class PgRateLimiter implements RateLimiter {
  constructor(private readonly client: SqlClient) {}

  /** Create the rate_limits table and supporting index if absent. */
  async migrate(): Promise<void> {
    await this.client.query(RATE_LIMITS_DDL);
    await this.client.query(RATE_LIMITS_WINDOW_INDEX_DDL);
  }

  async consume(
    key: string,
    maxRequests: number,
    windowMs: number,
  ): Promise<RateLimitDecision> {
    const windowStart = Math.floor(Date.now() / windowMs) * windowMs;
    const { rows } = await this.client.query<{ count: string | number }>(
      `INSERT INTO rate_limits (key, window_start, count)
         VALUES ($1, $2, 1)
       ON CONFLICT (key, window_start)
         DO UPDATE SET count = rate_limits.count + 1
       RETURNING count`,
      [key, windowStart],
    );
    const count = Number(rows[0].count);
    return { allowed: count <= maxRequests, count };
  }

  /** Delete windows whose start is older than `retentionMs` before now. */
  async prune(retentionMs: number): Promise<number> {
    const cutoff = Date.now() - retentionMs;
    const { rows } = await this.client.query<{ pruned: string | number }>(
      `WITH removed AS (
         DELETE FROM rate_limits WHERE window_start < $1 RETURNING 1
       )
       SELECT count(*)::int AS pruned FROM removed`,
      [cutoff],
    );
    return Number(rows[0].pruned);
  }
}
