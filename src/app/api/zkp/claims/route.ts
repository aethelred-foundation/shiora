// ============================================================
// Shiora on Aethelred — ZKP Claims API
// GET /api/zkp/claims — the supported claim-type catalog + the caller's proofs
//   (all audiences; owner-scoped)
// ============================================================

import { NextRequest } from 'next/server';

import { successResponse } from '@/lib/api/responses';
import { runMiddleware, requireAuth } from '@/lib/api/middleware';
import { listProofs, CLAIM_TYPES } from '@/lib/api/zkp-service';

export async function GET(request: NextRequest) {
  const blocked = await runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const auth = requireAuth(request);
  if ('status' in auth) return auth;

  const claimTypes = Object.entries(CLAIM_TYPES).map(([type, description]) => ({ type, description }));
  const proofs = (await listProofs(auth.walletAddress!))
    .map((proof) => ({
      id: proof.id,
      claimType: proof.claimType,
      createdAt: proof.createdAt,
      expiresAt: proof.expiresAt,
    }))
    .sort((a, b) => b.createdAt - a.createdAt);

  return successResponse({ claimTypes, proofs });
}
