// ============================================================
// Shiora on Aethelred — Route → maturity resolver (edge-safe)
//
// Backs the global X-Shiora-Maturity response header (see src/middleware.ts) so
// a partner/auditor sees the maturity of EVERY endpoint, not only the
// /api/system/status registry. Kept self-contained (type-only import) so it is
// safe to run in the edge middleware runtime.
//
// Rules are matched most-specific-first. Anything under /api not explicitly
// listed defaults to 'production' — the core PHI/data routes — so simulated and
// pilot surfaces MUST be enumerated here and are guarded by route-maturity tests
// against the maturity registry, preventing silent over-claiming.
// ============================================================

import type { Maturity } from './maturity';

const RULES: ReadonlyArray<readonly [string, Maturity]> = [
  // Specific sub-routes that sit under an otherwise-production parent.
  ['/api/research/studies', 'pilot'],
  ['/api/governance/proposals', 'simulated'], // on-chain governance is simulated
  ['/api/governance/vote', 'simulated'],

  // Simulated feature areas (not backed by the named external system).
  ['/api/clinical', 'simulated'],
  ['/api/emergency', 'simulated'],
  ['/api/genomics', 'simulated'],
  ['/api/network', 'simulated'],
  ['/api/rewards', 'simulated'],
  ['/api/staking', 'simulated'],
  ['/api/tee', 'simulated'],
  ['/api/twin', 'simulated'],
  ['/api/xai', 'simulated'],

  // Pilot feature areas (real but bounded / config-gated).
  ['/api/alerts', 'pilot'],
  ['/api/insights', 'pilot'],
  ['/api/compliance', 'pilot'],
  ['/api/anchors', 'pilot'],
  ['/api/chat', 'pilot'],
  ['/api/community', 'pilot'],
  ['/api/fhir', 'pilot'],
  ['/api/sana', 'pilot'],
  ['/api/wearables', 'pilot'],
];

/**
 * The maturity tier for an API path. Defaults to 'production' (the core
 * PHI/data routes); simulated and pilot surfaces are enumerated in RULES.
 * Intended for /api/* paths (the middleware only calls it for those).
 */
export function maturityForPath(pathname: string): Maturity {
  for (const [prefix, maturity] of RULES) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      return maturity;
    }
  }
  return 'production';
}
