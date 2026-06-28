// ============================================================
// Shiora on Aethelred — ZKP Proof Generation API
// POST /api/zkp/prove — generate a REAL zero-knowledge set-membership proof
//   (all audiences; owner-scoped). Proves the caller's private value is in the
//   given public set without revealing it.
// ============================================================

import { NextRequest } from 'next/server';
import { z, ZodError } from 'zod';

import { successResponse, validationError, errorResponse, HTTP } from '@/lib/api/responses';
import { runMiddleware, requireAuth } from '@/lib/api/middleware';
import { generateProof, CLAIM_TYPES, MAX_SET, type ClaimType } from '@/lib/api/zkp-service';

const ProveSchema = z.object({
  claimType: z.enum(Object.keys(CLAIM_TYPES) as [ClaimType, ...ClaimType[]]),
  value: z.number().int().min(0),
  set: z.array(z.number().int().min(0)).min(1).max(MAX_SET),
});

export async function POST(request: NextRequest) {
  const blocked = await runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const auth = requireAuth(request);
  if ('status' in auth) return auth;

  try {
    const { claimType, value, set } = ProveSchema.parse(await request.json());
    const record = await generateProof(auth.walletAddress!, claimType, value, set);
    return successResponse({
      proofId: record.id,
      claimType: record.claimType,
      context: record.context,
      proof: record.proof,
      createdAt: record.createdAt,
      expiresAt: record.expiresAt,
    }, HTTP.CREATED);
  } catch (err) {
    if (err instanceof ZodError) return validationError(err);
    // e.g. value not in set — a false statement cannot be proven.
    return errorResponse('PROOF_FAILED', (err as Error).message, HTTP.BAD_REQUEST);
  }
}
