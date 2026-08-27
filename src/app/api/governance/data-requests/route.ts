// ============================================================
// Shiora on Aethelred — Governance Data Request Review API
// GET /api/governance/data-requests — every data-access request (optional
//   ?status= filter) for a government data steward to review.
//   (government audience)
// ============================================================

import { NextRequest } from 'next/server';

import { successResponse } from '@/lib/api/responses';
import { runMiddleware } from '@/lib/api/middleware';
import { requireCapability } from '@/lib/api/rbac';
import { listAllDataRequests, dataRequestStats } from '@/lib/api/data-access-service';

export async function GET(request: NextRequest) {
  const blocked = await runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const auth = await requireCapability(request, 'review_data_requests');
  if ('status' in auth) return auth;

  let requests = await listAllDataRequests();
  const status = request.nextUrl.searchParams.get('status');
  if (status) {
    requests = requests.filter((req) => req.status === status);
  }

  const summary = await dataRequestStats();
  return successResponse({ total: requests.length, summary, requests });
}
