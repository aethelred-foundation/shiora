// ============================================================
// Shiora on Aethelred — Vault Overview API
// GET /api/vault — Vault overview stats
// ============================================================

import { NextRequest } from 'next/server';
import { runMiddleware } from '@/lib/api/middleware';
import { successResponse } from '@/lib/api/responses';
import { seededInt, seededHex } from '@/lib/utils';

const SEED = 700;

// ────────────────────────────────────────────────────────────
// GET /api/vault
// ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const blocked = runMiddleware(request);
  if (blocked) return blocked;

  const totalCompartments = 8;
  const lockedCompartments = 3;
  const totalRecords = 387;
  const totalStorage = seededInt(SEED, 5000, 25000) * 1024;

  return successResponse({
    overview: {
      totalCompartments,
      lockedCompartments,
      unlockedCompartments: totalCompartments - lockedCompartments,
      totalRecords,
      totalStorage,
      privacyScore: {
        overall: 87,
        encryptionScore: 95,
        accessControlScore: 82,
        jurisdictionScore: 85,
        dataMinimizationScore: 78,
      },
      lastAudit: Date.now() - 3 * 86400000,
      currentCycleDay: seededInt(SEED + 1, 1, 28),
      averageCycleLength: 28,
    },
  });
}
