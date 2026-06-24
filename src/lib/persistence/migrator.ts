// ============================================================
// Shiora on Aethelred — Database Migrator
//
// Forward-only, version-tracked migration runner. Records applied migrations in
// a `schema_migrations` table so a deploy applies only the pending statements,
// idempotently. Intended to be run as an explicit deploy step (not at runtime).
// ============================================================

import type { SqlClient } from './sql-client';
import { MIGRATIONS } from './schema';

const MIGRATIONS_TABLE_DDL = `
CREATE TABLE IF NOT EXISTS schema_migrations (
  version    integer PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
`.trim();

export interface MigrationResult {
  /** Versions applied by this run. */
  applied: number[];
  /** Versions already applied before this run. */
  alreadyApplied: number;
}

/**
 * Apply any pending migrations. Each entry in `MIGRATIONS` is one version,
 * applied in order; previously-applied versions are skipped.
 */
export async function migrate(client: SqlClient): Promise<MigrationResult> {
  await client.query(MIGRATIONS_TABLE_DDL);

  const { rows } = await client.query<{ version: number }>(
    'SELECT version FROM schema_migrations',
  );
  const done = new Set(rows.map((row) => Number(row.version)));

  const applied: number[] = [];
  for (let version = 0; version < MIGRATIONS.length; version++) {
    if (done.has(version)) {
      continue;
    }
    await client.query(MIGRATIONS[version]);
    await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [version]);
    applied.push(version);
  }

  return { applied, alreadyApplied: done.size };
}
