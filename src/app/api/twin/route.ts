// ============================================================
// Shiora on Aethelred — Digital Twin API
// GET /api/twin — returns DigitalTwin (main twin data with organ scores)
// ============================================================

import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/api/responses';
import { runMiddleware } from '@/lib/api/middleware';
import {
  seededRandom,
  seededInt,
  seededHex,
  seededAddress,
  generateAttestation,
  generateTxHash,
} from '@/lib/utils';
import { ORGAN_SYSTEMS } from '@/lib/constants';
import type { DigitalTwin, OrganSystem } from '@/types';

const SEED = 2200;

export async function GET(request: NextRequest) {
  const blocked = runMiddleware(request);
  if (blocked) return blocked;

  // Generate organ scores for each of the 10 organ systems
  const organScores = ORGAN_SYSTEMS.map((organ, i) => {
    const score = Math.round(seededRandom(SEED + i * 13 + 1) * 35 + 60); // 60-95
    const trendOptions = ['improving', 'stable', 'declining'] as const;
    const trendIdx = Math.floor(seededRandom(SEED + i * 17 + 2) * 3);
    const trend = trendOptions[trendIdx];
    const lastUpdated = Date.now() - seededInt(SEED + i * 7 + 3, 1, 72) * 3600000;

    return {
      system: organ.id as OrganSystem,
      score,
      trend,
      lastUpdated,
    };
  });

  // Calculate overall health score as weighted average
  const avgScore = Math.round(
    organScores.reduce((sum, o) => sum + o.score, 0) / organScores.length,
  );

  const twin: DigitalTwin = {
    id: `twin-${seededHex(SEED, 12)}`,
    ownerAddress: seededAddress(SEED + 1),
    createdAt: Date.now() - 90 * 86400000, // 90 days ago
    lastUpdated: Date.now() - seededInt(SEED + 2, 1, 24) * 3600000,
    modelVersion: 'v2.4.1',
    organScores,
    overallHealthScore: avgScore,
    dataSourceCount: 7,
    simulationCount: 5,
    attestation: generateAttestation(SEED + 3),
    txHash: generateTxHash(SEED + 4),
  };

  return successResponse(twin);
}
