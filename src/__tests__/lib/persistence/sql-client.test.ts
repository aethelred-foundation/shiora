/** @jest-environment node */

const mockQuery = jest.fn().mockResolvedValue({ rows: [] });

const mockOn = jest.fn();
jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({ query: mockQuery, on: mockOn })),
}));

import { Pool } from 'pg';
import { getPgClient, poolConfig, __resetPgPoolForTests } from '@/lib/persistence/sql-client';

const MockedPool = Pool as unknown as jest.Mock;

describe('getPgClient', () => {
  const original = process.env.DATABASE_URL;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = original;
    }
    __resetPgPoolForTests();
    jest.clearAllMocks();
  });

  it('throws when DATABASE_URL is not configured', () => {
    delete process.env.DATABASE_URL;
    __resetPgPoolForTests();
    expect(() => getPgClient()).toThrow(/DATABASE_URL/);
  });

  it('creates the pool once and delegates query()', async () => {
    process.env.DATABASE_URL = 'postgres://user:pass@localhost:5432/shiora';
    __resetPgPoolForTests();

    const client = getPgClient();
    getPgClient(); // second call reuses the cached pool
    expect(MockedPool).toHaveBeenCalledTimes(1);

    const result = await client.query('SELECT 1', [1]);
    expect(mockQuery).toHaveBeenCalledWith('SELECT 1', [1]);
    expect(result.rows).toEqual([]);
  });

  it('maps a connectivity failure to DatastoreUnavailableError (GAP-05)', async () => {
    process.env.DATABASE_URL = 'postgres://user:pass@localhost:5432/shiora';
    __resetPgPoolForTests();
    mockQuery.mockRejectedValueOnce(Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' }));

    const { DatastoreUnavailableError } = await import('@/lib/persistence/datastore-errors');
    await expect(getPgClient().query('SELECT 1')).rejects.toBeInstanceOf(DatastoreUnavailableError);
  });

  it('passes a genuine query error through unchanged', async () => {
    process.env.DATABASE_URL = 'postgres://user:pass@localhost:5432/shiora';
    __resetPgPoolForTests();
    mockQuery.mockRejectedValueOnce(Object.assign(new Error('duplicate key'), { code: '23505' }));

    await expect(getPgClient().query('INSERT ...')).rejects.toThrow('duplicate key');
  });

  it('exposes a hardened default pool config', () => {
    const cfg = poolConfig();
    expect(cfg.max).toBe(10);
    expect(cfg.statement_timeout).toBe(30_000);
  });

  it('configures the pool with hardened, env-tunable limits (GAP-27)', async () => {
    process.env.DATABASE_URL = 'postgres://user:pass@localhost:5432/shiora';
    process.env.SHIORA_PG_POOL_MAX = '25';
    process.env.SHIORA_PG_STATEMENT_TIMEOUT_MS = '15000';
    __resetPgPoolForTests();

    getPgClient();
    const config = MockedPool.mock.calls[0][0];
    expect(config.max).toBe(25);
    expect(config.statement_timeout).toBe(15000);
    expect(config.query_timeout).toBe(15000);
    expect(config.connectionTimeoutMillis).toBeGreaterThan(0);
    expect(config.idleTimeoutMillis).toBeGreaterThan(0);

    delete process.env.SHIORA_PG_POOL_MAX;
    delete process.env.SHIORA_PG_STATEMENT_TIMEOUT_MS;
  });

  it('falls back to defaults for absent/invalid pool env vars', async () => {
    process.env.DATABASE_URL = 'postgres://user:pass@localhost:5432/shiora';
    process.env.SHIORA_PG_POOL_MAX = 'not-a-number';
    __resetPgPoolForTests();
    getPgClient();
    expect(MockedPool.mock.calls[0][0].max).toBe(10); // default
    delete process.env.SHIORA_PG_POOL_MAX;
  });

  it('registers a pool error handler that logs rather than crashing', async () => {
    process.env.DATABASE_URL = 'postgres://user:pass@localhost:5432/shiora';
    __resetPgPoolForTests();
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    getPgClient();

    expect(mockOn).toHaveBeenCalledWith('error', expect.any(Function));
    const handler = mockOn.mock.calls.find((c) => c[0] === 'error')![1];
    expect(() => handler(new Error('idle client boom'))).not.toThrow();
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('postgres pool client error'));
    errorSpy.mockRestore();
  });
});
