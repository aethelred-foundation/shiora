// ============================================================
// Shiora on Aethelred — FHIR Resources API
// GET /api/fhir — List FHIR resources
// ============================================================

import { NextRequest } from 'next/server';
import { successResponse } from '@/lib/api/responses';
import { runMiddleware } from '@/lib/api/middleware';
import { seededHex, seededInt, seededPick, seededRandom } from '@/lib/utils';
import { FHIR_RESOURCE_TYPES } from '@/lib/constants';

export async function GET(request: NextRequest) {
  const blocked = runMiddleware(request);
  if (blocked) return blocked;

  const SEED = 1100;
  const types = FHIR_RESOURCE_TYPES.map((t) => t.id);
  const statuses = ['active', 'final', 'completed', 'entered-in-error'];

  const resources = Array.from({ length: 12 }, (_, i) => {
    const resourceType = types[i % types.length];
    return {
      id: `fhir-${seededHex(SEED + i * 100, 12)}`,
      resourceType,
      status: seededPick(SEED + i * 3, statuses),
      lastUpdated: Date.now() - seededInt(SEED + i * 5, 1, 90) * 86400000,
      rawJson: `{"resourceType":"${resourceType}","id":"${seededHex(SEED + i * 7, 8)}"}`,
      mappedRecordId: seededRandom(SEED + i * 9) > 0.3 ? `rec-${seededHex(SEED + i * 11, 12)}` : null,
    };
  });

  return successResponse(resources);
}
