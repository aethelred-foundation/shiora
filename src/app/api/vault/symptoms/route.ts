// ============================================================
// Shiora on Aethelred — Symptoms API
// GET  /api/vault/symptoms — List symptom logs
// POST /api/vault/symptoms — Log a new symptom
// ============================================================

import { NextRequest } from 'next/server';
import { z, ZodError } from 'zod';
import { runMiddleware } from '@/lib/api/middleware';
import { successResponse, validationError, HTTP } from '@/lib/api/responses';
import { seededInt, seededHex, seededPick, seededRandom } from '@/lib/utils';
import type { SymptomCategory, SymptomSeverity } from '@/types';

const SEED = 700;

const SYMPTOM_CATEGORY_IDS = [
  'pain',
  'mood',
  'energy',
  'digestive',
  'skin',
  'sleep',
  'discharge',
  'temperature',
  'other',
] as const;

const SYMPTOM_NAMES: Record<string, string[]> = {
  pain: ['Cramps', 'Headache', 'Lower back pain', 'Breast tenderness', 'Pelvic pain'],
  mood: ['Anxiety', 'Irritability', 'Mood swings', 'Sadness', 'Emotional sensitivity'],
  energy: ['Fatigue', 'Low energy', 'Exhaustion', 'Difficulty concentrating', 'Brain fog'],
  digestive: ['Bloating', 'Nausea', 'Appetite changes', 'Constipation', 'Gas'],
  skin: ['Acne breakout', 'Dry skin', 'Oily skin', 'Rash', 'Sensitivity'],
  sleep: ['Insomnia', 'Night sweats', 'Restless sleep', 'Oversleeping', 'Vivid dreams'],
  discharge: ['Clear', 'White', 'Yellow', 'Brown', 'Spotting'],
  temperature: ['Hot flashes', 'Chills', 'Fever', 'Night sweats', 'Cold sensitivity'],
  other: ['Dizziness', 'Leg cramps', 'Hair loss', 'Weight changes', 'Swelling'],
};

function generateMockSymptoms() {
  const categories: SymptomCategory[] = [
    'pain',
    'mood',
    'energy',
    'digestive',
    'skin',
    'sleep',
    'discharge',
    'temperature',
    'other',
  ];

  return Array.from({ length: 60 }, (_, i) => {
    const category = seededPick(SEED + i * 73, categories);
    const names = SYMPTOM_NAMES[category] /* istanbul ignore next */ ?? ['Unknown'];
    return {
      id: `sym-${seededHex(SEED + i * 300, 12)}`,
      date: Date.now() - seededInt(SEED + i * 77, 0, 60) * 86400000,
      category,
      symptom: seededPick(SEED + i * 79, names),
      severity: seededInt(SEED + i * 81, 1, 5),
      notes: seededPick(SEED + i * 83, [
        '',
        '',
        '',
        'Took ibuprofen',
        'After exercise',
        'Morning onset',
      ]),
      tags: [seededPick(SEED + i * 85, ['tracked', 'recurring', 'new', 'improving', 'worsening'])],
    };
  });
}

// ────────────────────────────────────────────────────────────
// GET /api/vault/symptoms
// ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const blocked = runMiddleware(request);
  if (blocked) return blocked;

  const symptoms = generateMockSymptoms();

  // Optional category filter
  const categoryParam = request.nextUrl.searchParams.get('category');
  const filtered = categoryParam ? symptoms.filter((s) => s.category === categoryParam) : symptoms;

  return successResponse({
    symptoms: filtered,
    total: filtered.length,
  });
}

// ────────────────────────────────────────────────────────────
// POST /api/vault/symptoms
// ────────────────────────────────────────────────────────────

const LogSymptomSchema = z.object({
  category: z.enum(SYMPTOM_CATEGORY_IDS),
  symptom: z.string().min(1).max(200),
  severity: z.number().int().min(1).max(5),
  notes: z.string().max(1000).optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
});

export async function POST(request: NextRequest) {
  const blocked = runMiddleware(request);
  if (blocked) return blocked;

  try {
    const body = await request.json();
    const validated = LogSymptomSchema.parse(body);

    const seed = Date.now();
    const newSymptom = {
      id: `sym-${seededHex(seed, 12)}`,
      date: Date.now(),
      category: validated.category,
      symptom: validated.symptom,
      severity: validated.severity,
      notes: validated.notes ?? '',
      tags: validated.tags ?? [],
    };

    return successResponse(newSymptom, HTTP.CREATED, {
      message: 'Symptom logged successfully.',
    });
  } catch (err) {
    if (err instanceof ZodError) return validationError(err);
    throw err;
  }
}
