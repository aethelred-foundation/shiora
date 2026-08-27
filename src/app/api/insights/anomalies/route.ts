// ============================================================
// Shiora on Aethelred — Insight Anomalies
// GET /api/insights/anomalies — z-score anomalies vs the caller's own baseline
//   (auth-gated, owner-scoped, non-diagnostic).
// ============================================================

import { NextRequest } from 'next/server';

import { successResponse } from '@/lib/api/responses';
import { runMiddleware, extractAuth } from '@/lib/api/middleware';
import { listAnomalies } from '@/lib/api/insights-service';

export async function GET(request: NextRequest) {
  const blocked = await runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const owner = extractAuth(request).walletAddress as string;
  return successResponse(await listAnomalies(owner));
}
