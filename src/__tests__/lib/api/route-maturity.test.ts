/** @jest-environment node */

import { maturityForPath } from '@/lib/api/route-maturity';
import { maturityOf, type FeatureKey } from '@/lib/api/maturity';

describe('maturityForPath', () => {
  it('defaults unmapped API routes to production', () => {
    expect(maturityForPath('/api/records')).toBe('production');
    expect(maturityForPath('/api/me/profile')).toBe('production');
    expect(maturityForPath('/api/mpc/sessions')).toBe('production');
  });

  it('matches specific sub-routes ahead of their parent', () => {
    expect(maturityForPath('/api/research/studies')).toBe('pilot');
    expect(maturityForPath('/api/research/data-requests')).toBe('production');
    expect(maturityForPath('/api/governance/proposals')).toBe('simulated');
    expect(maturityForPath('/api/governance/data-requests')).toBe('production');
  });

  // Each header value must equal the registry maturity of the backing feature,
  // so the global header can never drift from /api/system/status.
  it.each([
    ['/api/genomics', 'genomics'],
    ['/api/clinical', 'clinical_decision_support'],
    ['/api/xai', 'explainable_ai'],
    ['/api/twin', 'digital_twin'],
    ['/api/insights', 'insights'],
    ['/api/emergency', 'emergency'],
    ['/api/compliance', 'compliance_reports'],
    ['/api/tee', 'tee_attestation'],
    ['/api/network', 'blockchain_anchoring'],
    ['/api/staking', 'blockchain_anchoring'],
    ['/api/rewards', 'blockchain_anchoring'],
    ['/api/sana', 'sana_assistant'],
    ['/api/chat', 'ai_assistant'],
    ['/api/wearables', 'wearables'],
    ['/api/fhir', 'fhir_interop'],
    ['/api/alerts', 'alerts'],
    ['/api/community', 'community'],
    ['/api/anchors', 'audit_anchoring'],
  ] as const)('%s maturity matches the registry feature %s', (path, feature) => {
    expect(maturityForPath(path)).toBe(maturityOf(feature as FeatureKey));
  });
});
