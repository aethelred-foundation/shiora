// ============================================================
// Shiora on Aethelred — Vault Analytics API (real, owner-scoped)
// GET /api/vault/analytics — derived cycle + symptom intelligence
//
// Cycle regularity/variability, fertile-window prediction, projected periods,
// symptom frequency and severity trend, and symptom-by-cycle-phase correlation —
// all computed from the caller's own logged data.
// ============================================================

import { NextRequest } from 'next/server';
import { runMiddleware, requireAuth } from '@/lib/api/middleware';
import { successResponse } from '@/lib/api/responses';
import { vaultAnalytics } from '@/lib/api/vault-service';

export async function GET(request: NextRequest) {
  const blocked = await runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const auth = requireAuth(request);
  if ('status' in auth) return auth;

  return successResponse(await vaultAnalytics(auth.walletAddress!));
}
