/** @jest-environment node */

const pgQuery = jest.fn().mockResolvedValue({ rows: [] });

jest.mock('@/lib/persistence/sql-client', () => ({
  getPgClient: jest.fn(() => ({ query: pgQuery })),
}));

import {
  createRecord,
  getRecord,
  listRecords,
  softDeleteRecord,
  updateRecord,
  __resetRecordsForTests,
} from '@/lib/api/records-service';
import type { MockHealthRecord } from '@/lib/api/mock-data';

const OWNER = 'aeth1own000000000000000000000000000000000';

function sampleRecord(): MockHealthRecord {
  return {
    id: 'rec-1', type: 'lab', label: 'BRCA1 panel', description: 'note',
    date: 1, uploadDate: 1, encrypted: false, encryption: 'none', cid: 'c', txHash: 't',
    attestation: 'a', size: 10, provider: 'p', status: 'Processing', ipfsNodes: 0,
    tags: ['genomics'], deleted: false, ownerAddress: OWNER, blockHeight: 1,
  };
}

describe('records-service', () => {
  const original = process.env.DATABASE_URL;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = original;
    }
    __resetRecordsForTests();
    jest.clearAllMocks();
  });

  it('uses the in-memory store by default and supports full CRUD', async () => {
    delete process.env.DATABASE_URL;
    __resetRecordsForTests();

    const created = await createRecord(OWNER, sampleRecord());
    expect(created.encrypted).toBe(true);

    expect((await getRecord(OWNER, 'rec-1'))?.label).toBe('BRCA1 panel');
    expect(await listRecords(OWNER)).toHaveLength(1);
    expect((await updateRecord(OWNER, 'rec-1', { status: 'Pinned' }))?.status).toBe('Pinned');
    expect((await softDeleteRecord(OWNER, 'rec-1'))?.deleted).toBe(true);
    expect(await getRecord(OWNER, 'rec-1')).toBeUndefined();
  });

  it('selects the Postgres store when DATABASE_URL is configured', async () => {
    process.env.DATABASE_URL = 'postgres://localhost/shiora';
    __resetRecordsForTests();

    expect(await listRecords(OWNER)).toEqual([]);
    expect(pgQuery).toHaveBeenCalled();
  });
});
