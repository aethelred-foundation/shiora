/** @jest-environment node */

const mockQuery = jest.fn().mockResolvedValue({ rows: [] });

jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({ query: mockQuery })),
}));

import { Pool } from 'pg';
import { getPgClient, __resetPgPoolForTests } from '@/lib/persistence/sql-client';

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
});
