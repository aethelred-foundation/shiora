// ============================================================
// Shiora on Aethelred — Digital Twin Simulations API
// GET  /api/twin/simulations — returns TwinSimulation[]
// POST /api/twin/simulations — creates a new simulation
// ============================================================

import { NextRequest } from 'next/server';
import { successResponse, errorResponse, HTTP } from '@/lib/api/responses';
import { runMiddleware } from '@/lib/api/middleware';
import {
  seededRandom,
  seededInt,
  seededHex,
  generateAttestation,
  generateTxHash,
} from '@/lib/utils';
import type { TwinSimulation, TwinParameter } from '@/types';

const SEED = 2200;

// ---- Simulation scenario definitions ----

const SCENARIOS: Array<{
  scenario: string;
  description: string;
  status: TwinSimulation['status'];
  params: Array<{
    name: string;
    category: string;
    unit: string;
    current: number;
    simulated: number;
    min: number;
    max: number;
    step: number;
  }>;
  metrics: Array<{ metric: string; unit: string; beforeBase: number; afterBase: number }>;
}> = [
  {
    scenario: 'Increase Exercise',
    description:
      'Simulate the impact of increasing daily exercise from 30 to 60 minutes per day over 90 days.',
    status: 'completed',
    params: [
      {
        name: 'Exercise Minutes/Week',
        category: 'Activity',
        unit: 'min',
        current: 210,
        simulated: 420,
        min: 0,
        max: 600,
        step: 30,
      },
      {
        name: 'Steps/Day',
        category: 'Activity',
        unit: 'steps',
        current: 8000,
        simulated: 12000,
        min: 2000,
        max: 20000,
        step: 500,
      },
    ],
    metrics: [
      { metric: 'Resting Heart Rate', unit: 'bpm', beforeBase: 72, afterBase: 65 },
      { metric: 'VO2 Max', unit: 'mL/kg/min', beforeBase: 38, afterBase: 44 },
      { metric: 'BMI', unit: 'kg/m2', beforeBase: 26.4, afterBase: 24.8 },
      { metric: 'Blood Pressure Systolic', unit: 'mmHg', beforeBase: 128, afterBase: 120 },
    ],
  },
  {
    scenario: 'Add Statin Medication',
    description:
      'Simulate adding 20mg atorvastatin daily and its projected effect on lipid panel over 90 days.',
    status: 'completed',
    params: [
      {
        name: 'Atorvastatin Dose',
        category: 'Medication',
        unit: 'mg',
        current: 0,
        simulated: 20,
        min: 0,
        max: 80,
        step: 10,
      },
    ],
    metrics: [
      { metric: 'LDL Cholesterol', unit: 'mg/dL', beforeBase: 145, afterBase: 98 },
      { metric: 'Total Cholesterol', unit: 'mg/dL', beforeBase: 228, afterBase: 185 },
      { metric: 'Triglycerides', unit: 'mg/dL', beforeBase: 170, afterBase: 140 },
      { metric: 'HDL Cholesterol', unit: 'mg/dL', beforeBase: 48, afterBase: 52 },
    ],
  },
  {
    scenario: 'Improve Sleep',
    description:
      'Simulate improving sleep duration from 6 to 8 hours and sleep quality from 65 to 85 over 90 days.',
    status: 'completed',
    params: [
      {
        name: 'Sleep Hours/Night',
        category: 'Sleep',
        unit: 'hrs',
        current: 6,
        simulated: 8,
        min: 4,
        max: 10,
        step: 0.5,
      },
      {
        name: 'Sleep Quality Score',
        category: 'Sleep',
        unit: 'pts',
        current: 65,
        simulated: 85,
        min: 0,
        max: 100,
        step: 5,
      },
    ],
    metrics: [
      { metric: 'Cortisol Level', unit: 'mcg/dL', beforeBase: 18.5, afterBase: 13.2 },
      { metric: 'HRV', unit: 'ms', beforeBase: 42, afterBase: 56 },
      { metric: 'Cognitive Score', unit: 'pts', beforeBase: 72, afterBase: 84 },
      { metric: 'Immune Score', unit: 'pts', beforeBase: 68, afterBase: 78 },
    ],
  },
  {
    scenario: 'Reduce Sodium',
    description:
      'Simulate reducing daily sodium intake from 3400mg to 2000mg and its cardiovascular impact.',
    status: 'completed',
    params: [
      {
        name: 'Sodium Intake',
        category: 'Diet',
        unit: 'mg/day',
        current: 3400,
        simulated: 2000,
        min: 500,
        max: 5000,
        step: 100,
      },
    ],
    metrics: [
      { metric: 'Blood Pressure Systolic', unit: 'mmHg', beforeBase: 132, afterBase: 122 },
      { metric: 'Blood Pressure Diastolic', unit: 'mmHg', beforeBase: 86, afterBase: 78 },
      { metric: 'Kidney GFR', unit: 'mL/min', beforeBase: 88, afterBase: 94 },
      { metric: 'Fluid Retention', unit: 'score', beforeBase: 6.5, afterBase: 3.2 },
    ],
  },
  {
    scenario: 'Start Meditation',
    description:
      'Simulate adding 20 minutes of daily meditation and mindfulness practice for stress reduction.',
    status: 'simulating',
    params: [
      {
        name: 'Meditation Minutes/Day',
        category: 'Wellness',
        unit: 'min',
        current: 0,
        simulated: 20,
        min: 0,
        max: 60,
        step: 5,
      },
      {
        name: 'Stress Score',
        category: 'Stress',
        unit: 'pts',
        current: 72,
        simulated: 45,
        min: 0,
        max: 100,
        step: 5,
      },
    ],
    metrics: [
      { metric: 'Cortisol Level', unit: 'mcg/dL', beforeBase: 19.8, afterBase: 12.5 },
      { metric: 'Blood Pressure Systolic', unit: 'mmHg', beforeBase: 130, afterBase: 122 },
      { metric: 'HRV', unit: 'ms', beforeBase: 40, afterBase: 54 },
      { metric: 'Stress Score', unit: 'pts', beforeBase: 72, afterBase: 45 },
    ],
  },
];

