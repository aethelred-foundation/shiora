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
  providerHasActiveGrant,
  __resetAccessForTests,
} from '@/lib/api/access-service';
import type { MockAccessGrant } from '@/lib/api/mock-data';

const OWNER = 'aeth1owner00000000000000000000000000000';
const PROVIDER = 'aeth1provider';
const OTHER_PATIENT = 'aeth1otherpatient0000000000000000000000';

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

  describe('providerHasActiveGrant', () => {
    beforeEach(() => {
      delete process.env.DATABASE_URL;
      __resetAccessForTests();
    });

    it('is true for an active, viewable grant from the patient', async () => {
      await createAccessGrant(OWNER, { ...grant(), id: 'g-active', status: 'Active', canView: true });
      expect(await providerHasActiveGrant(PROVIDER, OWNER)).toBe(true);
    });

    it('is false when the provider holds no grant', async () => {
      expect(await providerHasActiveGrant(PROVIDER, OWNER)).toBe(false);
    });

    it('is false for a grant from a different patient', async () => {
      await createAccessGrant(OWNER, { ...grant(), id: 'g-other', status: 'Active' });
      expect(await providerHasActiveGrant(PROVIDER, OTHER_PATIENT)).toBe(false);
    });

    it('is false when the grant is not Active', async () => {
      await createAccessGrant(OWNER, { ...grant(), id: 'g-revoked', status: 'Revoked', canView: true });
      expect(await providerHasActiveGrant(PROVIDER, OWNER)).toBe(false);
    });

    it('is false when the grant does not permit viewing', async () => {
      await createAccessGrant(OWNER, { ...grant(), id: 'g-noview', status: 'Active', canView: false });
      expect(await providerHasActiveGrant(PROVIDER, OWNER)).toBe(false);
    });
  });
});
