/**
 * Shiora on Aethelred — Single Provider API Route
 *
 * GET  /api/providers/[address] — Get provider details and reviews
 * POST /api/providers/[address] — Submit a review for this provider
 */

import { NextRequest, NextResponse } from 'next/server';

import type {
  ProviderReputation,
  ProviderReview,
  TrustLevel,
  ApiResponse,
} from '@/types';
import {
  seededRandom,
  seededInt,
  seededHex,
  seededPick,
  seededAddress,
} from '@/lib/utils';
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

const REVIEW_COMMENTS = [
  'Excellent communication and data handling practices.',
  'Prompt access to records and respectful of data boundaries.',
  'Great bedside manner, always explains before accessing data.',
  'Minor delays in revoking access but otherwise very good.',
  'Handled my reproductive data with utmost care and discretion.',
];

function generateReviews(): ProviderReview[] {
  const providers = generateProviders();
  return Array.from({ length: 20 }, (_, i) => {
    const provider = providers[i % providers.length];
    return {
      id: `rev-${seededHex(SEED + i * 100, 12)}`,
      providerAddress: provider.address,
      reviewerAnonymousId: `anon-${seededHex(SEED + i * 200, 8)}`,
      rating: seededInt(SEED + i * 31, 3, 5) as 1 | 2 | 3 | 4 | 5,
      categories: {
        communication: seededInt(SEED + i * 33, 3, 5),
        dataHandling: seededInt(SEED + i * 35, 3, 5),
        timeliness: seededInt(SEED + i * 37, 2, 5),
        professionalism: seededInt(SEED + i * 39, 3, 5),
      },
      comment: REVIEW_COMMENTS[i % REVIEW_COMMENTS.length],
      timestamp: Date.now() - seededInt(SEED + i * 41, 1, 180) * 86400000,
      verified: seededRandom(SEED + i * 43) > 0.2,
    };
  });
}

const providers = generateProviders();
const reviews = generateReviews();

// ---------------------------------------------------------------------------
// GET /api/providers/[address]
// ---------------------------------------------------------------------------

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ address: string }> },
) {
  const { address } = await params;
  const provider = providers.find((p) => p.address === address);

  if (!provider) {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Provider not found' },
        timestamp: new Date().toISOString(),
      } satisfies ApiResponse<never>,
      { status: 404 },
    );
  }

  const providerReviews = reviews.filter((r) => r.providerAddress === address);

  const body: ApiResponse<{ provider: ProviderReputation; reviews: ProviderReview[] }> = {
    success: true,
    data: { provider, reviews: providerReviews },
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(body);
}

// ---------------------------------------------------------------------------
// POST /api/providers/[address]
// ---------------------------------------------------------------------------

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> },
) {
  try {
    const { address } = await params;
    const provider = providers.find((p) => p.address === address);

    if (!provider) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Provider not found' },
          timestamp: new Date().toISOString(),
        } satisfies ApiResponse<never>,
        { status: 404 },
      );
    }

    const { rating, categories, comment } = await request.json();

    if (!rating || !categories || !comment) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'rating, categories, and comment are required' },
          timestamp: new Date().toISOString(),
        } satisfies ApiResponse<never>,
        { status: 400 },
      );
    }

    const seed = Date.now();
    const review: ProviderReview = {
      id: `rev-${seededHex(seed, 12)}`,
      providerAddress: address,
      reviewerAnonymousId: `anon-${seededHex(seed + 1, 8)}`,
      rating,
      categories,
      comment,
      timestamp: Date.now(),
      verified: true,
    };

    reviews.unshift(review);

    const body: ApiResponse<ProviderReview> = {
      success: true,
      data: review,
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(body, { status: 201 });
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to submit review' },
        timestamp: new Date().toISOString(),
      } satisfies ApiResponse<never>,
      { status: 500 },
    );
  }
}
