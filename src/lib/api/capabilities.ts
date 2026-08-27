// ============================================================
// Shiora on Aethelred — Capability Matrix
//
// Maps audience roles to concrete capabilities. This is the single source of
// truth for what each of the six audiences can do, consumed by the frontend
// (to shape each audience's experience) and by requireCapability on the server.
// ============================================================

import type { Role } from './roles';

export const CAPABILITIES = [
  'manage_own_records',
  'manage_consent',
  'view_granted_records',
  'clinical_decision_support',
  'manage_clinical_notes',
  'manage_org_members',
  'view_population_analytics',
  'manage_population_programs',
  'access_research_marketplace',
  'run_secure_computation',
  'manage_roles',
  'review_data_requests',
  'manage_care_gaps',
  'view_compliance',
] as const;

export type Capability = (typeof CAPABILITIES)[number];

/** The capabilities each role grants. */
const ROLE_CAPABILITIES: Record<Role, Capability[]> = {
  individual: ['manage_own_records', 'manage_consent'],
  provider: ['view_granted_records', 'clinical_decision_support', 'manage_clinical_notes'],
  employer_admin: ['manage_org_members', 'view_population_analytics', 'view_compliance'],
  payer_analyst: ['view_population_analytics', 'manage_care_gaps', 'view_compliance'],
  government: ['view_population_analytics', 'manage_population_programs', 'manage_roles', 'review_data_requests', 'view_compliance'],
  researcher: ['access_research_marketplace', 'run_secure_computation'],
};

/** The union of capabilities granted by a set of roles, in stable order. */
export function capabilitiesFor(roles: Role[]): Capability[] {
  const granted = new Set<Capability>();
  for (const role of roles) {
    for (const capability of ROLE_CAPABILITIES[role]) {
      granted.add(capability);
    }
  }
  return CAPABILITIES.filter((capability) => granted.has(capability));
}

/** True when a set of roles grants the given capability. */
export function hasCapability(roles: Role[], capability: Capability): boolean {
  return capabilitiesFor(roles).includes(capability);
}
