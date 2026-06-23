// ============================================================
// Shiora on Aethelred — Audience Roles
//
// The six audiences Shiora serves, modeled as authorization roles. Every
// authenticated wallet is at minimum an `individual` (sovereign over their own
// health data); additional roles are granted to providers, employers, payers,
// governments, and researchers and gate the capabilities each audience needs.
// ============================================================

export const ROLES = [
  'individual',
  'provider',
  'employer_admin',
  'payer_analyst',
  'government',
  'researcher',
] as const;

export type Role = (typeof ROLES)[number];

/** Every wallet starts as an individual managing their own data. */
export const DEFAULT_ROLES: readonly Role[] = ['individual'];

/** Human-readable label for each role (the audience it represents). */
export const ROLE_LABELS: Record<Role, string> = {
  individual: 'Individual',
  provider: 'Provider',
  employer_admin: 'Employer Administrator',
  payer_analyst: 'Health Plan Analyst',
  government: 'Government',
  researcher: 'Researcher',
};

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}
