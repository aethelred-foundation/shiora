// ============================================================
// Shiora on Aethelred — Single MPC Session API
// GET /api/mpc/sessions/[id] — a secure-computation session the caller owns
//   (researcher audience; requires the run_secure_computation capability)
// ============================================================

import { NextRequest } from 'next/server';

import { successResponse, notFoundResponse } from '@/lib/api/responses';
import { runMiddleware } from '@/lib/api/middleware';
import { requireCapability } from '@/lib/api/rbac';
import { getSession } from '@/lib/api/mpc-service';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const blocked = await runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const auth = await requireCapability(request, 'run_secure_computation');
  if ('status' in auth) return auth;

  const { id } = await context.params;
  const session = await getSession(auth.walletAddress!, id);
  if (!session) {
    return notFoundResponse('MpcSession', id);
  }
  return successResponse(session);
}
