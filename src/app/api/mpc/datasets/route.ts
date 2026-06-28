// ============================================================
// Shiora on Aethelred — MPC Protocol Catalog API
// GET /api/mpc/datasets — the supported secure-computation protocols
//   (researcher audience; requires the run_secure_computation capability)
// ============================================================

import { NextRequest } from 'next/server';

import { successResponse } from '@/lib/api/responses';
import { runMiddleware } from '@/lib/api/middleware';
import { requireCapability } from '@/lib/api/rbac';
import { MPC_PROTOCOLS } from '@/lib/api/mpc-service';

export async function GET(request: NextRequest) {
  const blocked = await runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const auth = await requireCapability(request, 'run_secure_computation');
  if ('status' in auth) return auth;

  const protocols = Object.entries(MPC_PROTOCOLS).map(([protocol, description]) => ({ protocol, description }));
  return successResponse({ protocols });
}
