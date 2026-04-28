// ============================================================
// Shiora on Aethelred — MPC Datasets API
// GET /api/mpc/datasets — List available datasets for MPC
// ============================================================

import { NextRequest } from 'next/server';
import { successResponse, HTTP } from '@/lib/api/responses';
import { runMiddleware } from '@/lib/api/middleware';
import { seededRandom, seededInt, seededHex, seededPick } from '@/lib/utils';
import type { MPCDataset, RecordType } from '@/types';

// ────────────────────────────────────────────────────────────
// Deterministic seed
// ────────────────────────────────────────────────────────────

const SEED = 2300;

// ────────────────────────────────────────────────────────────
// Mock data generators
// ────────────────────────────────────────────────────────────

const DATASET_NAMES = [
  'Cardiovascular Vitals Repository',
  'Anonymized Fertility Markers',
  'Wearable Sleep Patterns',
  'Multi-Ethnic Lab Results',
  'Longitudinal Symptom Diary',
  'Pharmacogenomic Responses',
] as const;

const DATASET_DESCRIPTIONS = [
  'Heart rate, blood pressure, and ECG data from 3 hospital systems spanning 5 years.',
  'De-identified fertility biomarkers including LH, FSH, and progesterone from 2,400 participants.',
  'Sleep quality metrics including duration, latency, and REM cycles from wearable devices.',
  'Comprehensive blood work panels from diverse ethnic populations across 8 clinical sites.',
  'Daily symptom logs with severity ratings from chronic condition management programs.',
  'Drug metabolism and response data linked to genetic profiles across 15 pharmacies.',
] as const;

const DATA_TYPE_SETS: RecordType[][] = [
  ['vitals', 'lab_result'],
  ['lab_result', 'notes'],
  ['vitals'],
  ['lab_result'],
  ['notes', 'vitals'],
  ['prescription', 'lab_result'],
];

const PRIVACY_LEVELS: MPCDataset['privacyLevel'][] = ['standard', 'enhanced', 'maximum'];

function generateDatasets(): MPCDataset[] {
  const datasets: MPCDataset[] = [];

  for (let i = 0; i < 6; i++) {
    const s = SEED + 4000 + i * 67;

    datasets.push({
      id: `ds-${seededHex(s, 10)}`,
      name: DATASET_NAMES[i],
      description: DATASET_DESCRIPTIONS[i],
      ownerAnonymousId: `anon-${seededHex(s + 1, 6)}`,
      recordCount: seededInt(s + 2, 500, 50000),
      dataTypes: DATA_TYPE_SETS[i],
      qualityScore: parseFloat((seededRandom(s + 3) * 30 + 70).toFixed(1)),
      privacyLevel: seededPick(s + 4, PRIVACY_LEVELS),
      contributionReward: parseFloat((seededRandom(s + 5) * 45 + 5).toFixed(1)),
      participations: seededInt(s + 6, 0, 24),
      createdAt: Date.now() - seededInt(s + 7, 86_400_000, 86_400_000 * 60),
    });
  }

  return datasets;
}

// ────────────────────────────────────────────────────────────
// GET /api/mpc/datasets
// ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const blocked = runMiddleware(request);
  if (blocked) return blocked;

  return successResponse(generateDatasets(), HTTP.OK, {
    queriedAt: new Date().toISOString(),
  });
}
