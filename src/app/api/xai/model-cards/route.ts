// ============================================================
// Shiora on Aethelred — XAI Model Cards API
// GET /api/xai/model-cards — Get model cards for all AI models
// ============================================================

import { NextRequest } from 'next/server';
import { successResponse } from '@/lib/api/responses';
import { runMiddleware } from '@/lib/api/middleware';
import { seededRandom, seededInt } from '@/lib/utils';
import { AI_MODELS } from '@/lib/constants';

const SEED = 1600;

// ────────────────────────────────────────────────────────────
// GET /api/xai/model-cards
// ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const blocked = runMiddleware(request);
  if (blocked) return blocked;

  const modelCards = AI_MODELS.map((model, i) => ({
    modelId: model.id,
    name: model.name,
    version: model.version,
    description: model.description,
    architecture: model.type,
    trainingDataSize: seededInt(SEED + i * 10, 50000, 500000),
    validationAccuracy: model.accuracy,
    fairnessMetrics: {
      demographicParity: parseFloat((0.85 + seededRandom(SEED + i * 11) * 0.13).toFixed(3)),
      equalizedOdds: parseFloat((0.82 + seededRandom(SEED + i * 12) * 0.15).toFixed(3)),
      calibration: parseFloat((0.88 + seededRandom(SEED + i * 13) * 0.1).toFixed(3)),
    },
    limitations: [
      'May be less accurate for individuals with irregular cycles',
      'Training data primarily from ages 18-45',
      'Performance decreases with fewer than 3 months of data',
    ],
    intendedUse: model.description,
    lastUpdated: Date.now() - seededInt(SEED + i * 14, 5, 60) * 86400000,
  }));

  return successResponse(modelCards);
}
