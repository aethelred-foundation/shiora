/** @jest-environment node */

import { collectUserData, eraseUserData } from '@/lib/api/privacy';
import { createRecord, listRecords, __resetRecordsForTests } from '@/lib/api/records-service';
import { createConsent, listConsents, __resetConsentForTests } from '@/lib/api/consent-service';
import { createAccessGrant, listAccessGrants, __resetAccessForTests } from '@/lib/api/access-service';
import { seededAddress } from '@/lib/utils';
import type { MockHealthRecord, MockAccessGrant } from '@/lib/api/mock-data';
import type { ConsentGrant, ConsentStatus } from '@/types';

const OWNER = seededAddress(300);

function record(id: string): MockHealthRecord {
  return {
    id, type: 'lab-result', label: 'L', description: 'D', date: 1, uploadDate: 1,
    encrypted: false, encryption: 'none', cid: 'c', txHash: 't', attestation: 'a',
    size: 1, provider: 'p', status: 'Verified', ipfsNodes: 1, tags: ['t'],
    deleted: false, ownerAddress: OWNER, blockHeight: 1,
  };
}

function consent(id: string, status: ConsentStatus): ConsentGrant {
  return {
    id, patientAddress: OWNER, providerAddress: 'aeth1prov', providerName: 'Dr', scopes: ['cycle_data'],
    status, grantedAt: 1, expiresAt: 2, txHash: 't', attestation: 'a', policyId: 'policy-0', autoRenew: false,
  };
}

function grant(id: string, status: MockAccessGrant['status']): MockAccessGrant {
  return {
    id, provider: 'P', specialty: 'OB-GYN', address: 'aeth1prov', status, scope: 'Full Records',
    grantedAt: 1, expiresAt: 2, lastAccess: null, accessCount: 0, txHash: 't', attestation: 'a',
    canView: true, canDownload: false, canShare: false, ownerAddress: OWNER,
  };
}

beforeEach(() => {
  __resetRecordsForTests();
  __resetConsentForTests();
  __resetAccessForTests();
});

describe('privacy data-subject operations', () => {
  it('collects a subject\'s data across the datastore', async () => {
    await createRecord(OWNER, record('rec-1'));
    await createConsent(OWNER, consent('c-1', 'active'));
    await createAccessGrant(OWNER, grant('g-1', 'Active'));

    const bundle = await collectUserData(OWNER);
    expect(bundle.records).toHaveLength(1);
    expect(bundle.consents).toHaveLength(1);
    expect(bundle.accessGrants).toHaveLength(1);
  });

  it('erases records and revokes only active consents and grants', async () => {
    await createRecord(OWNER, record('rec-1'));
    await createConsent(OWNER, consent('c-active', 'active'));
    await createConsent(OWNER, consent('c-revoked', 'revoked'));
    await createAccessGrant(OWNER, grant('g-active', 'Active'));
    await createAccessGrant(OWNER, grant('g-pending', 'Pending'));
    await createAccessGrant(OWNER, grant('g-expired', 'Expired'));

    const summary = await eraseUserData(OWNER);
    expect(summary.recordsErased).toBe(1);
    expect(summary.consentsRevoked).toBe(1); // only the active one
    expect(summary.grantsRevoked).toBe(2); // active + pending

    expect(await listRecords(OWNER)).toHaveLength(0); // soft-deleted excluded from reads
    expect((await listConsents(OWNER)).every((c) => c.status === 'revoked')).toBe(true);
    expect((await listAccessGrants(OWNER)).filter((g) => g.status === 'Revoked')).toHaveLength(2);
  });
});
