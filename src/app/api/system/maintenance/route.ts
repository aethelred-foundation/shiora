// ============================================================
// Shiora on Aethelred — On-demand store maintenance (GAP-01)
// POST /api/system/maintenance
//
// Ops-triggered garbage collection of the durable auth stores (used nonces,
// revoked tokens, rate-limit windows), complementing the periodic in-process
// sweeper started at boot. Admin-only and audited.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';

import { successResponse } from '@/lib/api/responses';
import { runMiddleware } from '@/lib/api/middleware';
import { requireAdmin } from '@/lib/api/rbac';
import { runStoreMaintenance } from '@/lib/maintenance/store-maintenance';
import { audit } from '@/lib/api/audit';

export async function POST(request: NextRequest) {
  const blocked = await runMiddleware(request);
  if (blocked) return blocked;

  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) {
    return admin;
  }

  const report = await runStoreMaintenance();

  audit({
    action: 'SYSTEM_MAINTENANCE',
    actor: admin.walletAddress!,
    success: true,
    metadata: { ...report },
  });

  return successResponse(report);
}
