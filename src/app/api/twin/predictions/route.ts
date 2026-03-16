// ============================================================
// Shiora on Aethelred — Digital Twin Predictions API
// GET /api/twin/predictions — returns TwinPrediction[]
// ============================================================

import { NextRequest } from 'next/server';
import { successResponse } from '@/lib/api/responses';
import { runMiddleware } from '@/lib/api/middleware';
import {
  seededRandom,
  seededHex,
  seededInt,
  generateAttestation,
} from '@/lib/utils';
import type { TwinPrediction } from '@/types';

const SEED = 2200;

// ---- Prediction biomarker definitions ----

const PREDICTION_DEFS: Array<{
  metric: string;
  unit: string;
  currentBase: number;
  driftRate: number; // per 30 days
  riskLevel: TwinPrediction['riskLevel'];
  recommendations: string[];
}> = [
  {
    metric: 'HbA1c',
    unit: '%',
    currentBase: 5.8,
    driftRate: 0.1,
    riskLevel: 'moderate',
    recommendations: [
      'Maintain low glycemic diet',
      'Increase aerobic exercise to 150 min/week',
      'Monitor fasting glucose weekly',
    ],
  },
  {
    metric: 'LDL Cholesterol',
    unit: 'mg/dL',
    currentBase: 128,
    driftRate: 3.5,
    riskLevel: 'moderate',
    recommendations: [
      'Reduce saturated fat intake',
      'Consider statin therapy evaluation',
      'Increase omega-3 fatty acids',
    ],
  },
  {
    metric: 'Blood Pressure Systolic',
    unit: 'mmHg',
    currentBase: 132,
    driftRate: 1.8,
    riskLevel: 'high',
    recommendations: [
      'Reduce sodium intake to below 2300 mg/day',
      'Practice stress management techniques',
      'Schedule cardiology follow-up',
    ],
  },
  {
    metric: 'Resting Heart Rate',
    unit: 'bpm',
    currentBase: 72,
    driftRate: -0.8,
    riskLevel: 'low',
    recommendations: [
      'Continue current exercise regimen',
      'Monitor for bradycardia symptoms',
      'Track HRV trends weekly',
    ],
  },
  {
    metric: 'Cortisol',
    unit: 'mcg/dL',
    currentBase: 17.2,
    driftRate: 0.6,
    riskLevel: 'moderate',
    recommendations: [
      'Implement daily mindfulness practice',
      'Improve sleep hygiene and duration',
      'Consider adaptogenic supplements',
    ],
  },
  {
    metric: 'BMI',
    unit: 'kg/m2',
    currentBase: 25.8,
    driftRate: 0.15,
    riskLevel: 'low',
    recommendations: [
      'Maintain current caloric balance',
      'Focus on lean protein and fiber intake',
      'Track weight trends bi-weekly',
    ],
  },
];

export async function GET(request: NextRequest) {
  const blocked = runMiddleware(request);
  if (blocked) return blocked;

  const predictions: TwinPrediction[] = PREDICTION_DEFS.map((def, i) => {
    const baseSeed = SEED + 600 + i * 31;

    // Add seeded variation to current value
    const noise = (seededRandom(baseSeed) - 0.5) * 2;
    const currentValue = parseFloat(
      (def.currentBase + noise * (def.unit === '%' ? 0.1 : def.unit === 'kg/m2' ? 0.2 : 1)).toFixed(
        def.unit === '%' || def.unit === 'mcg/dL' || def.unit === 'kg/m2' ? 1 : 0,
      ),
    );

    const decimals = def.unit === '%' || def.unit === 'mcg/dL' || def.unit === 'kg/m2' ? 1 : 0;

    // Generate predicted values with drift + noise
    const p30Noise = (seededRandom(baseSeed + 1) - 0.5) * 1.5;
    const p60Noise = (seededRandom(baseSeed + 2) - 0.5) * 2;
    const p90Noise = (seededRandom(baseSeed + 3) - 0.5) * 2.5;

    const predicted30d = parseFloat((currentValue + def.driftRate * 1 + p30Noise * (def.unit === '%' ? 0.05 : def.unit === 'kg/m2' ? 0.1 : 0.5)).toFixed(decimals));
    const predicted60d = parseFloat((currentValue + def.driftRate * 2 + p60Noise * (def.unit === '%' ? 0.05 : def.unit === 'kg/m2' ? 0.1 : 0.5)).toFixed(decimals));
    const predicted90d = parseFloat((currentValue + def.driftRate * 3 + p90Noise * (def.unit === '%' ? 0.05 : def.unit === 'kg/m2' ? 0.1 : 0.5)).toFixed(decimals));

    const confidenceBand = Math.round(seededRandom(baseSeed + 4) * 8 + 88); // 88-96%

    return {
      id: `pred-${seededHex(baseSeed, 12)}`,
      twinId: `twin-${seededHex(SEED, 12)}`,
      metric: def.metric,
      currentValue,
      predicted30d,
      predicted60d,
      predicted90d,
      unit: def.unit,
      confidenceBand,
      riskLevel: def.riskLevel,
      recommendations: def.recommendations,
      attestation: generateAttestation(baseSeed + 5),
      generatedAt: Date.now() - seededInt(baseSeed + 6, 1, 48) * 3600000,
    };
  });

  return successResponse(predictions);
}
