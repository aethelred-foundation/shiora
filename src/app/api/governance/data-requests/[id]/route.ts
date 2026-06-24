// ============================================================
// Shiora on Aethelred — Governance Data Request Decision API
// PATCH /api/governance/data-requests/[id] — approve or deny a pending request
//   (government audience)
// ============================================================

import { NextRequest } from 'next/server';
import { z, ZodError } from 'zod';

import { successResponse, validationError, notFoundResponse } from '@/lib/api/responses';
import { runMiddleware } from '@/lib/api/middleware';
import { requireCapability } from '@/lib/api/rbac';
import { decideDataRequest } from '@/lib/api/data-access-service';

const DecisionSchema = z.object({
  decision: z.enum(['approve', 'deny']),
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

  try {
    const { decision } = DecisionSchema.parse(await request.json());
    const status = decision === 'approve' ? 'approved' : 'denied';
    const updated = await decideDataRequest(id, auth.walletAddress!, status);
    if (!updated) {
      return notFoundResponse('DataAccessRequest', id);
    }
    return successResponse(updated);
  } catch (err) {
    if (err instanceof ZodError) return validationError(err);
    throw err;
  }
}
