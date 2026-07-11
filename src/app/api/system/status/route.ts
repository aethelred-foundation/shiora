// ============================================================
// Shiora on Aethelred — Platform Capability Status
// GET /api/system/status — public, non-PHI transparency surface
//
// Exposes the feature-maturity registry verbatim: exactly which capabilities
// are production-grade, pilot, or simulated, plus the production-readiness
// preflight. This is the machine-readable counterpart to the readiness tracker,
// so a partner or auditor can see what is real without reading the source.
// ============================================================

import { NextRequest } from 'next/server';
import { successResponse } from '@/lib/api/responses';
import { runMiddleware } from '@/lib/api/middleware';
import { featureList, maturitySummary } from '@/lib/api/maturity';
import { checkProductionReadiness } from '@/lib/api/preflight';
import { RELEASE_VERSION } from '@/lib/api/release';
import { activeProfile } from '@/lib/api/feature-flags';

export async function GET(request: NextRequest) {
  const blocked = await runMiddleware(request);
  if (blocked) return blocked;

  const readiness = checkProductionReadiness();

  return successResponse(
    {
      service: 'Shiora on Aethelred',
      version: RELEASE_VERSION,
      profile: activeProfile(),
      maturity: maturitySummary(),
      features: featureList(),
      readiness: {
        ok: readiness.ok,
        enforced: readiness.enforced,
        problems: readiness.problems,
      },
    },
    200,
    { generatedAt: new Date().toISOString() },
  );
}
