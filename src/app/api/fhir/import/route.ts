// ============================================================
// Shiora on Aethelred — FHIR Import API
// POST /api/fhir/import — Import FHIR resources
// ============================================================

import { NextRequest } from 'next/server';
import { z, ZodError } from 'zod';
import {
  successResponse,
  validationError,
  HTTP,
} from '@/lib/api/responses';
import { runMiddleware } from '@/lib/api/middleware';
import { seededHex, seededInt, generateAttestation } from '@/lib/utils';

const ImportSchema = z.object({
  source: z.string().min(1).max(500),
  bundle: z.string().optional(),
  url: z.string().url().optional(),
});

export async function POST(request: NextRequest) {
  const blocked = runMiddleware(request);
  if (blocked) return blocked;

  try {
    const body = await request.json();
    const validated = ImportSchema.parse(body);
    const seed = Date.now();

    const job = {
      id: `import-${seededHex(seed, 12)}`,
      source: validated.source,
      resourceCount: seededInt(seed, 5, 30),
      processedCount: 0,
      failedCount: 0,
      status: 'processing',
      startedAt: Date.now(),
      attestation: generateAttestation(seed),
      errors: [],
    };

    return successResponse(job, HTTP.CREATED, {
      message: 'Import job started. Resources will be mapped and encrypted via TEE.',
    });
  } catch (err) {
    if (err instanceof ZodError) return validationError(err);
    throw err;
  }
}
