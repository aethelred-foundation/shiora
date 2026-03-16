/**
 * Shiora on Aethelred — Rewards History API Route
 *
 * GET  /api/rewards/history — Get reward claim history
 * POST /api/rewards/history — Claim a reward
 */

import { NextRequest, NextResponse } from 'next/server';

import type {
  RewardEntry,
  ApiResponse,
} from '@/types';
import {
  seededHex,
  generateTxHash,
} from '@/lib/utils';

// ---------------------------------------------------------------------------
// In-memory store
// ---------------------------------------------------------------------------

const claimedRewards: RewardEntry[] = [];

// ---------------------------------------------------------------------------
// GET /api/rewards/history
// ---------------------------------------------------------------------------

export async function GET() {
  const body: ApiResponse<RewardEntry[]> = {
    success: true,
    data: claimedRewards,
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(body);
}

// ---------------------------------------------------------------------------
// POST /api/rewards/history
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const { id, action, description, amount } = await request.json();

    if (!id || !action || !amount) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'id, action, and amount are required' },
          timestamp: new Date().toISOString(),
        } satisfies ApiResponse<never>,
        { status: 400 },
      );
    }

    const seed = Date.now();
    const claimed: RewardEntry = {
      id,
      action,
      description: description ?? 'Reward claimed',
      amount,
      currency: 'AETHEL',
      earnedAt: Date.now() - 3600000,
      claimedAt: Date.now(),
      txHash: generateTxHash(seed),
    };

    claimedRewards.unshift(claimed);

    const body: ApiResponse<RewardEntry> = {
      success: true,
      data: claimed,
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(body, { status: 201 });
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to claim reward' },
        timestamp: new Date().toISOString(),
      } satisfies ApiResponse<never>,
      { status: 500 },
    );
  }
}
