// ============================================================
// Shiora on Aethelred — Insights Overview API
// GET /api/insights — AI insights overview with scores and predictions
// ============================================================

import { NextRequest } from 'next/server';
import { simulatedResponse } from '@/lib/api/maturity';
import { runMiddleware } from '@/lib/api/middleware';
import { generateInsightsOverview } from '@/lib/api/mock-data';

// ────────────────────────────────────────────────────────────
// GET /api/insights
// ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const blocked = await runMiddleware(request);
  if (blocked) return blocked;

  const overview = generateInsightsOverview();

  return simulatedResponse(overview, 'insights', 200, {
    computedAt: new Date().toISOString(),
    teeVerified: true,
    platform: 'Intel SGX',
  });
}
