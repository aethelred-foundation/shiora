// ============================================================
// Shiora on Aethelred — Vault Overview API (real, owner-scoped)
// GET /api/vault — the caller's tracking summary + cycle insights
// ============================================================

import { NextRequest } from 'next/server';
import { runMiddleware, requireAuth } from '@/lib/api/middleware';
import { successResponse } from '@/lib/api/responses';
import { vaultOverview } from '@/lib/api/vault-service';

export async function GET(request: NextRequest) {
  const blocked = await runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const auth = requireAuth(request);
  if ('status' in auth) return auth;

  return successResponse(await vaultOverview(auth.walletAddress!));
}
