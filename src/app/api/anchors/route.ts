// ============================================================
// Shiora on Aethelred — Audit Anchoring API (admin only)
// GET  /api/anchors — list anchors + re-verify the series
// POST /api/anchors — anchor the current audit head (call on a schedule)
// ============================================================

import { NextRequest } from 'next/server';

import { successResponse, HTTP } from '@/lib/api/responses';
import { runMiddleware } from '@/lib/api/middleware';
import { requireAdmin } from '@/lib/api/rbac';
import { createAnchor, listAnchors, verifyAnchors } from '@/lib/api/anchoring/anchor-service';

export async function GET(request: NextRequest) {
  const blocked = await runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const auth = await requireAdmin(request);
  if ('status' in auth) return auth;

  const anchors = await listAnchors();
  const verification = await verifyAnchors();
  return successResponse({ anchors, verification });
}

export async function POST(request: NextRequest) {
  const blocked = await runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const auth = await requireAdmin(request);
  if ('status' in auth) return auth;

  const anchor = await createAnchor();
  return successResponse(anchor, HTTP.CREATED);
}
