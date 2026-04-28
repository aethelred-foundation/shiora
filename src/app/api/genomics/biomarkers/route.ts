// ============================================================
// Shiora on Aethelred — Genomics Biomarkers API
// GET /api/genomics/biomarkers — returns all 10 Biomarker[] with history
// GET /api/genomics/biomarkers?marker=hba1c — returns single Biomarker
// ============================================================

import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/api/responses';
import { runMiddleware } from '@/lib/api/middleware';
import { seededRandom, seededInt, seededHex } from '@/lib/utils';
import type { Biomarker } from '@/types';

const SEED = 2600;

// ---- Biomarker definitions (spec: 10 biomarkers) ----

const BIOMARKER_DEFS: Array<{
  id: string;
  name: string;
  category: string;
  unit: string;
  refRange: { low: number; high: number };
  decimals: number;
}> = [
  {
    id: 'hba1c',
    name: 'HbA1c',
    category: 'Metabolic',
    unit: '%',
    refRange: { low: 4.0, high: 5.6 },
    decimals: 1,
  },
  {
    id: 'ldl',
    name: 'LDL Cholesterol',
    category: 'Lipid',
    unit: 'mg/dL',
    refRange: { low: 0, high: 100 },
    decimals: 0,
  },
  {
    id: 'hdl',
    name: 'HDL Cholesterol',
    category: 'Lipid',
    unit: 'mg/dL',
    refRange: { low: 40, high: 100 },
    decimals: 0,
  },
  {
    id: 'triglycerides',
    name: 'Triglycerides',
    category: 'Lipid',
    unit: 'mg/dL',
    refRange: { low: 0, high: 150 },
    decimals: 0,
  },
  {
    id: 'tsh',
    name: 'TSH',
    category: 'Thyroid',
    unit: 'mIU/L',
    refRange: { low: 0.4, high: 4.0 },
    decimals: 1,
  },
  {
    id: 'cortisol',
    name: 'Cortisol',
    category: 'Endocrine',
    unit: 'mcg/dL',
    refRange: { low: 6, high: 23 },
    decimals: 1,
  },
  {
    id: 'vitamin_d',
    name: 'Vitamin D',
    category: 'Nutritional',
    unit: 'ng/mL',
    refRange: { low: 30, high: 100 },
    decimals: 0,
  },
  {
    id: 'creatinine',
    name: 'Creatinine',
    category: 'Renal',
    unit: 'mg/dL',
    refRange: { low: 0.6, high: 1.2 },
    decimals: 1,
  },
  {
    id: 'alt',
    name: 'ALT',
    category: 'Hepatic',
    unit: 'U/L',
    refRange: { low: 7, high: 56 },
    decimals: 0,
  },
  {
    id: 'crp',
    name: 'CRP',
    category: 'Inflammatory',
    unit: 'mg/L',
    refRange: { low: 0, high: 3.0 },
    decimals: 1,
  },
];

function buildBiomarker(def: (typeof BIOMARKER_DEFS)[number]): Biomarker {
  const markerSeedOffset = def.id.split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  const baseSeed = SEED + 300 + markerSeedOffset;
  const { low, high } = def.refRange;
  const range = high - low || /* istanbul ignore next */ 1;

  const now = Date.now();
  const history: { date: number; value: number }[] = [];

  // Generate 6-point history (spec: mini sparkline showing 6-point history)
  for (let i = 0; i < 6; i++) {
    const baseValue = low + range * 0.3 + seededRandom(baseSeed + i * 17) * range * 0.9;
    const value = parseFloat(baseValue.toFixed(def.decimals));
    const date = now - (6 - i) * 60 * 86400000 + seededInt(baseSeed + i * 3, 0, 5) * 86400000;
    history.push({ date, value });
  }

  const currentValue = history[history.length - 1].value;
  const prevValue = history[history.length - 2].value;

  // Determine status
  let status: Biomarker['status'] = 'normal';
  if (currentValue < low * 0.9 || currentValue > high * 1.1) {
    status = 'abnormal';
  } else if (currentValue < low || currentValue > high) {
    status = 'borderline';
  }

  // Determine trend
  let trend: Biomarker['trend'] = 'stable';
  const diff = currentValue - prevValue;
  const diffPct = prevValue !== 0 ? Math.abs(diff / prevValue) : /* istanbul ignore next */ 0;
  if (diffPct > 0.05) {
    const prevDistFromNormal = Math.max(0, prevValue - high, low - prevValue);
    const curDistFromNormal = Math.max(0, currentValue - high, low - currentValue);
    trend = curDistFromNormal < prevDistFromNormal ? 'improving' : 'worsening';
  }

  return {
    id: `bm-${seededHex(baseSeed, 12)}`,
    name: def.name,
    category: def.category,
    currentValue,
    unit: def.unit,
    referenceRange: { low, high },
    status,
    trend,
    lastMeasured: history[history.length - 1].date,
    history,
  };
}

export async function GET(request: NextRequest) {
  const blocked = runMiddleware(request);
  if (blocked) return blocked;

  const { searchParams } = new URL(request.url);
  const markerId = searchParams.get('marker');

  // If a specific marker is requested, return single Biomarker
  if (markerId) {
    const def = BIOMARKER_DEFS.find((b) => b.id === markerId);
    if (!def) {
      return errorResponse('INVALID_MARKER', `Unknown biomarker: ${markerId}`, 400);
    }
    return successResponse(buildBiomarker(def));
  }

  // Otherwise return all 10 biomarkers as Biomarker[]
  const biomarkers: Biomarker[] = BIOMARKER_DEFS.map(buildBiomarker);
  return successResponse(biomarkers);
}
