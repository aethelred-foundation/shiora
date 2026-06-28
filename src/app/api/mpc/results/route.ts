// ============================================================
// Shiora on Aethelred — MPC Results API
// GET /api/mpc/results — the aggregate results of the caller's computations
//   (researcher audience; requires the run_secure_computation capability)
// ============================================================

import { NextRequest } from 'next/server';

import { successResponse } from '@/lib/api/responses';
import { runMiddleware } from '@/lib/api/middleware';
import { requireCapability } from '@/lib/api/rbac';
import { listSessions } from '@/lib/api/mpc-service';

export async function GET(request: NextRequest) {
  const blocked = await runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const auth = await requireCapability(request, 'run_secure_computation');
  if ('status' in auth) return auth;

  const results = (await listSessions(auth.walletAddress!))
    .map((session) => ({
      sessionId: session.id,
      name: session.name,
      protocol: session.protocol,
      result: session.result, // only the aggregate, never the inputs
      participantCount: session.participantCount,
      completedAt: session.createdAt,
    }))
    .sort((a, b) => b.completedAt - a.completedAt);

  return successResponse({ total: results.length, results });
}
