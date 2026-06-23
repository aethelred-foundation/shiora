/** @jest-environment node */

const pgQuery = jest.fn().mockResolvedValue({ rows: [] });

jest.mock('@/lib/persistence/sql-client', () => ({
  getPgClient: jest.fn(() => ({ query: pgQuery })),
}));

import {
  createConsent,
  getConsent,
  listConsents,
  updateConsent,
  __resetConsentForTests,
} from '@/lib/api/consent-service';
import type { ConsentGrant } from '@/types';

const PATIENT = 'aeth1patient0000000000000000000000000000';

function consent(): ConsentGrant {
  return {
    id: 'consent-1', patientAddress: PATIENT, providerAddress: 'aeth1provider',
    providerName: 'Dr. Rivera', scopes: ['cycle_data', 'lab_results'], status: 'active',
    grantedAt: 1, expiresAt: 2, txHash: '0x', attestation: 'att', policyId: 'policy-0',
    autoRenew: false,
  };
}

describe('consent-service', () => {
  const original = process.env.DATABASE_URL;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = original;
    }
    __resetConsentForTests();
    jest.clearAllMocks();
  });

  it('uses the in-memory store by default and supports CRUD', async () => {
    delete process.env.DATABASE_URL;
    __resetConsentForTests();

    await createConsent(PATIENT, consent());
    expect((await getConsent(PATIENT, 'consent-1'))?.providerName).toBe('Dr. Rivera');
    expect(await listConsents(PATIENT)).toHaveLength(1);
    expect((await updateConsent(PATIENT, 'consent-1', { status: 'revoked' }))?.status).toBe('revoked');
  });

  it('selects the Postgres store when DATABASE_URL is configured', async () => {
    process.env.DATABASE_URL = 'postgres://localhost/shiora';
    __resetConsentForTests();

    expect(await listConsents(PATIENT)).toEqual([]);
    expect(pgQuery).toHaveBeenCalled();
  });
});
