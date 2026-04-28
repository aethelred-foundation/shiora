/**
 * Shiora on Aethelred — Provider Reputation API Route
 *
 * GET /api/providers/reputation — List providers with reputation scores
 */

import { NextRequest, NextResponse } from 'next/server';

import type { ProviderReputation, TrustLevel, ApiResponse } from '@/types';
import { seededInt, seededPick, seededAddress } from '@/lib/utils';
import { PROVIDER_NAMES, SPECIALTIES } from '@/lib/constants';

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const SEED = 1800;

function scoreTrustLevel(score: number): TrustLevel {
  if (score >= 90) return 'gold';
  if (score >= 75) return 'silver';
  if (score >= 60) return 'bronze';
  return 'unrated';
}

function generateProviders(): ProviderReputation[] {
  return Array.from({ length: 10 }, (_, i) => {
    const score = seededInt(SEED + i * 17, 55, 99);
    return {
      address: seededAddress(SEED + i * 50),
      name: PROVIDER_NAMES[i % PROVIDER_NAMES.length],
      specialty: seededPick(SEED + i * 7, SPECIALTIES),
      trustLevel: scoreTrustLevel(score),
      overallScore: score,
      reviewCount: seededInt(SEED + i * 11, 3, 28),
      totalAccesses: seededInt(SEED + i * 13, 10, 200),
      onTimeRevocations: seededInt(SEED + i * 15, 80, 100),
      dataBreaches: i === 7 ? 1 : 0,
      averageAccessDuration: seededInt(SEED + i * 19, 12, 90),
      registeredAt: Date.now() - seededInt(SEED + i * 21, 90, 730) * 86400000,
      lastActivityAt: Date.now() - seededInt(SEED + i * 23, 1, 30) * 86400000,
    };
  });
}

const providers = generateProviders();

// ---------------------------------------------------------------------------
// GET /api/providers/reputation
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const trustLevel = searchParams.get('trustLevel') as TrustLevel | null;
  const search = searchParams.get('search');

  let filtered = [...providers];

  if (trustLevel) {
    filtered = filtered.filter((p) => p.trustLevel === trustLevel);
  }

  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(
      (p) => p.name.toLowerCase().includes(q) || p.specialty.toLowerCase().includes(q),
    );
  }

  filtered.sort((a, b) => b.overallScore - a.overallScore);

  const body: ApiResponse<ProviderReputation[]> = {
    success: true,
    data: filtered,
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(body);
}
