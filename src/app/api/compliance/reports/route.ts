// ============================================================
// Shiora on Aethelred — Compliance Reports API
// GET /api/compliance/reports — the full live compliance report.
//   Gated by view_compliance.
// ============================================================

import { NextRequest } from 'next/server';

import { successResponse } from '@/lib/api/responses';
import { runMiddleware } from '@/lib/api/middleware';
import { requireCapability } from '@/lib/api/rbac';
import { generateComplianceReport } from '@/lib/api/compliance-service';

export async function GET(request: NextRequest) {
  const blocked = await runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const auth = await requireCapability(request, 'view_compliance');
  if ('status' in auth) return auth;

  return successResponse(await generateComplianceReport());
}
