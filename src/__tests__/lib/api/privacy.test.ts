/** @jest-environment node */

import { collectUserData, eraseUserData } from '@/lib/api/privacy';
import { createRecord, listRecords, __resetRecordsForTests } from '@/lib/api/records-service';
import { createConsent, listConsents, __resetConsentForTests } from '@/lib/api/consent-service';
import { createAccessGrant, listAccessGrants, __resetAccessForTests } from '@/lib/api/access-service';
import { logSymptom, logCycleEntry, __resetVaultForTests } from '@/lib/api/vault-service';
import { createClinicalNote, __resetClinicalNotesForTests } from '@/lib/api/clinical-notes-service';
import { __resetNotificationsForTests } from '@/lib/api/notification-service';
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
  __resetVaultForTests();
  __resetClinicalNotesForTests();
  __resetNotificationsForTests();
});

describe('privacy data-subject operations', () => {
  it('collects a subject\'s data across every store, including vault and notes', async () => {
    await createRecord(OWNER, record('rec-1'));
    await createConsent(OWNER, consent('c-1', 'active'));
    await createAccessGrant(OWNER, grant('g-1', 'Active'));
    await logSymptom(OWNER, { category: 'pain', symptom: 'Cramps', severity: 3 });
    await logCycleEntry(OWNER, { flow: 'heavy', isPeriodStart: true });
    await createClinicalNote(OWNER, 'aeth1prov', { type: 'observation', title: 'X', body: 'b' }); // also notifies OWNER

    const bundle = await collectUserData(OWNER);
    expect(bundle.records).toHaveLength(1);
    expect(bundle.consents).toHaveLength(1);
    expect(bundle.accessGrants).toHaveLength(1);
    expect(bundle.symptoms).toHaveLength(1);
    expect(bundle.cycleEntries).toHaveLength(1);
    expect(bundle.clinicalNotes).toHaveLength(1);
    expect(bundle.notifications).toHaveLength(1); // emitted by the clinical note
  });

  it('erases records and revokes only active consents and grants', async () => {
    await createRecord(OWNER, record('rec-1'));
    await createConsent(OWNER, consent('c-active', 'active'));
    await createConsent(OWNER, consent('c-revoked', 'revoked'));
    await createAccessGrant(OWNER, grant('g-active', 'Active'));
    await createAccessGrant(OWNER, grant('g-pending', 'Pending'));
    await createAccessGrant(OWNER, grant('g-expired', 'Expired'));

    await logSymptom(OWNER, { category: 'pain', symptom: 'Cramps', severity: 3 });
    await logCycleEntry(OWNER, { flow: 'heavy', isPeriodStart: true });
    await createClinicalNote(OWNER, 'aeth1prov', { type: 'observation', title: 'X', body: 'b' }); // note + notification

    const summary = await eraseUserData(OWNER);
    expect(summary.recordsErased).toBe(1);
    expect(summary.consentsRevoked).toBe(1); // only the active one
    expect(summary.grantsRevoked).toBe(2); // active + pending
    expect(summary.vaultEntriesErased).toBe(2); // 1 symptom + 1 cycle entry
    expect(summary.clinicalNotesErased).toBe(1);
    expect(summary.notificationsErased).toBe(1);

    expect(await listRecords(OWNER)).toHaveLength(0); // soft-deleted excluded from reads
    expect((await listConsents(OWNER)).every((c) => c.status === 'revoked')).toBe(true);
    expect((await listAccessGrants(OWNER)).filter((g) => g.status === 'Revoked')).toHaveLength(2);

    // the vault, notes, and notifications are gone from the bundle too
    const after = await collectUserData(OWNER);
    expect(after.symptoms).toEqual([]);
    expect(after.cycleEntries).toEqual([]);
    expect(after.clinicalNotes).toEqual([]);
    expect(after.notifications).toEqual([]);
  });
});
