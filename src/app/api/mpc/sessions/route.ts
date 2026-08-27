// ============================================================
// Shiora on Aethelred — MPC Sessions API
// GET  /api/mpc/sessions — the caller's secure-computation sessions
// POST /api/mpc/sessions — run a REAL secure aggregation, storing only the result
//   (researcher audience; requires the run_secure_computation capability)
// ============================================================

import { NextRequest } from 'next/server';
import { z, ZodError } from 'zod';

import { successResponse, validationError, HTTP } from '@/lib/api/responses';
import { runMiddleware } from '@/lib/api/middleware';
import { requireCapability } from '@/lib/api/rbac';
import {
  runComputation, listSessions, MPC_PROTOCOLS, MAX_PARTIES, type MpcProtocol,
} from '@/lib/api/mpc-service';

const ComputeSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().max(1000).optional(),
  protocol: z.enum(Object.keys(MPC_PROTOCOLS) as [MpcProtocol, ...MpcProtocol[]]),
  threshold: z.number().int().min(1).max(MAX_PARTIES),
  contributions: z.array(z.number().int().min(0)).min(1).max(MAX_PARTIES),
}).refine((data) => data.threshold <= data.contributions.length, {
  message: 'threshold must not exceed the number of contributions',
  path: ['threshold'],
});

export async function GET(request: NextRequest) {
  const blocked = await runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const auth = await requireCapability(request, 'run_secure_computation');
  if ('status' in auth) return auth;

  const sessions = (await listSessions(auth.walletAddress!)).sort((a, b) => b.createdAt - a.createdAt);
  return successResponse({ total: sessions.length, sessions });
}

export async function POST(request: NextRequest) {
  const blocked = await runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const auth = await requireCapability(request, 'run_secure_computation');
  if ('status' in auth) return auth;

  try {
    const input = ComputeSchema.parse(await request.json());
    const session = await runComputation(auth.walletAddress!, input);
    return successResponse(session, HTTP.CREATED);
  } catch (err) {
    if (err instanceof ZodError) return validationError(err);
    throw err;
  }
}
