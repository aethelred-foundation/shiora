/** @jest-environment node */

// ============================================================
// Negative-space authorization suite (consultant P0).
//
// The unit suites prove what each feature DOES; this suite proves what the
// platform REFUSES, exercising the cross-tenant and cross-role boundaries an
// attacker would probe. Every case here is a denial: if any assertion flips,
// a real isolation guarantee has regressed.
// ============================================================

import { createRecord, getRecord, listRecordsForProvider, __resetRecordsForTests } from '@/lib/api/records-service';
import {
  createAccessGrant,
  updateAccessGrant,
  providerHasActiveGrant,
  __resetAccessForTests,
} from '@/lib/api/access-service';
import {
  createOrganization,
  getOrganization,
  __resetEmployerForTests,
} from '@/lib/api/employer-service';
import {
  createDataRequest,
  decideDataRequest,
  revokeDataRequest,
  listActiveGrants,
  __resetDataRequestsForTests,
} from '@/lib/api/data-access-service';
import { notify, listNotifications, __resetNotificationsForTests } from '@/lib/api/notification-service';
import { __resetAuditLogForTests } from '@/lib/api/audit-log';
import type { MockAccessGrant, MockHealthRecord } from '@/lib/api/mock-data';
import { seededAddress } from '@/lib/utils';

const PATIENT_A = seededAddress(9301);
const PATIENT_B = seededAddress(9302);
const PROVIDER_A = seededAddress(9303);
const PROVIDER_B = seededAddress(9304);
const EMPLOYER_A = seededAddress(9305);
const EMPLOYER_B = seededAddress(9306);
const RESEARCHER = seededAddress(9307);
const STEWARD = seededAddress(9308);

function record(id: string, owner: string): MockHealthRecord {
  return {
    id, type: 'lab', label: `Result ${id}`, description: 'note', date: 1, uploadDate: 1,
    encrypted: false, encryption: 'none', cid: 'c', txHash: 't', attestation: 'a', size: 10,
    provider: 'p', status: 'Processing', ipfsNodes: 0, tags: [], deleted: false,
    ownerAddress: owner, blockHeight: 1,
  };
}

function grant(owner: string, provider: string, overrides: Partial<MockAccessGrant> = {}): MockAccessGrant {
  return {
    id: `grant-${owner.slice(-4)}-${provider.slice(-4)}`, provider: 'Dr. Vega', specialty: 'Oncology',
    address: provider, status: 'Active', scope: 'Full Records', grantedAt: 1,
    expiresAt: Date.now() + 60_000, lastAccess: null, accessCount: 0, txHash: 't', attestation: 'a',
    canView: true, canDownload: false, canShare: false, ownerAddress: owner,
    ...overrides,
  };
}

beforeEach(async () => {
  __resetRecordsForTests();
  __resetAccessForTests();
  __resetEmployerForTests();
  __resetDataRequestsForTests();
  __resetNotificationsForTests();
  __resetAuditLogForTests();
  await createRecord(PATIENT_A, record('rec-a', PATIENT_A));
  await createRecord(PATIENT_B, record('rec-b', PATIENT_B));
});

describe('provider ↔ patient boundaries', () => {
  it('a provider with no grant reads nothing', async () => {
    expect(await listRecordsForProvider(PROVIDER_A, PATIENT_A)).toBeNull();
  });

  it("provider A cannot use provider B's grant", async () => {
    await createAccessGrant(PATIENT_A, grant(PATIENT_A, PROVIDER_B));
    expect(await listRecordsForProvider(PROVIDER_B, PATIENT_A)).not.toBeNull();
    expect(await listRecordsForProvider(PROVIDER_A, PATIENT_A)).toBeNull();
  });

  it("a grant from patient A does not open patient B's records", async () => {
    await createAccessGrant(PATIENT_A, grant(PATIENT_A, PROVIDER_A));
    expect(await listRecordsForProvider(PROVIDER_A, PATIENT_A)).not.toBeNull();
    expect(await listRecordsForProvider(PROVIDER_A, PATIENT_B)).toBeNull();
  });

  it('revoking a grant blocks the provider immediately', async () => {
    const g = await createAccessGrant(PATIENT_A, grant(PATIENT_A, PROVIDER_A));
    expect(await listRecordsForProvider(PROVIDER_A, PATIENT_A)).not.toBeNull();
    await updateAccessGrant(PATIENT_A, g.id, { status: 'Revoked' });
    expect(await listRecordsForProvider(PROVIDER_A, PATIENT_A)).toBeNull();
  });

  it('a time-expired grant no longer permits access, whatever its status says', async () => {
    await createAccessGrant(PATIENT_A, grant(PATIENT_A, PROVIDER_A, { expiresAt: Date.now() - 1 }));
    expect(await providerHasActiveGrant(PROVIDER_A, PATIENT_A)).toBe(false);
    expect(await listRecordsForProvider(PROVIDER_A, PATIENT_A)).toBeNull();
  });

  it('a view-less grant conveys no read access', async () => {
    await createAccessGrant(PATIENT_A, grant(PATIENT_A, PROVIDER_A, { canView: false }));
    expect(await listRecordsForProvider(PROVIDER_A, PATIENT_A)).toBeNull();
  });
});

describe('owner scoping', () => {
  it('one patient cannot address another patient’s record by id', async () => {
    expect(await getRecord(PATIENT_B, 'rec-a')).toBeUndefined();
    expect(await getRecord(PATIENT_A, 'rec-b')).toBeUndefined();
  });

  it('notifications are invisible across subjects', async () => {
    await notify(PATIENT_A, { type: 'consent', title: 'Private', body: 'for A only' });
    expect(await listNotifications(PATIENT_B)).toEqual([]);
  });
});

describe('employer tenant isolation', () => {
  it("employer B cannot resolve employer A's organization (ownership guard input)", async () => {
    const org = await createOrganization(EMPLOYER_A, { name: 'Acme Health' });
    expect(await getOrganization(EMPLOYER_A, org.id)).toBeDefined();
    // The 404-on-foreign-org route guard rests on this returning undefined.
    expect(await getOrganization(EMPLOYER_B, org.id)).toBeUndefined();
  });
});

describe('research grant lifecycle', () => {
  it('an approval is bound to its request and dies with revocation', async () => {
    const request = await createDataRequest(RESEARCHER, 'listing-1', 'cohort study');
    await decideDataRequest(request.id, STEWARD, 'approved');
    expect(await listActiveGrants(RESEARCHER)).toHaveLength(1);

    await revokeDataRequest(request.id, STEWARD);
    expect(await listActiveGrants(RESEARCHER)).toEqual([]);
  });

  it('a denied request never becomes a grant', async () => {
    const request = await createDataRequest(RESEARCHER, 'listing-2', 'other study');
    await decideDataRequest(request.id, STEWARD, 'denied');
    expect(await listActiveGrants(RESEARCHER)).toEqual([]);
  });

  it('an approved grant expires on the clock, not on trust', async () => {
    const request = await createDataRequest(RESEARCHER, 'listing-3', 'time-bound study');
    const approved = await decideDataRequest(request.id, STEWARD, 'approved');
    expect(await listActiveGrants(RESEARCHER, approved!.expiresAt + 1)).toEqual([]);
  });

  it('a decision cannot be re-decided (no approval reuse)', async () => {
    const request = await createDataRequest(RESEARCHER, 'listing-4', 'study');
    await decideDataRequest(request.id, STEWARD, 'denied');
    expect(await decideDataRequest(request.id, STEWARD, 'approved')).toBeUndefined();
    expect(await listActiveGrants(RESEARCHER)).toEqual([]);
  });
});
