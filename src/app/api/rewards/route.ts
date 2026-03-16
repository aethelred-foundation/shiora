/**
 * Shiora on Aethelred — Rewards API Route
 *
 * GET /api/rewards — List reward entries (with optional action, claimed filters)
 */

import { NextRequest, NextResponse } from 'next/server';

import type {
  RewardEntry,
  RewardAction,
  ApiResponse,
} from '@/types';
import {
  seededHex,
  seededPick,
  seededRandom,
  seededInt,
  generateTxHash,
} from '@/lib/utils';
import { REWARD_ACTIONS } from '@/lib/constants';

// ---------------------------------------------------------------------------
// In-memory mock data
// ---------------------------------------------------------------------------

const SEED = 1700;

function generateRewards(): RewardEntry[] {
  const actions: RewardAction[] = REWARD_ACTIONS.map((a) => a.id as RewardAction);
  const descriptions: Record<string, string[]> = {
    data_upload: ['Uploaded lab results', 'Uploaded imaging report'],
    wearable_sync: ['Synced Oura Ring data', 'Synced Apple Health data'],
    community_post: ['Posted in Fertility circle', 'Shared health tip'],
    health_checkup: ['Completed annual checkup', 'Completed blood work'],
    data_contribution: ['Contributed to fertility study', 'Contributed to cycle research'],
    streak_bonus: ['7-day upload streak bonus', '14-day sync streak bonus'],
    milestone: ['Reached Level 5', 'First 100 uploads'],
    referral: ['Referred a new user', 'Referral completed onboarding'],
  };

  return Array.from({ length: 25 }, (_, i) => {
    const action = seededPick(SEED + i * 7, actions);
    const actionDef = REWARD_ACTIONS.find((a) => a.id === action)!;
    const descs = descriptions[action] /* istanbul ignore next */ ?? ['Reward earned'];
    const earned = Date.now() - i * 86400000 * (0.5 + seededRandom(SEED + i * 3) * 2);
    const claimed = i >= 5 ? earned + seededInt(SEED + i * 11, 1, 24) * 3600000 : undefined;

    return {
      id: `rwd-${seededHex(SEED + i * 100, 12)}`,
      action,
      description: seededPick(SEED + i * 5, descs),
      amount: actionDef.aethel * (1 + Math.floor(seededRandom(SEED + i * 9) * 0.5)),
      currency: 'AETHEL' as const,
      earnedAt: earned,
      claimedAt: claimed,
      txHash: claimed ? generateTxHash(SEED + i * 30) : undefined,
    };
  });
}

const rewards = generateRewards();

// ---------------------------------------------------------------------------
// GET /api/rewards
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const action = searchParams.get('action') as RewardAction | null;
  const claimed = searchParams.get('claimed');

  let filtered = [...rewards];

  if (action) {
    filtered = filtered.filter((r) => r.action === action);
  }

  if (claimed === 'true') {
    filtered = filtered.filter((r) => !!r.claimedAt);
  } else if (claimed === 'false') {
    filtered = filtered.filter((r) => !r.claimedAt);
  }

  filtered.sort((a, b) => b.earnedAt - a.earnedAt);

  const body: ApiResponse<RewardEntry[]> = {
    success: true,
    data: filtered,
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(body);
}
