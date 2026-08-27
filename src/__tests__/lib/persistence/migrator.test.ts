/** @jest-environment node */

import { migrate } from '@/lib/persistence/migrator';
import { MIGRATIONS } from '@/lib/persistence/schema';
import type { SqlClient } from '@/lib/persistence/sql-client';

/** A fake client that simulates the schema_migrations bookkeeping table. */
class MigratorFakeClient implements SqlClient {
  private readonly appliedVersions: number[] = [];
  readonly ddlRun: string[] = [];

  async query<T = Record<string, unknown>>(text: string, params?: unknown[]) {
    if (text.includes('CREATE TABLE IF NOT EXISTS schema_migrations')) {
      return { rows: [] as T[] };
    }
    if (text.startsWith('SELECT version FROM schema_migrations')) {
      return { rows: this.appliedVersions.map((version) => ({ version })) as T[] };
    }
    if (text.includes('INSERT INTO schema_migrations')) {
      this.appliedVersions.push(params![0] as number);
      return { rows: [] as T[] };
    }
    this.ddlRun.push(text);
    return { rows: [] as T[] };
  }
}

describe('migrator', () => {
  it('applies every migration on a fresh database', async () => {
    const client = new MigratorFakeClient();
    const result = await migrate(client);

    expect(result.applied).toEqual(MIGRATIONS.map((_, version) => version));
    expect(result.alreadyApplied).toBe(0);
    expect(client.ddlRun).toHaveLength(MIGRATIONS.length);
  });

  it('is idempotent — a second run applies nothing', async () => {
    const client = new MigratorFakeClient();
    await migrate(client);
    const second = await migrate(client);

    expect(second.applied).toEqual([]);
    expect(second.alreadyApplied).toBe(MIGRATIONS.length);
  });
});
