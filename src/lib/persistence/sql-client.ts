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
import { createLogger } from '@/lib/observability/logger';

const log = createLogger({ subsystem: 'postgres' });

/** Read a positive-integer env var, falling back to `fallback`. */
function intEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  const parsed = raw ? Number(raw) : NaN;
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Hardened pool configuration (GAP-27). Bounds concurrency, caps how long a
 * connection or a single statement may run, and recycles idle clients — so a
 * slow query or a leaked connection cannot exhaust the pool or hang a request.
 * All tunable via env with production-sane defaults.
 */
export function poolConfig(): {
  max: number;
  idleTimeoutMillis: number;
  connectionTimeoutMillis: number;
  statement_timeout: number;
  query_timeout: number;
} {
  const statementTimeout = intEnv('SHIORA_PG_STATEMENT_TIMEOUT_MS', 30_000);
  return {
    max: intEnv('SHIORA_PG_POOL_MAX', 10),
    idleTimeoutMillis: intEnv('SHIORA_PG_IDLE_TIMEOUT_MS', 30_000),
    connectionTimeoutMillis: intEnv('SHIORA_PG_CONNECT_TIMEOUT_MS', 10_000),
    statement_timeout: statementTimeout, // server-side cap per statement
    query_timeout: statementTimeout, // client-side cap
  };
}

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
    _pool = new Pool({ connectionString: process.env.DATABASE_URL, ...poolConfig() });
    // An idle client can emit an async error (server restart, network drop).
    // Unhandled, the pg pool would crash the process — log it and let the pool
    // recycle the client instead (GAP-27).
    _pool.on('error', (err) => log.error('postgres pool client error', { err }));
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
