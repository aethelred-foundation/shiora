/** @jest-environment node */

const pgQuery = jest.fn().mockResolvedValue({ rows: [] });

jest.mock('@/lib/persistence/sql-client', () => ({
  getPgClient: jest.fn(() => ({ query: pgQuery })),
}));

import {
  createRecord,
  getRecord,
  listRecords,
  listRecordsForProvider,
  softDeleteRecord,
  updateRecord,
  __resetRecordsForTests,
} from '@/lib/api/records-service';
import { createAccessGrant, __resetAccessForTests } from '@/lib/api/access-service';
import { getAuditLog, __resetAuditLogForTests } from '@/lib/api/audit-log';
import type { MockAccessGrant, MockHealthRecord } from '@/lib/api/mock-data';

const OWNER = 'aeth1own000000000000000000000000000000000';
const PROVIDER = 'aeth1prov00000000000000000000000000000000';

function sampleRecord(): MockHealthRecord {
  return {
    id: 'rec-1', type: 'lab', label: 'BRCA1 panel', description: 'note',
    date: 1, uploadDate: 1, encrypted: false, encryption: 'none', cid: 'c', txHash: 't',
    attestation: 'a', size: 10, provider: 'p', status: 'Processing', ipfsNodes: 0,
    tags: ['genomics'], deleted: false, ownerAddress: OWNER, blockHeight: 1,
  };
}

function grant(overrides: Partial<MockAccessGrant> = {}): MockAccessGrant {
  return {
    id: 'grant-1', provider: 'Dr. Vega', specialty: 'Oncology', address: PROVIDER,
    status: 'Active', scope: 'Full Records', grantedAt: 1, expiresAt: Date.now() + 60_000,
    lastAccess: null, accessCount: 0, txHash: 't', attestation: 'a',
    canView: true, canDownload: false, canShare: false, ownerAddress: OWNER,
    ...overrides,
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
    __resetAccessForTests();
    __resetAuditLogForTests();
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

  describe('listRecordsForProvider', () => {
    beforeEach(() => {
      delete process.env.DATABASE_URL;
      __resetRecordsForTests();
      __resetAccessForTests();
      __resetAuditLogForTests();
    });

    it('returns null when the provider holds no active grant', async () => {
      await createRecord(OWNER, sampleRecord());
      expect(await listRecordsForProvider(PROVIDER, OWNER)).toBeNull();
    });

    it('returns the shared records and audits the access when a grant is active', async () => {
      await createRecord(OWNER, sampleRecord());
      await createAccessGrant(OWNER, grant());

      const records = await listRecordsForProvider(PROVIDER, OWNER);
      expect(records).toHaveLength(1);
      expect(records?.[0].label).toBe('BRCA1 panel');

      const reads = await getAuditLog().list({ action: 'RECORD_READ', actor: PROVIDER });
      expect(reads).toHaveLength(1);
      expect(reads[0].resourceId).toBe(OWNER);
    });

    it('returns null for an expired grant even if it was viewable', async () => {
      await createRecord(OWNER, sampleRecord());
      await createAccessGrant(OWNER, grant({ expiresAt: Date.now() - 1_000 }));
      expect(await listRecordsForProvider(PROVIDER, OWNER)).toBeNull();
    });
  });
});
