// ============================================================
// Shiora on Aethelred — Postgres idempotency store (GAP-17)
//
// Durable adapter. Reservation is a single atomic statement: INSERT the key,
// and on conflict overwrite ONLY if the existing row has expired. If neither
// happens, a live row exists and we read it to decide replay/in-flight/
// mismatch. This makes two concurrent retries safe across replicas.
// ============================================================

import type { SqlClient } from './sql-client';
import type { IdempotencyStore, BeginResult } from './idempotency-store';
import { IDEMPOTENCY_DDL, IDEMPOTENCY_EXPIRY_INDEX_DDL } from './schema';

interface KeyRow {
  fingerprint: string;
  status: number | null;
  body: string | null;
}

export class PgIdempotencyStore implements IdempotencyStore {
  constructor(private readonly client: SqlClient) {}

  async migrate(): Promise<void> {
    await this.client.query(IDEMPOTENCY_DDL);
    await this.client.query(IDEMPOTENCY_EXPIRY_INDEX_DDL);
  }

  async begin(key: string, fingerprint: string, expiresAt: number): Promise<BeginResult> {
    const now = Date.now();
    const reserved = await this.client.query<{ key: string }>(
      `INSERT INTO idempotency_keys (key, fingerprint, status, body, created_at, expires_at)
       VALUES ($1, $2, NULL, NULL, $3, $4)
       ON CONFLICT (key) DO UPDATE
         SET fingerprint = EXCLUDED.fingerprint, status = NULL, body = NULL,
             created_at = EXCLUDED.created_at, expires_at = EXCLUDED.expires_at
         WHERE idempotency_keys.expires_at <= $3
       RETURNING key`,
      [key, fingerprint, now, expiresAt],
    );
    if (reserved.rows.length > 0) {
      return { kind: 'started' };
    }

    // A live (unexpired) row exists — decide how to respond to the retry.
    const { rows } = await this.client.query<KeyRow>(
      `SELECT fingerprint, status, body FROM idempotency_keys WHERE key = $1`,
      [key],
    );
    const row = rows[0];
    /* istanbul ignore next -- the row must exist: we just failed to overwrite it */
    if (!row) {
      return { kind: 'started' };
    }
    if (row.fingerprint !== fingerprint) {
      return { kind: 'mismatch' };
    }
    if (row.status === null) {
      return { kind: 'in_flight' };
    }
    return { kind: 'replay', response: { status: row.status, body: row.body ?? '' } };
  }

  async complete(key: string, status: number, body: string): Promise<void> {
    await this.client.query(
      `UPDATE idempotency_keys SET status = $2, body = $3 WHERE key = $1`,
      [key, status, body],
    );
  }

  /** Delete expired reservations; returns how many were removed. */
  async prune(now: number = Date.now()): Promise<number> {
    const { rows } = await this.client.query<{ key: string }>(
      `DELETE FROM idempotency_keys WHERE expires_at <= $1 RETURNING key`,
      [now],
    );
    return rows.length;
  }
}
