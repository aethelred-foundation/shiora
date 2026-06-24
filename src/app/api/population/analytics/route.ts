// ============================================================
// Shiora on Aethelred — Population Analytics API
// GET /api/population/analytics — de-identified population metrics
//   (government / health-plan / employer audiences)
// ============================================================

import { NextRequest } from 'next/server';

import { successResponse } from '@/lib/api/responses';
import { runMiddleware } from '@/lib/api/middleware';
import { requireCapability } from '@/lib/api/rbac';
import { computePopulationAnalytics } from '@/lib/api/population-analytics';

export async function GET(request: NextRequest) {
  const blocked = runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const auth = await requireCapability(request, 'view_population_analytics');
  if ('status' in auth) return auth;

  const analytics = await computePopulationAnalytics();
  return successResponse(analytics);
}
