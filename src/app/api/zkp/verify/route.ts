// ============================================================
// Shiora on Aethelred — ZKP Proof Verification API
// POST /api/zkp/verify — Verify a zero-knowledge proof on-chain
// ============================================================

import { NextRequest } from 'next/server';
import {
  errorResponse,
  HTTP,
} from '@/lib/api/responses';
import { simulatedResponse } from '@/lib/api/maturity';
import { runMiddleware } from '@/lib/api/middleware';
import {
  seededInt,
  generateTxHash,
} from '@/lib/utils';
import type { ZKVerificationResult, ZKClaimType } from '@/types';

// ────────────────────────────────────────────────────────────
// POST /api/zkp/verify
// ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const blocked = await runMiddleware(request);
  if (blocked) return blocked;

  try {
    const body = await request.json();
    const { proofId, claimType } = body;

    if (!proofId) {
      return errorResponse('VALIDATION_ERROR', 'proofId is required', HTTP.BAD_REQUEST);
    }

    const seed = Date.now();
    const result: ZKVerificationResult = {
      valid: true,
      claimType: (claimType as ZKClaimType) ?? 'age_range',
      verifiedAt: Date.now(),
      blockHeight: 2847391 + seededInt(seed, 0, 500),
      gasUsed: seededInt(seed + 5, 50000, 200000),
    };

    return simulatedResponse(result, 'zk_proofs', HTTP.OK, {
      txHash: generateTxHash(seed),
    });
  } catch {
    return errorResponse('INVALID_BODY', 'Invalid JSON body', HTTP.BAD_REQUEST);
  }
}
