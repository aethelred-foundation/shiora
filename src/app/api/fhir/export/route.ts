// ============================================================
// Shiora on Aethelred — FHIR R4 Export API
// GET /api/fhir/export — emit the caller's records as a FHIR R4 Bundle
//   (owner-scoped, auth-gated).
// ============================================================

import { NextRequest } from 'next/server';

import { successResponse } from '@/lib/api/responses';
import { runMiddleware, extractAuth } from '@/lib/api/middleware';
import { exportRecordsAsBundle } from '@/lib/api/fhir/fhir-service';

export async function GET(request: NextRequest) {
  const blocked = await runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const owner = extractAuth(request).walletAddress as string;
  const bundle = await exportRecordsAsBundle(owner);
  return successResponse(bundle);
}
