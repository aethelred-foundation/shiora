// ============================================================
// Shiora on Aethelred — Staking API
// GET  /api/staking — List staking positions
// POST /api/staking — Stake tokens
// ============================================================

import { NextRequest } from 'next/server';
import { successResponse, errorResponse, HTTP } from '@/lib/api/responses';
import { runMiddleware } from '@/lib/api/middleware';
import { seededInt, seededHex, seededRandom, generateTxHash } from '@/lib/utils';

const SEED = 1450;

// ────────────────────────────────────────────────────────────
// GET /api/staking
// ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const blocked = runMiddleware(request);
  if (blocked) return blocked;

  const view = request.nextUrl.searchParams.get('view');

  // Return aggregated staking stats
  if (view === 'stats') {
    return successResponse({
      totalStaked: seededInt(SEED + 200, 500000, 2000000),
      totalStakers: seededInt(SEED + 201, 200, 1000),
      currentAPY: parseFloat((seededRandom(SEED + 202) * 8 + 4).toFixed(1)),
      rewardsDistributed: seededInt(SEED + 203, 50000, 200000),
      nextRewardEpoch: Date.now() + seededInt(SEED + 204, 1, 7) * 86400000,
      minStakeAmount: 100,
      unstakeCooldownDays: 7,
    });
  }

  const positions = Array.from({ length: 3 }, (_, i) => {
    const status = i < 2 ? 'staked' : 'unstaking';
    const amount = seededInt(SEED + i * 10, 1000, 50000);
    return {
      id: `stake-${seededHex(SEED + i * 100, 8)}`,
      staker: 'aeth1demo000000000000000000000000000000000',
      amount,
      stakedAt: Date.now() - seededInt(SEED + i * 11, 30, 180) * 86400000,
      status,
      rewardsEarned: Math.round(amount * 0.082 * (seededInt(SEED + i * 11, 30, 180) / 365)),
      rewardsClaimed: 0,
      votingPower: amount,
      txHash: generateTxHash(SEED + i * 14),
    };
  });

  return successResponse(positions);
}

// ────────────────────────────────────────────────────────────
// POST /api/staking
// ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const blocked = runMiddleware(request);
  if (blocked) return blocked;

  try {
    const body = await request.json();
    const { amount } = body;

    if (!amount || typeof amount !== 'number' || amount < 100) {
      return errorResponse('VALIDATION_ERROR', 'amount must be a number >= 100', HTTP.UNPROCESSABLE);
    }

    const seed = Date.now();
    const position = {
      id: `stake-${seededHex(seed, 8)}`,
      staker: request.headers.get('x-wallet-address') ?? 'aeth1demo000000000000000000000000000000000',
      amount,
      stakedAt: Date.now(),
      status: 'staked',
      rewardsEarned: 0,
      rewardsClaimed: 0,
      votingPower: amount,
      txHash: generateTxHash(seed),
    };

    return successResponse(position, HTTP.CREATED, {
      message: 'Tokens staked successfully.',
    });
  } catch {
    return errorResponse('INVALID_REQUEST', 'Invalid request body', HTTP.BAD_REQUEST);
  }
}
