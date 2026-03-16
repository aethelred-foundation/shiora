// ============================================================
// Shiora on Aethelred — Community Circles API
// GET /api/community/circles — List all community circles
// ============================================================

import { NextRequest } from 'next/server';
import { successResponse } from '@/lib/api/responses';
import { runMiddleware } from '@/lib/api/middleware';
import { seededInt, seededHex, seededRandom } from '@/lib/utils';
import { COMMUNITY_CATEGORIES } from '@/lib/constants';

const SEED = 1500;

const CIRCLE_NAMES: Record<string, string> = {
  fertility: 'Fertility Journeys',
  pregnancy: 'Expecting Together',
  menopause: 'Menopause Matters',
  endometriosis: 'Endo Warriors',
  pcos: 'PCOS Support Circle',
  general_wellness: 'Wellness Hub',
  mental_health: 'Mindful Health',
  nutrition: 'Nourish & Thrive',
};

// ────────────────────────────────────────────────────────────
// GET /api/community/circles
// ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const blocked = runMiddleware(request);
  if (blocked) return blocked;

  const circles = COMMUNITY_CATEGORIES.map((cat, i) => ({
    id: `circle-${seededHex(SEED + i * 100, 8)}`,
    name: CIRCLE_NAMES[cat.id] || cat.label,
    category: cat.id,
    description: cat.description,
    memberCount: seededInt(SEED + i * 10, 150, 2500),
    postCount: seededInt(SEED + i * 11, 50, 800),
    createdAt: Date.now() - seededInt(SEED + i * 12, 60, 365) * 86400000,
    isJoined: i < 5,
    requiresZKP: i < 4,
    icon: cat.icon,
    color: cat.color,
  }));

  return successResponse(circles);
}
