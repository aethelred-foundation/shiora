// ============================================================
// Shiora on Aethelred — Digital Twin Parameters API
// GET /api/twin/parameters — returns TwinParameter[]
// ============================================================

import { NextRequest } from 'next/server';
import { successResponse } from '@/lib/api/responses';
import { runMiddleware } from '@/lib/api/middleware';
import { seededRandom, seededHex } from '@/lib/utils';
import type { TwinParameter } from '@/types';

const SEED = 2200;

// ---- Parameter definitions grouped by category ----

const PARAMETER_DEFS: Array<{
  name: string;
  category: string;
  unit: string;
  base: number;
  min: number;
  max: number;
  step: number;
}> = [
  // Physical
  { name: 'Weight', category: 'Physical', unit: 'kg', base: 78, min: 40, max: 150, step: 0.5 },
  { name: 'Height', category: 'Physical', unit: 'cm', base: 175, min: 140, max: 210, step: 1 },
  { name: 'BMI', category: 'Physical', unit: 'kg/m2', base: 25.5, min: 15, max: 45, step: 0.1 },
  // Activity
  { name: 'Steps/Day', category: 'Activity', unit: 'steps', base: 8200, min: 1000, max: 25000, step: 500 },
  { name: 'Exercise Min/Week', category: 'Activity', unit: 'min', base: 210, min: 0, max: 600, step: 15 },
  { name: 'Active Calories/Day', category: 'Activity', unit: 'kcal', base: 420, min: 100, max: 1200, step: 50 },
  // Sleep
  { name: 'Sleep Hours/Night', category: 'Sleep', unit: 'hrs', base: 6.5, min: 3, max: 12, step: 0.5 },
  { name: 'Sleep Quality Score', category: 'Sleep', unit: 'pts', base: 68, min: 0, max: 100, step: 5 },
  { name: 'Sleep Latency', category: 'Sleep', unit: 'min', base: 22, min: 1, max: 90, step: 1 },
  // Diet
  { name: 'Daily Calories', category: 'Diet', unit: 'kcal', base: 2200, min: 1000, max: 4000, step: 50 },
  { name: 'Sodium Intake', category: 'Diet', unit: 'mg/day', base: 3200, min: 500, max: 6000, step: 100 },
  { name: 'Fiber Intake', category: 'Diet', unit: 'g/day', base: 18, min: 5, max: 50, step: 1 },
  // Stress
  { name: 'Cortisol Level', category: 'Stress', unit: 'mcg/dL', base: 16.5, min: 3, max: 30, step: 0.5 },
  { name: 'Stress Score', category: 'Stress', unit: 'pts', base: 65, min: 0, max: 100, step: 5 },
  { name: 'Meditation Min/Day', category: 'Stress', unit: 'min', base: 0, min: 0, max: 60, step: 5 },
];

export async function GET(request: NextRequest) {
  const blocked = runMiddleware(request);
  if (blocked) return blocked;

  const parameters: TwinParameter[] = PARAMETER_DEFS.map((def, i) => {
    const baseSeed = SEED + 400 + i * 11;
    // Add slight variation to base values using seeded randomness
    const variation = (seededRandom(baseSeed) - 0.5) * def.step * 4;
    const currentValue = parseFloat(
      Math.max(def.min, Math.min(def.max, def.base + variation)).toFixed(
        def.step < 1 ? 1 : 0,
      ),
    );

    return {
      id: `param-${seededHex(baseSeed, 12)}`,
      name: def.name,
      category: def.category,
      currentValue,
      unit: def.unit,
      min: def.min,
      max: def.max,
      step: def.step,
    };
  });

  return successResponse(parameters);
}
