// ============================================================
// Shiora on Aethelred — Governance Data Request Decision API
// PATCH /api/governance/data-requests/[id] — approve, deny, or revoke
//   (government audience)
// ============================================================

import { NextRequest } from 'next/server';
import { z, ZodError } from 'zod';

import { successResponse, validationError, notFoundResponse } from '@/lib/api/responses';
import { runMiddleware } from '@/lib/api/middleware';
import { requireCapability } from '@/lib/api/rbac';
import { decideDataRequest, revokeDataRequest } from '@/lib/api/data-access-service';

const DecisionSchema = z.object({
  decision: z.enum(['approve', 'deny', 'revoke']),
});

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const blocked = await runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const auth = await requireCapability(request, 'review_data_requests');
  if ('status' in auth) return auth;

  const { id } = await context.params;
  const decider = auth.walletAddress!;

  try {
    const { decision } = DecisionSchema.parse(await request.json());
    const updated = decision === 'revoke'
      ? await revokeDataRequest(id, decider)
      : await decideDataRequest(id, decider, decision === 'approve' ? 'approved' : 'denied');
    if (!updated) {
      return notFoundResponse('DataAccessRequest', id);
    }
    return successResponse(updated);
  } catch (err) {
    if (err instanceof ZodError) return validationError(err);
    throw err;
  }
}
