// ============================================================
// Shiora on Aethelred — Wearable cohort aggregate via real MPC
// POST /api/wearables/cohort-aggregate — secure-sum a metric across a cohort
//   (researcher-gated). Reveals only the cohort total/mean, never an individual.
// ============================================================

import { NextRequest } from 'next/server';
import { z, ZodError } from 'zod';

import { successResponse, errorResponse, validationError, HTTP } from '@/lib/api/responses';
import { runMiddleware } from '@/lib/api/middleware';
import { requireCapability } from '@/lib/api/rbac';
import { cohortMetricAggregate } from '@/lib/api/wearables-service';

const CohortSchema = z.object({
  cohort: z.array(z.string().min(1).max(120)).min(2).max(10000),
  metric: z.string().min(1).max(64),
});

export async function POST(request: NextRequest) {
  const blocked = await runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const auth = await requireCapability(request, 'run_secure_computation');
  if ('status' in auth) return auth;

  try {
    const { cohort, metric } = CohortSchema.parse(await request.json());
    const result = await cohortMetricAggregate(cohort, metric);
    if (!result.ok) {
      return errorResponse(
        'INSUFFICIENT_COHORT',
        'At least 2 cohort members must have telemetry for this metric (MPC privacy floor).',
        HTTP.UNPROCESSABLE,
      );
    }
    return successResponse(result.aggregate);
  } catch (err) {
    if (err instanceof ZodError) return validationError(err);
    throw err;
  }
}
