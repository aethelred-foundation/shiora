// ============================================================
// Shiora on Aethelred — Wearable analytics
// GET /api/wearables/analytics?metric= — derived summary over the caller's
//   own telemetry for one metric.
// ============================================================

import { NextRequest } from 'next/server';

import { successResponse, errorResponse, HTTP } from '@/lib/api/responses';
import { runMiddleware, extractAuth } from '@/lib/api/middleware';
import { summarizeMetric } from '@/lib/api/wearables-service';

export async function GET(request: NextRequest) {
  const blocked = await runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const owner = extractAuth(request).walletAddress as string;
  const metric = request.nextUrl.searchParams.get('metric');
  if (!metric) {
    return errorResponse('VALIDATION_ERROR', 'metric query parameter is required.', HTTP.BAD_REQUEST);
  }

  return successResponse(await summarizeMetric(owner, metric));
}
