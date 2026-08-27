// ============================================================
// Shiora on Aethelred — Health Insights Overview
// GET /api/insights — non-diagnostic statistical insights over the caller's
//   own encrypted telemetry (auth-gated, owner-scoped).
// ============================================================

import { NextRequest } from 'next/server';

import { successResponse } from '@/lib/api/responses';
import { runMiddleware, extractAuth } from '@/lib/api/middleware';
import { computeInsights } from '@/lib/api/insights-service';

export async function GET(request: NextRequest) {
  const blocked = await runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const owner = extractAuth(request).walletAddress as string;
  return successResponse(await computeInsights(owner));
}
