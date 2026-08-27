/** @jest-environment node */

import { computePopulationAnalytics, MIN_COHORT } from '@/lib/api/population-analytics';
import { createConsent, __resetConsentForTests } from '@/lib/api/consent-service';
import { createAccessGrant, __resetAccessForTests } from '@/lib/api/access-service';
import { seededAddress } from '@/lib/utils';
import type { ConsentGrant, ConsentScope } from '@/types';
import type { MockAccessGrant } from '@/lib/api/mock-data';

function consent(owner: string, scope: ConsentScope): ConsentGrant {
  return {
    id: `c-${owner}`, patientAddress: owner, providerAddress: 'aeth1p', providerName: 'Dr',
    scopes: [scope], status: 'active', grantedAt: 1, expiresAt: 2, txHash: 't', attestation: 'a',
    policyId: 'policy-0', autoRenew: false,
  };
}

function grant(owner: string, status: MockAccessGrant['status']): MockAccessGrant {
  return {
    id: `g-${owner}`, provider: 'P', specialty: 'OB-GYN', address: 'aeth1p', status,
    scope: 'Full Records', grantedAt: 1, expiresAt: 2, lastAccess: null, accessCount: 0,
    txHash: 't', attestation: 'a', canView: true, canDownload: false, canShare: false, ownerAddress: owner,
  };
}

beforeEach(() => {
  __resetConsentForTests();
  __resetAccessForTests();
});

describe('population analytics', () => {
  it('suppresses everything when the cohort is below the minimum', async () => {
    for (let i = 0; i < MIN_COHORT - 1; i++) {
      const owner = seededAddress(500 + i);
      await createConsent(owner, consent(owner, 'cycle_data'));
    }

    const analytics = await computePopulationAnalytics();
    expect(analytics.cohortSize).toBe(MIN_COHORT - 1);
    expect(analytics.sufficientCohort).toBe(false);
    expect(analytics.consents).toBeNull();
    expect(analytics.accessGrants).toBeNull();
  });

  it('reports de-identified distributions with k-anonymity suppression', async () => {
    for (let i = 0; i < 5; i++) {
      const owner = seededAddress(600 + i);
      await createConsent(owner, consent(owner, 'cycle_data'));
      await createAccessGrant(owner, grant(owner, 'Active'));
    }
    const rare = seededAddress(606);
    await createConsent(rare, consent(rare, 'lab_results'));
    await createAccessGrant(rare, grant(rare, 'Pending'));

    const analytics = await computePopulationAnalytics();
    expect(analytics.cohortSize).toBe(6);
    expect(analytics.sufficientCohort).toBe(true);

    expect(analytics.consents?.byStatus.counts.active).toBe(6);
    expect(analytics.consents?.byScope.counts.cycle_data).toBe(5);
    expect(analytics.consents?.byScope.counts.lab_results).toBeUndefined(); // suppressed (<5)
    expect(analytics.consents?.byScope.suppressed).toBe(1);

    expect(analytics.accessGrants?.byStatus.counts.Active).toBe(5);
    expect(analytics.accessGrants?.byStatus.suppressed).toBe(1); // the single Pending
  });
});
