// ============================================================
// Shiora on Aethelred — Staking Rewards API
// GET  /api/staking/rewards — List staking rewards
// POST /api/staking/rewards — Claim rewards
// ============================================================

import { NextRequest } from 'next/server';
import { successResponse, errorResponse, HTTP } from '@/lib/api/responses';
import { runMiddleware } from '@/lib/api/middleware';
import { seededInt, seededHex, seededPick, generateTxHash } from '@/lib/utils';

const SEED = 1450;

// ────────────────────────────────────────────────────────────
// GET /api/staking/rewards
// ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const blocked = runMiddleware(request);
  if (blocked) return blocked;

  const sources = ['staking_apy', 'marketplace_fees', 'governance_bonus'] as const;

  const rewards = Array.from({ length: 12 }, (_, i) => ({
    id: `reward-${seededHex(SEED + i * 200, 8)}`,
    positionId: `stake-${seededHex(SEED + (i % 3) * 100, 8)}`,
    amount: seededInt(SEED + i * 20, 5, 200),
    source: seededPick(SEED + i * 21, sources),
    earnedAt: Date.now() - seededInt(SEED + i * 22, 1, 60) * 86400000,
    claimedAt: i < 6 ? Date.now() - seededInt(SEED + i * 23, 1, 30) * 86400000 : null,
    txHash: i < 6 ? generateTxHash(SEED + i * 24) : null,
  }));

  return successResponse(rewards);
}

// ────────────────────────────────────────────────────────────
// POST /api/staking/rewards — Claim rewards for a position
// ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const blocked = runMiddleware(request);
  if (blocked) return blocked;

  try {
    const body = await request.json();
    const { positionId } = body;

    if (!positionId) {
      return errorResponse('VALIDATION_ERROR', 'positionId is required', HTTP.UNPROCESSABLE);
    }

    const seed = Date.now();
    return successResponse(
      {
        positionId,
        claimedAmount: seededInt(seed, 10, 100),
        claimedAt: Date.now(),
        txHash: generateTxHash(seed),
      },
      HTTP.OK,
      {
        message: 'Rewards claimed successfully.',
      },
    );
  } catch {
    return errorResponse('INVALID_REQUEST', 'Invalid request body', HTTP.BAD_REQUEST);
  }
}
