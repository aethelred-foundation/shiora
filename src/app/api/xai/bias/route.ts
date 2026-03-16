// ============================================================
// Shiora on Aethelred — XAI Bias Report API
// GET /api/xai/bias — Get bias report for a specific model
// ============================================================

import { NextRequest } from 'next/server';
import { successResponse, errorResponse, HTTP } from '@/lib/api/responses';
import { runMiddleware } from '@/lib/api/middleware';
import { seededRandom, seededInt } from '@/lib/utils';
import { AI_MODELS } from '@/lib/constants';

const SEED = 1600;

const BIAS_CATEGORIES = [
  'Age Group 18-25', 'Age Group 26-35', 'Age Group 36-45', 'Age Group 46+',
  'Regular Cycles', 'Irregular Cycles',
  'BMI Normal', 'BMI Overweight',
];

// ────────────────────────────────────────────────────────────
// GET /api/xai/bias
// ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const blocked = runMiddleware(request);
  if (blocked) return blocked;

  const modelId = request.nextUrl.searchParams.get('modelId');

  if (!modelId) {
    return errorResponse('VALIDATION_ERROR', 'modelId query parameter is required', HTTP.UNPROCESSABLE);
  }

  const modelIndex = AI_MODELS.findIndex((m) => m.id === modelId);
  if (modelIndex === -1) {
    return errorResponse('NOT_FOUND', `Model '${modelId}' not found`, HTTP.NOT_FOUND);
  }

  const i = modelIndex;
  const biasReport = {
    modelId,
    reportDate: Date.now() - seededInt(SEED + i * 40, 1, 30) * 86400000,
    overallBiasScore: parseFloat((seededRandom(SEED + i * 41) * 0.15 + 0.02).toFixed(3)),
    categories: BIAS_CATEGORIES.map((category, j) => ({
      category,
      biasScore: parseFloat((seededRandom(SEED + i * 42 + j) * 0.2).toFixed(3)),
      sampleSize: seededInt(SEED + i * 43 + j, 500, 5000),
      recommendation: seededRandom(SEED + i * 44 + j) > 0.7
        ? 'No action needed.'
        : 'Monitor bias levels.',
    })),
  };

  return successResponse(biasReport);
}
