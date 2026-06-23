/** @jest-environment node */

import { CAPABILITIES, capabilitiesFor, hasCapability } from '@/lib/api/capabilities';

describe('capabilities', () => {
  it('grants an individual record and consent management', () => {
    expect(capabilitiesFor(['individual'])).toEqual(['manage_own_records', 'manage_consent']);
  });

  it('grants a provider the clinical capabilities', () => {
    expect(capabilitiesFor(['provider'])).toContain('clinical_decision_support');
  });

  it('unions capabilities across multiple roles without duplicates', () => {
    const caps = capabilitiesFor(['individual', 'provider', 'researcher']);
    expect(caps).toContain('manage_own_records');
    expect(caps).toContain('view_granted_records');
    expect(caps).toContain('access_research_marketplace');
    expect(new Set(caps).size).toBe(caps.length);
  });

  it('returns capabilities in the canonical order', () => {
    const caps = capabilitiesFor(['researcher', 'individual']);
    const indices = caps.map((c) => CAPABILITIES.indexOf(c));
    expect(indices).toEqual([...indices].sort((a, b) => a - b));
  });

  it('covers every role in the matrix', () => {
    const caps = capabilitiesFor([
      'individual', 'provider', 'employer_admin', 'payer_analyst', 'government', 'researcher',
    ]);
    expect(caps).toEqual(CAPABILITIES);
  });

  it('hasCapability reflects the role grants', () => {
    expect(hasCapability(['government'], 'manage_roles')).toBe(true);
    expect(hasCapability(['individual'], 'manage_roles')).toBe(false);
  });
});
