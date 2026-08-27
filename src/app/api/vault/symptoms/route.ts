// ============================================================
// Shiora on Aethelred — Symptoms API (real, owner-scoped PHI)
// GET  /api/vault/symptoms — list the caller's symptom logs
// POST /api/vault/symptoms — log a symptom (encrypted + audited)
// ============================================================

import { NextRequest } from 'next/server';
import { z, ZodError } from 'zod';

import { runMiddleware, requireAuth } from '@/lib/api/middleware';
import { successResponse, validationError, HTTP } from '@/lib/api/responses';
import { logSymptom, listSymptoms } from '@/lib/api/vault-service';

const SYMPTOM_CATEGORY_IDS = [
  'pain', 'mood', 'energy', 'digestive', 'skin',
  'sleep', 'discharge', 'temperature', 'other',
] as const;

const LogSymptomSchema = z.object({
  category: z.enum(SYMPTOM_CATEGORY_IDS),
  symptom: z.string().trim().min(1).max(200),
  severity: z.number().int().min(1).max(5),
  notes: z.string().max(1000).optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
  date: z.number().int().positive().optional(),
});

export async function GET(request: NextRequest) {
  const blocked = await runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const auth = requireAuth(request);
  if ('status' in auth) return auth;

  let entries = await listSymptoms(auth.walletAddress!);
  const category = request.nextUrl.searchParams.get('category');
  if (category) {
    entries = entries.filter((entry) => entry.category === category);
  }

  return successResponse({ symptoms: entries, total: entries.length });
}

export async function POST(request: NextRequest) {
  const blocked = await runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const auth = requireAuth(request);
  if ('status' in auth) return auth;

  try {
    const input = LogSymptomSchema.parse(await request.json());
    const entry = await logSymptom(auth.walletAddress!, input);
    return successResponse(entry, HTTP.CREATED);
  } catch (err) {
    if (err instanceof ZodError) return validationError(err);
    throw err;
  }
}