function buildSimulation(scenarioIdx: number): TwinSimulation {
  const s = SCENARIOS[scenarioIdx];
  const baseSeed = SEED + 100 + scenarioIdx * 50;

  const parameters: TwinParameter[] = s.params.map((p, j) => ({
    id: `param-${seededHex(baseSeed + j * 7, 12)}`,
    name: p.name,
    category: p.category,
    currentValue: p.current,
    unit: p.unit,
    min: p.min,
    max: p.max,
    step: p.step,
    simulatedValue: p.simulated,
  }));

  const beforeMetrics = s.metrics.map((m) => ({
    metric: m.metric,
    value: m.beforeBase,
    unit: m.unit,
  }));

  const afterMetrics = s.metrics.map((m) => ({
    metric: m.metric,
    value: m.afterBase,
    unit: m.unit,
  }));

  // Generate 90-day trajectory data for the first metric
  const primaryMetric = s.metrics[0];
  const trajectoryData: { day: number; before: number; after: number; metric: string }[] = [];
  for (let d = 0; d <= 90; d += 5) {
    const progress = d / 90;
    const noise = seededRandom(baseSeed + d * 3) * 2 - 1;
    const beforeVal = primaryMetric.beforeBase + noise * 1.5;
    const delta = primaryMetric.afterBase - primaryMetric.beforeBase;
    const afterVal = primaryMetric.beforeBase + delta * progress + noise * 1.2;
    trajectoryData.push({
      day: d,
      before: parseFloat(beforeVal.toFixed(1)),
      after: parseFloat(afterVal.toFixed(1)),
      metric: primaryMetric.metric,
    });
  }

  const startedAt = Date.now() - seededInt(baseSeed + 20, 1, 60) * 86400000;

  return {
    id: `sim-${seededHex(baseSeed, 12)}`,
    twinId: `twin-${seededHex(SEED, 12)}`,
    scenario: s.scenario,
    description: s.description,
    parameters,
    status: s.status,
    startedAt,
    completedAt:
      s.status === 'completed'
        ? startedAt + seededInt(baseSeed + 21, 3600000, 86400000)
        : undefined,
    beforeMetrics,
    afterMetrics,
    confidenceInterval: Math.round(seededRandom(baseSeed + 22) * 8 + 88), // 88-96
    trajectoryData,
    attestation: generateAttestation(baseSeed + 23),
    txHash: generateTxHash(baseSeed + 24),
  };
}

export async function GET(request: NextRequest) {
  const blocked = runMiddleware(request);
  if (blocked) return blocked;

  const simulations = SCENARIOS.map((_, i) => buildSimulation(i));
  return successResponse(simulations);
}

export async function POST(request: NextRequest) {
  const blocked = runMiddleware(request);
  if (blocked) return blocked;

  try {
    const body = await request.json();
    const { scenario, description, parameters } = body;

    if (!scenario || !description) {
      return errorResponse(
        'VALIDATION_ERROR',
        'scenario and description are required',
        HTTP.BAD_REQUEST,
      );
    }

    // Generate a mock new simulation from the request
    const newSeed = SEED + 500 + (Date.now() % 1000);

    const newSimulation: TwinSimulation = {
      id: `sim-${seededHex(newSeed, 12)}`,
      twinId: `twin-${seededHex(SEED, 12)}`,
      scenario,
      description,
      parameters: (parameters ?? []).map((p: { id: string; value: number }, j: number) => ({
        id: p.id,
        name: `Parameter ${j + 1}`,
        category: 'Custom',
        currentValue: p.value,
        unit: '',
        min: 0,
        max: 100,
        step: 1,
        simulatedValue: p.value,
      })),
      status: 'simulating',
      startedAt: Date.now(),
      beforeMetrics: [],
      afterMetrics: [],
      confidenceInterval: 90,
      trajectoryData: [],
      attestation: generateAttestation(newSeed + 1),
      txHash: generateTxHash(newSeed + 2),
    };

    return successResponse(newSimulation, HTTP.CREATED);
  } catch {
    return errorResponse('INVALID_BODY', 'Invalid JSON in request body', HTTP.BAD_REQUEST);
  }
}
