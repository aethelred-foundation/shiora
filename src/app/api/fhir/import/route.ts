// ============================================================
// Shiora on Aethelred — FHIR R4 Import API
// POST /api/fhir/import — ingest a FHIR Bundle into the caller's encrypted
//   record store (owner-scoped, auth-gated). Real R4 parse + map.
// ============================================================

import { NextRequest } from 'next/server';

import { successResponse, errorResponse, HTTP } from '@/lib/api/responses';
import { runMiddleware, extractAuth } from '@/lib/api/middleware';
import { importBundle, FhirParseError } from '@/lib/api/fhir/fhir-service';

export async function POST(request: NextRequest) {
  const blocked = await runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const owner = extractAuth(request).walletAddress as string;
  try {
    const body = await request.json();
    const summary = await importBundle(owner, body);
    return successResponse(summary, HTTP.CREATED);
  } catch (err) {
    if (err instanceof FhirParseError) {
      return errorResponse('FHIR_PARSE_ERROR', err.message, HTTP.UNPROCESSABLE);
    }
    throw err;
  }
}
