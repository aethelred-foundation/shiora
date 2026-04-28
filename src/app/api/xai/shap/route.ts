// ============================================================
// Shiora on Aethelred — XAI SHAP Values API
// GET /api/xai/shap — Get SHAP values for an inference
// ============================================================

import { NextRequest } from 'next/server';
import { successResponse, errorResponse, HTTP } from '@/lib/api/responses';
import { runMiddleware } from '@/lib/api/middleware';
import { seededRandom, seededInt } from '@/lib/utils';

const SEED = 1600;

const FEATURES = [
  'Cycle Length',
  'BBT Average',
  'LH Surge Timing',
  'Age',
  'BMI',
  'Sleep Quality',
  'Stress Level',
  'Exercise Frequency',
  'Previous Cycle Regularity',
  'Hormone Balance Score',
];

// ────────────────────────────────────────────────────────────
// GET /api/xai/shap
// ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const blocked = runMiddleware(request);
  if (blocked) return blocked;

  const inferenceId = request.nextUrl.searchParams.get('inferenceId');

  if (!inferenceId) {
    return errorResponse(
      'VALIDATION_ERROR',
      'inferenceId query parameter is required',
      HTTP.UNPROCESSABLE,
    );
  }

  const baseValue = seededRandom(SEED) * 0.3 + 0.4;

  const shapValues = FEATURES.map((feature, j) => ({
    feature,
    value: parseFloat((seededRandom(SEED + j * 10) * 100).toFixed(1)),
    baseValue: parseFloat(baseValue.toFixed(3)),
    contribution: parseFloat(((seededRandom(SEED + j * 11) - 0.5) * 0.3).toFixed(4)),
  }));

  return successResponse({
    inferenceId,
    shapValues,
    baseValue: parseFloat(baseValue.toFixed(3)),
    outputValue: parseFloat(
      (baseValue + shapValues.reduce((s, v) => s + v.contribution, 0)).toFixed(3),
    ),
  });
}
