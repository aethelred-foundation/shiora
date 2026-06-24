// ============================================================
// Shiora on Aethelred — Provider Patient Directory API
// GET /api/provider/patients — patients who granted this provider access
//   (provider audience)
// ============================================================

import { NextRequest } from 'next/server';

import { successResponse } from '@/lib/api/responses';
import { runMiddleware } from '@/lib/api/middleware';
import { requireCapability } from '@/lib/api/rbac';
import { listGrantsForProvider } from '@/lib/api/access-service';

export async function GET(request: NextRequest) {
  const blocked = runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const auth = await requireCapability(request, 'view_granted_records');
  if ('status' in auth) return auth;

  const provider = auth.walletAddress!;
  const grants = await listGrantsForProvider(provider);

  const patients = grants.map((grant) => ({
    patientAddress: grant.ownerAddress,
    grantId: grant.id,
    scope: grant.scope,
    status: grant.status,
    grantedAt: grant.grantedAt,
    expiresAt: grant.expiresAt,
    permissions: { view: grant.canView, download: grant.canDownload, share: grant.canShare },
  }));

  return successResponse({ provider, patientCount: patients.length, patients });
}
