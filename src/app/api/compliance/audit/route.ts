// ============================================================
// Shiora on Aethelred — Compliance Audit Controls API
// GET /api/compliance/audit — the audit/integrity control results, derived from
//   the tamper-evident audit chain's own verification. Gated by view_compliance.
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
  const auditControls = report.checks.filter((c) => c.id === 'audit_controls' || c.id === 'integrity');
  return successResponse({ generatedAt: report.generatedAt, auditControls });
}
