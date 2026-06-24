// ============================================================
// Shiora on Aethelred — Health Plan Care Gap Update API
// PATCH /api/health-plans/care-gaps/[id] — update the open count or close a gap
//   (health-plan audience; owner-scoped to the payer)
// ============================================================

import { NextRequest } from 'next/server';
import { z, ZodError } from 'zod';

import { successResponse, validationError, notFoundResponse } from '@/lib/api/responses';
import { runMiddleware } from '@/lib/api/middleware';
import { requireCapability } from '@/lib/api/rbac';
import { updateCareGap } from '@/lib/api/care-gap-service';

const PatchSchema = z.object({
  openCount: z.number().int().min(0).max(1_000_000).optional(),
  status: z.enum(['open', 'closed']).optional(),
  description: z.string().max(2000).optional(),
});

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const blocked = await runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const auth = await requireCapability(request, 'manage_care_gaps');
  if ('status' in auth) return auth;

  const { id } = await context.params;

  try {
    const patch = PatchSchema.parse(await request.json());
    const updated = await updateCareGap(auth.walletAddress!, id, patch);
    if (!updated) {
      return notFoundResponse('CareGap', id);
    }
    return successResponse(updated);
  } catch (err) {
    if (err instanceof ZodError) return validationError(err);
    throw err;
  }
}
