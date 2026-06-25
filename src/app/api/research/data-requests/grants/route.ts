// ============================================================
// Shiora on Aethelred — Researcher Active Grants API
// GET /api/research/data-requests/grants — the researcher's active grants
//   (approved data-access requests that have not yet expired)
//   (researcher audience)
// ============================================================

import { NextRequest } from 'next/server';
import { successResponse } from '@/lib/api/responses';
import { runMiddleware } from '@/lib/api/middleware';
import { requireCapability } from '@/lib/api/rbac';
import { listActiveGrants } from '@/lib/api/data-access-service';

export async function GET(request: NextRequest) {
  const blocked = await runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const auth = await requireCapability(request, 'access_research_marketplace');
  if ('status' in auth) return auth;

  const grants = await listActiveGrants(auth.walletAddress!);
  return successResponse({ total: grants.length, grants });
}
