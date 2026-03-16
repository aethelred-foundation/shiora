// ============================================================
// Shiora on Aethelred — MPC Results API
// GET /api/mpc/results — List completed MPC computation results
// ============================================================

import { NextRequest } from 'next/server';
import { successResponse, HTTP } from '@/lib/api/responses';
import { runMiddleware } from '@/lib/api/middleware';
import {
  seededRandom,
  seededInt,
  seededHex,
  generateTxHash,
  generateAttestation,
} from '@/lib/utils';
import type { MPCResult } from '@/types';

// ────────────────────────────────────────────────────────────
// Deterministic seed
// ────────────────────────────────────────────────────────────

const SEED = 2300;

// ────────────────────────────────────────────────────────────
// Mock data generators
// ────────────────────────────────────────────────────────────

const RESULT_QUERIES = [
  'Average resting heart rate by age cohort',
  'Median cycle length across populations',
  'Aggregated biomarker correlation matrix',
  'Federated medication efficacy score',
] as const;

const RESULT_NAMES = [
  'Heart Rate Population Study',
  'Cycle Length Meta-Analysis',
  'Biomarker Correlation Discovery',
  'Drug Efficacy Cross-Validation',
] as const;

const AGGREGATED_KEYS: string[][] = [
  ['18-25', '26-35', '36-45', '46-55', '56+'],
  ['Short (<24d)', 'Normal (24-35d)', 'Long (>35d)', 'Irregular'],
  ['HbA1c-LDL', 'TSH-Cortisol', 'CRP-Ferritin', 'VitD-B12', 'HDL-Triglycerides'],
  ['Drug A', 'Drug B', 'Drug C', 'Placebo'],
];

function generateResults(): MPCResult[] {
  const results: MPCResult[] = [];

  for (let i = 0; i < 4; i++) {
    const s = SEED + 2000 + i * 53;

    // Build aggregated result map
    const aggregated: Record<string, number> = {};
    const keys = AGGREGATED_KEYS[i];
    for (let k = 0; k < keys.length; k++) {
      aggregated[keys[k]] = parseFloat((seededRandom(s + k * 7) * 80 + 20).toFixed(1));
    }

    results.push({
      id: `res-${seededHex(s, 10)}`,
      sessionId: `mpc-${seededHex(SEED + (i + 4) * 43, 12)}`,
      query: RESULT_QUERIES[i],
      aggregatedResult: aggregated,
      participantCount: seededInt(s + 1, 5, 18),
      roundsCompleted: seededInt(s + 2, 15, 45),
      privacyBudgetUsed: parseFloat((seededRandom(s + 3) * 4 + 1).toFixed(2)),
      confidenceInterval: parseFloat((seededRandom(s + 4) * 3 + 0.5).toFixed(2)),
      noiseAdded: parseFloat((seededRandom(s + 5) * 0.5 + 0.1).toFixed(3)),
      attestation: generateAttestation(s + 6),
      commitmentHash: `0x${seededHex(s + 7, 64)}`,
      txHash: generateTxHash(s + 8),
      completedAt: Date.now() - seededInt(s + 9, 86_400_000, 86_400_000 * 21),
    });
  }

  return results.sort((a, b) => b.completedAt - a.completedAt);
}

// ────────────────────────────────────────────────────────────
// GET /api/mpc/results
// ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const blocked = runMiddleware(request);
  if (blocked) return blocked;

  return successResponse(generateResults(), HTTP.OK, {
    queriedAt: new Date().toISOString(),
  });
}
