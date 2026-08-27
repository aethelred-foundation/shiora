// ============================================================
// Shiora on Aethelred — Postgres failed-login store (GAP-09)
//
// Durable adapter. recordFailure reads the current counter, applies the shared
// backoff policy, and upserts — a read-modify-write; a rare concurrent race
// only slightly undercounts, which is acceptable for a throttle.
// ============================================================

import type { SqlClient } from './sql-client';
import {
  type LoginAttemptStore,
  type AttemptRecord,
  type FailureOutcome,
  nextRecord,
} from './login-attempt-store';
import { LOGIN_ATTEMPTS_DDL, LOGIN_ATTEMPTS_INDEX_DDL } from './schema';

interface AttemptRow {
  failures: number | string;
  last_failure: number | string;
  locked_until: number | string;
}

export class PgLoginAttemptStore implements LoginAttemptStore {
  constructor(private readonly client: SqlClient) {}

  async migrate(): Promise<void> {
    await this.client.query(LOGIN_ATTEMPTS_DDL);
    await this.client.query(LOGIN_ATTEMPTS_INDEX_DDL);
  }

  async lockedUntil(address: string, now: number = Date.now()): Promise<number | null> {
    const { rows } = await this.client.query<AttemptRow>(
      `SELECT failures, last_failure, locked_until FROM login_attempts WHERE address = $1`,
      [address],
    );
    const lockedUntil = rows[0] ? Number(rows[0].locked_until) : 0;
    return lockedUntil > now ? lockedUntil : null;
  }

  async recordFailure(address: string, now: number = Date.now()): Promise<FailureOutcome> {
    const { rows } = await this.client.query<AttemptRow>(
      `SELECT failures, last_failure, locked_until FROM login_attempts WHERE address = $1`,
      [address],
    );
    const prev: AttemptRecord | undefined = rows[0]
      ? {
        failures: Number(rows[0].failures),
        lastFailure: Number(rows[0].last_failure),
        lockedUntil: Number(rows[0].locked_until),
      }
      : undefined;
    const record = nextRecord(prev, now);

    await this.client.query(
      `INSERT INTO login_attempts (address, failures, last_failure, locked_until)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (address) DO UPDATE
         SET failures = EXCLUDED.failures, last_failure = EXCLUDED.last_failure,
             locked_until = EXCLUDED.locked_until`,
      [address, record.failures, record.lastFailure, record.lockedUntil],
    );
    return { failures: record.failures, lockedUntil: record.lockedUntil > now ? record.lockedUntil : null };
  }

  async clear(address: string): Promise<void> {
    await this.client.query(`DELETE FROM login_attempts WHERE address = $1`, [address]);
  }

  /** Delete counters that are unlocked and past the reset window; returns the count. */
  async prune(now: number = Date.now(), resetMs = 15 * 60_000): Promise<number> {
    const { rows } = await this.client.query<{ address: string }>(
      `DELETE FROM login_attempts
       WHERE locked_until <= $1 AND last_failure < $2
       RETURNING address`,
      [now, now - resetMs],
    );
    return rows.length;
  }
}
