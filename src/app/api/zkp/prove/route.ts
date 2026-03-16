// ============================================================
// Shiora on Aethelred — ZKP Proof Generation API
// POST /api/zkp/prove — Generate a zero-knowledge proof for a claim
// ============================================================

import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  HTTP,
} from '@/lib/api/responses';
import { runMiddleware } from '@/lib/api/middleware';
import {
  seededHex,
  seededInt,
  generateTxHash,
} from '@/lib/utils';
import type { ZKProof, ZKClaimType } from '@/types';

// ────────────────────────────────────────────────────────────
// POST /api/zkp/prove
// ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const blocked = runMiddleware(request);
  if (blocked) return blocked;

  try {
    const body = await request.json();
    const { claimId, claimType } = body;

    if (!claimId) {
      return errorResponse('VALIDATION_ERROR', 'claimId is required', HTTP.BAD_REQUEST);
    }

    const seed = Date.now();
    const proof: ZKProof = {
      id: `proof-${seededHex(seed, 12)}`,
      claimType: (claimType as ZKClaimType) ?? 'age_range',
      proofHash: `0x${seededHex(seed + 10, 64)}`,
      publicInputs: `claimId: ${claimId}, verified: pending`,
      verified: false,
      createdAt: Date.now(),
      expiresAt: Date.now() + 90 * 86400000,
    };

    return successResponse(proof, HTTP.CREATED, {
      message: 'ZK proof generation initiated. Verification pending.',
      estimatedGas: seededInt(seed, 50000, 200000),
    });
  } catch {
    return errorResponse('INVALID_BODY', 'Invalid JSON body', HTTP.BAD_REQUEST);
  }
}
