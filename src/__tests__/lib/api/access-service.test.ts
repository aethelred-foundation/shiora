/** @jest-environment node */

const pgQuery = jest.fn().mockResolvedValue({ rows: [] });

jest.mock('@/lib/persistence/sql-client', () => ({
  getPgClient: jest.fn(() => ({ query: pgQuery })),
}));

import {
  createAccessGrant,
  getAccessGrant,
  listAccessGrants,
  updateAccessGrant,
  __resetAccessForTests,
} from '@/lib/api/access-service';
import type { MockAccessGrant } from '@/lib/api/mock-data';

const OWNER = 'aeth1owner00000000000000000000000000000';

function grant(): MockAccessGrant {
  return {
    id: 'grant-1', provider: 'Dr. Rivera', specialty: 'OB-GYN',
    address: 'aeth1provider', status: 'Pending', scope: 'Full Records',
    grantedAt: 1, expiresAt: 2, lastAccess: null, accessCount: 0,
    txHash: '0x', attestation: 'att', canView: true, canDownload: false,
    canShare: false, ownerAddress: OWNER,
  };
}

describe('access-service', () => {
  const original = process.env.DATABASE_URL;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = original;
    }
    __resetAccessForTests();
    jest.clearAllMocks();
  });

  it('uses the in-memory store by default and supports CRUD', async () => {
    delete process.env.DATABASE_URL;
    __resetAccessForTests();

    await createAccessGrant(OWNER, grant());
    expect((await getAccessGrant(OWNER, 'grant-1'))?.provider).toBe('Dr. Rivera');
    expect(await listAccessGrants(OWNER)).toHaveLength(1);
    expect((await updateAccessGrant(OWNER, 'grant-1', { status: 'Revoked' }))?.status).toBe('Revoked');
  });

  it('selects the Postgres store when DATABASE_URL is configured', async () => {
    process.env.DATABASE_URL = 'postgres://localhost/shiora';
    __resetAccessForTests();

    expect(await listAccessGrants(OWNER)).toEqual([]);
    expect(pgQuery).toHaveBeenCalled();
  });
});
