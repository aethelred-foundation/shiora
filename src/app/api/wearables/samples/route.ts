// ============================================================
// Shiora on Aethelred — Wearable telemetry samples
// GET  /api/wearables/samples?metric= — the caller's samples (newest first)
// POST /api/wearables/samples — ingest a batch (encrypted, owner-scoped, audited)
// ============================================================

import { NextRequest } from 'next/server';
import { z, ZodError } from 'zod';

import { successResponse, validationError, HTTP } from '@/lib/api/responses';
import { runMiddleware, extractAuth } from '@/lib/api/middleware';
import { ingestSamples, listSamples } from '@/lib/api/wearables-service';

const SampleSchema = z.object({
  metric: z.string().min(1).max(64),
  value: z.number(),
  unit: z.string().max(32).default(''),
  recordedAt: z.number().int().nonnegative(),
  source: z.string().max(64).default('manual'),
});

const IngestSchema = z.object({ samples: z.array(SampleSchema).min(1).max(1000) });

export async function GET(request: NextRequest) {
  const blocked = await runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const owner = extractAuth(request).walletAddress as string;
  const metric = request.nextUrl.searchParams.get('metric') ?? undefined;
  return successResponse(await listSamples(owner, metric));
}

export async function POST(request: NextRequest) {
  const blocked = await runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const owner = extractAuth(request).walletAddress as string;
  try {
    const { samples } = IngestSchema.parse(await request.json());
    const ingested = await ingestSamples(owner, samples);
    return successResponse({ ingested }, HTTP.CREATED);
  } catch (err) {
    if (err instanceof ZodError) return validationError(err);
    throw err;
  }
}
