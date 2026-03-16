// ============================================================
// Shiora on Aethelred — FHIR Export API
// POST /api/fhir/export — Export FHIR resources
// ============================================================

import { NextRequest } from 'next/server';
import { z, ZodError } from 'zod';
import {
  successResponse,
  validationError,
  HTTP,
} from '@/lib/api/responses';
import { runMiddleware } from '@/lib/api/middleware';
import { seededHex, generateAttestation } from '@/lib/utils';

const ExportSchema = z.object({
  format: z.enum(['json', 'xml']).default('json'),
  resourceTypes: z.array(z.string()).min(1),
  destination: z.string().min(1).max(200),
});

export async function POST(request: NextRequest) {
  const blocked = runMiddleware(request);
  if (blocked) return blocked;

  try {
    const body = await request.json();
    const validated = ExportSchema.parse(body);
    const seed = Date.now();

    const exportResult = {
      id: `export-${seededHex(seed, 12)}`,
      format: validated.format,
      resourceTypes: validated.resourceTypes,
      destination: validated.destination,
      exportedAt: Date.now(),
      attestation: generateAttestation(seed),
      status: 'completed',
    };

    return successResponse(exportResult, HTTP.CREATED, {
      message: `Exported ${validated.resourceTypes.length} resource types in ${validated.format.toUpperCase()} format.`,
    });
  } catch (err) {
    if (err instanceof ZodError) return validationError(err);
    throw err;
  }
}
