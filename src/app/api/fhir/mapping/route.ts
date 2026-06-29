// ============================================================
// Shiora on Aethelred — FHIR R4 Mapping API
// GET /api/fhir/mapping — the real resource→record-type mapping Shiora applies.
// ============================================================

import { NextRequest } from 'next/server';

import { successResponse } from '@/lib/api/responses';
import { runMiddleware } from '@/lib/api/middleware';
import { RESOURCE_MAPPING } from '@/lib/api/fhir/fhir-service';

export async function GET(request: NextRequest) {
  const blocked = await runMiddleware(request);
  if (blocked) return blocked;

  return successResponse({ mappings: RESOURCE_MAPPING });
}
