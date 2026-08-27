// ============================================================
// Shiora on Aethelred — Break-glass retrospective queue (consultant P0)
// GET /api/break-glass/review — every break-glass use, newest first, with its
// derived status, for administrative review. ?pending=true filters to uses
// still awaiting a verdict. Admin-only.
// ============================================================

import { NextRequest } from 'next/server';

import { successResponse } from '@/lib/api/responses';
import { runMiddleware } from '@/lib/api/middleware';
import { requireAdmin } from '@/lib/api/rbac';
import { listBreakGlassUses } from '@/lib/api/break-glass-service';

export async function GET(request: NextRequest) {
  const blocked = await runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const auth = await requireAdmin(request);
  if ('status' in auth) return auth;

  const pendingOnly = request.nextUrl.searchParams.get('pending') === 'true';
  const uses = await listBreakGlassUses({ pendingOnly });

  return successResponse({
    uses,
    pendingCount: uses.filter((use) => use.grant.review === null).length,
  });
}
