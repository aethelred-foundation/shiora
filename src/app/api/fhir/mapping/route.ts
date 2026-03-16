// ============================================================
// Shiora on Aethelred — FHIR Mappings API
// GET /api/fhir/mapping — Get all FHIR to Shiora type mappings
// ============================================================

import { NextRequest } from 'next/server';
import { successResponse } from '@/lib/api/responses';
import { runMiddleware } from '@/lib/api/middleware';
import { seededHex } from '@/lib/utils';
import { FHIR_RESOURCE_TYPES } from '@/lib/constants';

export async function GET(request: NextRequest) {
  const blocked = runMiddleware(request);
  if (blocked) return blocked;

  const SEED = 1100;

  const mappings = FHIR_RESOURCE_TYPES.map((rt, i) => ({
    id: `mapping-${seededHex(SEED + 300 + i * 100, 12)}`,
    fhirResourceType: rt.id,
    shioraRecordType: rt.shioraMapping,
    fieldMappings: [
      { fhirPath: `${rt.id}.id`, shioraField: 'id' },
      { fhirPath: `${rt.id}.status`, shioraField: 'status' },
      { fhirPath: `${rt.id}.meta.lastUpdated`, shioraField: 'date', transform: 'isoToEpoch' },
    ],
    isDefault: true,
  }));

  return successResponse(mappings);
}
