// ============================================================
// Shiora on Aethelred — Deployment profiles / server-side feature flags
// (consultant P0: freeze the production scope to one pilot corridor)
//
// The external production-readiness review's strongest product finding: do not
// launch six audiences and 43 features at once. This module implements the
// server-side scope freeze. Two profiles:
//
//   full  — every implemented surface enabled for development and test only.
//   pilot — ONLY the pilot corridor is served: onboarding/auth + account
//           recovery codes (/api/me/recovery), FHIR ingestion, encrypted
//           records, consent, verified provider access + clinical notes,
//           break-glass emergency access with retrospective review
//           (/api/break-glass — deliberately IN the corridor: a care pilot
//           cannot ship without an emergency path), patient-visible access
//           history, export/erasure, operational notifications, and optional
//           fail-soft anchoring. Everything else answers 503 FEATURE_DISABLED
//           at the middleware, before any handler logic runs.
//
// The profile is read from SHIORA_PROFILE at request time (not module load) so
// operators can verify it via GET /api/system/status. Anything not explicitly
// disabled below is part of the corridor; the deferred list is the consultant's
// deferral list, verbatim. docs/PILOT_SCOPE.md is the human-readable contract.
// ============================================================

export type DeploymentProfile = 'full' | 'pilot';

/** Resolve the active deployment profile. Production always fails closed. */
export function activeProfile(
  env: Record<string, string | undefined> = process.env,
): DeploymentProfile {
  if (env.NODE_ENV === 'production') return 'pilot';
  return env.SHIORA_PROFILE === 'pilot' ? 'pilot' : 'full';
}

/**
 * Top-level /api/<segment> surfaces disabled under the pilot profile, mapped
 * to the reason reported to callers. Segment match is exact (so `health-plans`
 * is disabled while `health` probes stay up).
 */
export const PILOT_DISABLED_SEGMENTS: Readonly<Record<string, string>> = {
  employer: 'Employer functionality is deferred from the pilot scope.',
  'health-plans': 'Health-plan/payer functionality is deferred from the pilot scope.',
  governance: 'Government access workflows are deferred from the pilot scope.',
  population: 'Population analytics are deferred from the pilot scope.',
  community: 'Community circles are deferred from the pilot scope.',
  marketplace: 'The research marketplace is deferred from the pilot scope.',
  research: 'Research workflows are deferred from the pilot scope.',
  mpc: 'The user-facing MPC experience is deferred from the pilot scope.',
  zkp: 'The user-facing ZK experience is deferred from the pilot scope.',
  chat: 'Live SANA chat is deferred from the pilot scope pending clinical inference governance.',
  sana: 'Live SANA functionality is deferred from the pilot scope pending clinical inference governance.',
  clinical: 'Clinical decision support is deferred pending a regulatory pathway.',
  genomics: 'Genomics is deferred from the pilot scope.',
  twin: 'The digital twin is deferred from the pilot scope.',
  // The simulated emergency-response feature stays deferred. Break-glass
  // emergency ACCESS (/api/break-glass) is a different, real surface and is
  // deliberately part of the corridor.
  emergency: 'Emergency response is deferred from the pilot scope.',
  xai: 'Inference explainability is deferred from the pilot scope.',
  wearables: 'Wearables are deferred unless the signed pilot use case requires them.',
  insights: 'Wearable-derived insights are deferred with wearables.',
  alerts: 'Health alerts are deferred from the pilot scope.',
  vault: 'Cycle/symptom vault logging is deferred unless the signed pilot scope includes it.',
  compliance: 'Audience-facing compliance reports are deferred from the pilot scope.',
  webhooks: 'Outbound webhooks are deferred unless the pilot partner integration requires them.',
  tee: 'The TEE explorer is a simulated surface and is not part of the pilot.',
  staking: 'Chain surfaces are not part of the pilot.',
  rewards: 'Chain surfaces are not part of the pilot.',
  ipfs: 'Content-addressing surfaces are not part of the pilot.',
};

/** Client page segments hidden when their backing API surface is deferred. */
export const PILOT_DISABLED_PAGE_SEGMENTS = new Set([
  'alerts',
  'chat',
  'clinical',
  'community',
  'compliance',
  'emergency',
  'genomics',
  'governance',
  'insights',
  'marketplace',
  'mpc',
  'research',
  'rewards',
  'staking',
  'tee-explorer',
  'twin',
  'vault',
  'wearables',
]);

/**
 * Reason an API pathname is disabled under the given profile, or null when it
 * is served. Only exact top-level segments are matched.
 */
export function featureDisabledReason(
  pathname: string,
  profile: DeploymentProfile = activeProfile(),
): string | null {
  if (profile === 'full' || !pathname.startsWith('/api/')) {
    return null;
  }
  const segment = pathname.slice('/api/'.length).split('/')[0];
  return PILOT_DISABLED_SEGMENTS[segment] ?? null;
}
