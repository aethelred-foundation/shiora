// ============================================================
// Shiora on Aethelred — Compliance posture overview
// GET /api/compliance — live control posture (HIPAA/SOC2) from system state.
//   Gated by view_compliance (governments / payers / employers).
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

  const report = await generateComplianceReport();
  return successResponse({
    generatedAt: report.generatedAt,
    environment: report.environment,
    posture: report.posture,
    frameworks: report.frameworks,
    maturity: report.maturity,
  });
}
