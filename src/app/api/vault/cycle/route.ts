// ============================================================
// Shiora on Aethelred — Cycle Entries API
// GET /api/vault/cycle — Retrieve cycle tracking entries
// ============================================================

import { NextRequest } from 'next/server';
import { runMiddleware } from '@/lib/api/middleware';
import { successResponse } from '@/lib/api/responses';
import { seededRandom, seededInt, seededHex, seededPick } from '@/lib/utils';
import type { CyclePhase } from '@/types';

const SEED = 700;

function generateCycleEntries() {
  const entries = [];
  const totalDays = 84;
  const cycleLength = 28;

  for (let i = 0; i < totalDays; i++) {
    const dayInCycle = (i % cycleLength) + 1;
    let phase: CyclePhase;
    let flow: 'none' | 'light' | 'medium' | 'heavy' = 'none';

    if (dayInCycle <= 5) {
      phase = 'menstrual';
      flow = dayInCycle <= 2 ? 'heavy' : dayInCycle <= 4 ? 'medium' : 'light';
    } else if (dayInCycle <= 13) {
      phase = 'follicular';
    } else if (dayInCycle <= 16) {
      phase = 'ovulation';
    } else {
      phase = 'luteal';
    }

    const baseTemp = dayInCycle <= 14 ? 97.2 : 97.8;
    const tempVariation = seededRandom(SEED + i * 31) * 0.6;
    const temperature = parseFloat((baseTemp + tempVariation).toFixed(1));

    let fertilityScore: number;
    if (dayInCycle >= 10 && dayInCycle <= 16) {
      fertilityScore = Math.min(98, 60 + seededInt(SEED + i * 41, 15, 38));
    } else if (dayInCycle >= 8 && dayInCycle <= 18) {
      fertilityScore = 30 + seededInt(SEED + i * 41, 10, 25);
    } else {
      fertilityScore = seededInt(SEED + i * 41, 5, 25);
    }

    entries.push({
      id: `cycle-${seededHex(SEED + i * 200, 12)}`,
      date: Date.now() - (totalDays - i) * 86400000,
      day: dayInCycle,
      phase,
      temperature,
      flow,
      symptoms: [],
      fertilityScore,
      notes: '',
    });
  }

  return entries;
}

// ────────────────────────────────────────────────────────────
// GET /api/vault/cycle
// ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const blocked = runMiddleware(request);
  if (blocked) return blocked;

  const entries = generateCycleEntries();

  // Optional query param for limiting days
  const daysParam = request.nextUrl.searchParams.get('days');
  const days = daysParam ? parseInt(daysParam, 10) : undefined;

  const data = days ? entries.slice(-days) : entries;

  return successResponse({
    entries: data,
    total: data.length,
    currentCycleDay: data.length > 0 ? data[data.length - 1].day : /* istanbul ignore next */ 1,
    currentPhase:
      data.length > 0 ? data[data.length - 1].phase : /* istanbul ignore next */ 'follicular',
    averageCycleLength: 28,
  });
}
