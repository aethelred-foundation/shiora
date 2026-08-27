// ============================================================
// Shiora on Aethelred — FHIR R4 capability summary
// GET /api/fhir — the FHIR version + supported resources + endpoints.
// ============================================================

import { NextRequest } from 'next/server';

import { successResponse } from '@/lib/api/responses';
import { runMiddleware } from '@/lib/api/middleware';
import { RESOURCE_MAPPING } from '@/lib/api/fhir/fhir-service';

export async function GET(request: NextRequest) {
  const blocked = await runMiddleware(request);
  if (blocked) return blocked;

  return successResponse({
    fhirVersion: '4.0.1',
    supportedResources: RESOURCE_MAPPING.map((m) => m.resourceType),
    endpoints: {
      import: 'POST /api/fhir/import',
      export: 'GET /api/fhir/export',
      mapping: 'GET /api/fhir/mapping',
    },
  });
}
