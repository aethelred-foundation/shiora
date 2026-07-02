// ============================================================
// Shiora on Aethelred — KEK re-seal trigger (GAP-14)
// POST /api/system/kek-reseal
//
// Admin-only. Re-seals every stored envelope still under a superseded KEK
// version so a rotated-out key can be retired. Idempotent: re-running once the
// corpus is current re-seals nothing. Returns the run report and is audited.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';

import { successResponse } from '@/lib/api/responses';
import { runMiddleware } from '@/lib/api/middleware';
import { requireAdmin } from '@/lib/api/rbac';
import { runDurableKekReseal } from '@/lib/maintenance/kek-reseal';
import { audit } from '@/lib/api/audit';

export async function POST(request: NextRequest) {
  const blocked = await runMiddleware(request);
  if (blocked) return blocked;

  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) {
    return admin;
  }

  const report = await runDurableKekReseal();

  audit({
    action: 'SYSTEM_MAINTENANCE',
    actor: admin.walletAddress!,
    success: true,
    metadata: { operation: 'kek-reseal', ...report },
  });

  return successResponse(report);
}
