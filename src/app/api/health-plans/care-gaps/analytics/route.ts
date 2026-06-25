// ============================================================
// Shiora on Aethelred — Health Plan Care Gap Analytics API
// GET /api/health-plans/care-gaps/analytics — closure performance summary
//   (health-plan audience; owner-scoped to the payer)
// ============================================================

import { NextRequest } from 'next/server';

import { successResponse } from '@/lib/api/responses';
import { runMiddleware } from '@/lib/api/middleware';
import { requireCapability } from '@/lib/api/rbac';
import { careGapAnalytics } from '@/lib/api/care-gap-service';

export async function GET(request: NextRequest) {
  const blocked = await runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const auth = await requireCapability(request, 'manage_care_gaps');
  if ('status' in auth) return auth;

  return successResponse(await careGapAnalytics(auth.walletAddress!));
}
