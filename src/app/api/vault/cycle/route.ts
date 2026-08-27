// ============================================================
// Shiora on Aethelred — Cycle API (real, owner-scoped PHI)
// GET  /api/vault/cycle — the caller's cycle entries + derived insights
// POST /api/vault/cycle — log a cycle entry (encrypted + audited)
//
// Insights (average cycle length, predicted next period, current day/phase)
// are computed from the caller's own logged period starts.
// ============================================================

import { NextRequest } from 'next/server';
import { z, ZodError } from 'zod';

import { runMiddleware, requireAuth } from '@/lib/api/middleware';
import { successResponse, validationError, HTTP } from '@/lib/api/responses';
import {
  logCycleEntry,
  listCycleEntries,
  computeCycleInsights,
} from '@/lib/api/vault-service';

const FLOWS = ['none', 'light', 'medium', 'heavy'] as const;

const LogCycleSchema = z.object({
  flow: z.enum(FLOWS),
  isPeriodStart: z.boolean(),
  temperature: z.number().min(90).max(115).optional(),
  notes: z.string().max(1000).optional(),
  date: z.number().int().positive().optional(),
});

export async function GET(request: NextRequest) {
  const blocked = await runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const auth = requireAuth(request);
  if ('status' in auth) return auth;

  const entries = await listCycleEntries(auth.walletAddress!);
  const insights = computeCycleInsights(entries);

  return successResponse({ entries, total: entries.length, insights });
}

export async function POST(request: NextRequest) {
  const blocked = await runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const auth = requireAuth(request);
  if ('status' in auth) return auth;

  try {
    const input = LogCycleSchema.parse(await request.json());
    const entry = await logCycleEntry(auth.walletAddress!, input);
    return successResponse(entry, HTTP.CREATED);
  } catch (err) {
    if (err instanceof ZodError) return validationError(err);
    throw err;
  }
}
