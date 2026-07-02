// ============================================================
// Shiora on Aethelred — SQL Client Port
//
// A minimal, driver-agnostic SQL surface. Production uses a `pg.Pool`; tests
// and the standalone datastore verification use an in-process Postgres engine.
// Both satisfy this one method, so the persistence adapters never depend on a
// concrete driver.
// ============================================================

import { Pool } from 'pg';

import { DatastoreUnavailableError, looksLikeConnectivityFailure } from './datastore-errors';

export interface SqlClient {
  query<T = Record<string, unknown>>(
    text: string,
    params?: unknown[],
  ): Promise<{ rows: T[] }>;
}

let _pool: Pool | null = null;

/**
 * Production SQL client backed by a pooled `pg` connection. The pool is created
 * lazily and reused. Requires `DATABASE_URL`; throws otherwise so a misconfigured
 * production deployment fails loudly rather than silently losing PHI.
 */
export function getPgClient(): SqlClient {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL must be set to use the Postgres datastore.');
  }
  if (!_pool) {
    _pool = new Pool({ connectionString: process.env.DATABASE_URL });
  }
  const pool = _pool;
  return {
    // Map connectivity failures to a typed error so the API layer can answer
    // 503 (retryable) instead of an opaque 500 (GAP-05). Query/constraint
    // errors pass through unchanged.
    query: async (text, params) => {
      try {
        return await (pool.query(text, params) as Promise<{ rows: never[] }>);
      } catch (err) {
        if (looksLikeConnectivityFailure(err)) {
          throw new DatastoreUnavailableError(err);
        }
        throw err;
      }
    },
  };
}

/** Test-only: drop the cached pool so env changes take effect between cases. */
export function __resetPgPoolForTests(): void {
  _pool = null;
}
