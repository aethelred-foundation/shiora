// ============================================================
// Shiora on Aethelred — Marketplace Stats API
// GET /api/marketplace/stats — Marketplace aggregated statistics
// ============================================================

import { NextRequest } from 'next/server';
import { successResponse } from '@/lib/api/responses';
import { runMiddleware } from '@/lib/api/middleware';
import { seededInt, seededRandom } from '@/lib/utils';
import { MARKETPLACE_CATEGORIES } from '@/lib/constants';

export async function GET(request: NextRequest) {
  const blocked = runMiddleware(request);
  if (blocked) return blocked;

  const SEED = 900;
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');

  // Revenue time-series for the RevenueChart component.
  if (type === 'revenue') {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const revenue = days.map((day, i) => ({
      day,
      revenue: parseFloat((seededRandom(SEED + 500 + i * 17) * 800 + 100).toFixed(2)),
      transactions: seededInt(SEED + 600 + i * 13, 3, 25),
    }));
    return successResponse(revenue);
  }

  const stats = {
    totalListings: 20,
    activeListings: 14,
    totalVolume: parseFloat(
      Array.from({ length: 20 }, (_, i) =>
        (seededRandom(SEED + i * 23) * 500 + 10) * seededInt(SEED + i * 31, 0, 25),
      )
        .reduce((a, b) => a + b, 0)
        .toFixed(2),
    ),
    totalSellers: 12,
    totalBuyers: 34,
    averagePrice: parseFloat(
      (
        Array.from({ length: 20 }, (_, i) => seededRandom(SEED + i * 23) * 500 + 10).reduce(
          (a, b) => a + b,
          0,
        ) / 20
      ).toFixed(2),
    ),
    topCategories: MARKETPLACE_CATEGORIES.slice(0, 5).map((cat, i) => ({
      category: cat.id,
      count: seededInt(SEED + 800 + i * 7, 5, 30),
      volume: parseFloat((seededRandom(SEED + 800 + i * 11) * 5000 + 500).toFixed(2)),
    })),
  };

  return successResponse(stats);
}
