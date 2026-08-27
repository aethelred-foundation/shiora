// ============================================================
// Shiora on Aethelred — Break-glass retrospective verdict (consultant P0)
// POST /api/break-glass/{id}/review — record the administrative verdict on a
// break-glass use. Single verdict per use; reviewing closes the grant.
// ============================================================

import { NextRequest } from 'next/server';
import { z, ZodError } from 'zod';

import { successResponse, errorResponse, notFoundResponse, validationError, HTTP } from '@/lib/api/responses';
import { runMiddleware } from '@/lib/api/middleware';
import { requireAdmin } from '@/lib/api/rbac';
import { reviewBreakGlassUse } from '@/lib/api/break-glass-service';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const VerdictSchema = z.object({
  outcome: z.enum(['justified', 'unjustified']),
  notes: z.string().trim().max(1000).default(''),
});

export async function POST(request: NextRequest, context: RouteContext) {
  const blocked = await runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const auth = await requireAdmin(request);
  if ('status' in auth) return auth;

  const { id } = await context.params;

  try {
    const { outcome, notes } = VerdictSchema.parse(await request.json());
    const result = await reviewBreakGlassUse(auth.walletAddress!, id, outcome, notes);

    if (result === 'not_found') {
      return notFoundResponse('Break-glass grant', id);
    }
    if (result === 'already_reviewed') {
      return errorResponse(
        'ALREADY_REVIEWED',
        'This break-glass use has already received its verdict.',
        HTTP.CONFLICT,
      );
    }

    return successResponse({ grant: result });
  } catch (err) {
    if (err instanceof ZodError) return validationError(err);
    throw err;
  }
}
