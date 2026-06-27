// ============================================================
// Shiora on Aethelred — Provider Granted-Records API
// GET /api/provider/patients/[address]/records
//   The records a patient has shared with the calling provider via an active
//   access grant. (provider audience; requires the view_granted_records
//   capability AND an active, unexpired grant from the patient.)
//
// This is the read surface for the long-declared `view_granted_records`
// capability: providers see exactly the records patients consented to share,
// and every access is written to the tamper-evident audit chain.
// ============================================================

import { NextRequest } from 'next/server';

import { successResponse, errorResponse, HTTP } from '@/lib/api/responses';
import { runMiddleware } from '@/lib/api/middleware';
import { requireCapability } from '@/lib/api/rbac';
import { AethelredAddressSchema } from '@/lib/api/validation';
import { listRecordsForProvider } from '@/lib/api/records-service';

interface RouteContext {
  params: Promise<{ address: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const blocked = await runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const auth = await requireCapability(request, 'view_granted_records');
  if ('status' in auth) return auth;

  const { address } = await context.params;
  if (!AethelredAddressSchema.safeParse(address).success) {
    return errorResponse('VALIDATION_ERROR', 'Invalid patient address.', HTTP.BAD_REQUEST);
  }

  const records = await listRecordsForProvider(auth.walletAddress!, address);
  if (records === null) {
    return errorResponse('NO_ACCESS', 'No active access grant from this patient.', HTTP.FORBIDDEN);
  }

  return successResponse({ patientAddress: address, total: records.length, records });
}
