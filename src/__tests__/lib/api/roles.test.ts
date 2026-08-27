/** @jest-environment node */

import { ROLES, ROLE_LABELS, DEFAULT_ROLES, isRole } from '@/lib/api/roles';

describe('roles', () => {
  it('defines the six audience roles', () => {
    expect(ROLES).toEqual([
      'individual', 'provider', 'employer_admin', 'payer_analyst', 'government', 'researcher',
    ]);
  });

  it('defaults a new wallet to individual', () => {
    expect(DEFAULT_ROLES).toEqual(['individual']);
  });

  it('has a human-readable label for every role', () => {
    ROLES.forEach((role) => expect(typeof ROLE_LABELS[role]).toBe('string'));
  });

  it('isRole recognizes valid roles and rejects others', () => {
    expect(isRole('provider')).toBe(true);
    expect(isRole('researcher')).toBe(true);
    expect(isRole('superuser')).toBe(false);
    expect(isRole(42)).toBe(false);
    expect(isRole(undefined)).toBe(false);
  });
});
