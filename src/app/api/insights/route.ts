// ============================================================
// Shiora on Aethelred — Insights Overview API
// GET /api/insights — AI insights overview with scores and predictions
// ============================================================

import { NextRequest } from 'next/server';
import { successResponse } from '@/lib/api/responses';
import { runMiddleware } from '@/lib/api/middleware';
import { generateInsightsOverview } from '@/lib/api/mock-data';

// ────────────────────────────────────────────────────────────
// GET /api/insights
// ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const blocked = runMiddleware(request);
  if (blocked) return blocked;

  const overview = generateInsightsOverview();

  return successResponse(overview, 200, {
    computedAt: new Date().toISOString(),
    teeVerified: true,
    platform: 'Intel SGX',
  });
}
