// ============================================================
// Shiora on Aethelred — Health Plan Care Gaps API
// GET  /api/health-plans/care-gaps — the payer's care gaps (optional ?status=)
// POST /api/health-plans/care-gaps — open a new care gap
//   (health-plan audience)
// ============================================================

import { NextRequest } from 'next/server';
import { z, ZodError } from 'zod';

import { successResponse, validationError, HTTP } from '@/lib/api/responses';
import { runMiddleware } from '@/lib/api/middleware';
import { requireCapability } from '@/lib/api/rbac';
import { createCareGap, listCareGaps } from '@/lib/api/care-gap-service';

const CareGapSchema = z.object({
  measure: z.string().trim().min(1).max(200),
  cohort: z.string().trim().min(1).max(200),
  description: z.string().max(2000).optional(),
  openCount: z.number().int().min(0).max(1_000_000),
});

export async function GET(request: NextRequest) {
  const blocked = await runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const auth = await requireCapability(request, 'manage_care_gaps');
  if ('status' in auth) return auth;

  let gaps = await listCareGaps(auth.walletAddress!);
  const status = request.nextUrl.searchParams.get('status');
  if (status) {
    gaps = gaps.filter((gap) => gap.status === status);
  }

  return successResponse({ total: gaps.length, careGaps: gaps });
}

export async function POST(request: NextRequest) {
  const blocked = await runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const auth = await requireCapability(request, 'manage_care_gaps');
  if ('status' in auth) return auth;

  try {
    const input = CareGapSchema.parse(await request.json());
    const gap = await createCareGap(auth.walletAddress!, input);
    return successResponse(gap, HTTP.CREATED);
  } catch (err) {
    if (err instanceof ZodError) return validationError(err);
    throw err;
  }
}
