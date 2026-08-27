// ============================================================
// Shiora on Aethelred — Insight Inferences (trends)
// GET /api/insights/inferences — per-metric trend over the caller's own
//   telemetry (auth-gated, owner-scoped, non-diagnostic).
// ============================================================

import { NextRequest } from 'next/server';

import { successResponse } from '@/lib/api/responses';
import { runMiddleware, extractAuth } from '@/lib/api/middleware';
import { listInferences } from '@/lib/api/insights-service';

export async function GET(request: NextRequest) {
  const blocked = await runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const owner = extractAuth(request).walletAddress as string;
  return successResponse(await listInferences(owner));
}
