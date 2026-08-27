/** @jest-environment node */

import { PgRateLimiter } from '@/lib/persistence/pg-rate-limiter';
import type { SqlClient } from '@/lib/persistence/sql-client';

function clientReturning(
  ...results: Array<{ rows: unknown[] }>
): { client: SqlClient; query: jest.Mock } {
  const query = jest.fn();
  results.forEach((result) => query.mockResolvedValueOnce(result));
  return { client: { query } as unknown as SqlClient, query };
}

describe('PgRateLimiter', () => {
  it('allows a request when the returned count is within the limit', async () => {
    const { client, query } = clientReturning({ rows: [{ count: 3 }] });
    const decision = await new PgRateLimiter(client).consume('k', 5, 60_000);

    expect(decision).toEqual({ allowed: true, count: 3 });
    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain('ON CONFLICT (key, window_start)');
    expect(sql).toContain('DO UPDATE SET count = rate_limits.count + 1');
    expect(params[0]).toBe('k');
    expect((params[1] as number) % 60_000).toBe(0); // window_start aligned to the window
  });

  it('blocks a request when the returned count exceeds the limit', async () => {
    const { client } = clientReturning({ rows: [{ count: 6 }] });
    expect(await new PgRateLimiter(client).consume('k', 5, 60_000)).toEqual({
      allowed: false,
      count: 6,
    });
  });

  it('coerces string counts returned by the driver', async () => {
    const { client } = clientReturning({ rows: [{ count: '2' }] });
    expect(await new PgRateLimiter(client).consume('k', 5, 60_000)).toEqual({
      allowed: true,
      count: 2,
    });
  });

  it('migrates the table and its supporting index', async () => {
    const { client, query } = clientReturning({ rows: [] }, { rows: [] });
    await new PgRateLimiter(client).migrate();

    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[0][0]).toContain('CREATE TABLE IF NOT EXISTS rate_limits');
    expect(query.mock.calls[1][0]).toContain('idx_rate_limits_window');
  });

  it('prunes stale windows and reports the number removed', async () => {
    const { client, query } = clientReturning({ rows: [{ pruned: 4 }] });
    const removed = await new PgRateLimiter(client).prune(120_000);

    expect(removed).toBe(4);
    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain('DELETE FROM rate_limits WHERE window_start <');
    expect(typeof params[0]).toBe('number');
  });

  it('coerces string prune counts', async () => {
    const { client } = clientReturning({ rows: [{ pruned: '7' }] });
    expect(await new PgRateLimiter(client).prune(1_000)).toBe(7);
  });
});
