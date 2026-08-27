// ============================================================
// Shiora on Aethelred — Break-glass declaration (consultant P0)
// POST /api/break-glass — a verified provider declares emergency access to a
// named patient's records: declared reason + patient context, a mandatory
// fresh MFA step-up, a ≤1h read-only grant, prominent audit, and immediate
// patient notification. Every use lands in the retrospective-review queue.
// ============================================================

import { NextRequest } from 'next/server';
import { z, ZodError } from 'zod';

import { successResponse, errorResponse, validationError, HTTP } from '@/lib/api/responses';
import { AUTH_RATE_LIMIT, runMiddleware } from '@/lib/api/middleware';
import { requireRole } from '@/lib/api/rbac';
import { requireStepUp } from '@/lib/api/step-up';
import { getMfaStatus } from '@/lib/api/mfa-service';
import { declareBreakGlass, EMERGENCY_CATEGORIES } from '@/lib/api/break-glass-service';
import { AethelredAddressSchema } from '@/lib/api/validation';

const DeclarationSchema = z.object({
  patientAddress: AethelredAddressSchema,
  // A structured emergency category, not free-text alone (consultant §5).
  category: z.enum(EMERGENCY_CATEGORIES),
  // A justification a reviewer can act on, not a checkbox.
  reason: z.string().trim().min(10).max(500),
  patientContext: z.string().trim().min(3).max(300),
  // Minimum necessary: the record types this emergency actually requires.
  recordTypes: z.array(z.string().trim().min(1).max(60)).min(1).max(20),
  // Affirmative extra step to reach especially-sensitive records.
  sensitiveAcknowledged: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  // Declaring an emergency is credential-grade: auth-class budget.
  const blocked = await runMiddleware(request, { ...AUTH_RATE_LIMIT, requireAuth: true });
  if (blocked) return blocked;

  const auth = await requireRole(request, 'provider');
  if ('status' in auth) return auth;

  const requester = auth.walletAddress!;

  // Break-glass is deliberately high-friction: it always demands a fresh
  // second-factor proof. A provider without MFA cannot use it at all —
  // requireStepUp alone would wave such an account through.
  const { enabled } = await getMfaStatus(requester);
  if (!enabled) {
    return errorResponse(
      'MFA_REQUIRED',
      'Break-glass access requires an enrolled second factor. Enrol at /api/mfa/enroll, '
      + 'then retry with a fresh step-up assertion.',
      HTTP.FORBIDDEN,
    );
  }
  const stepUp = await requireStepUp(request, requester);
  if (stepUp) return stepUp;

  try {
    const declaration = DeclarationSchema.parse(await request.json());
    const grant = await declareBreakGlass(requester, {
      patient: declaration.patientAddress,
      category: declaration.category,
      reason: declaration.reason,
      patientContext: declaration.patientContext,
      recordTypes: declaration.recordTypes,
      sensitiveAcknowledged: declaration.sensitiveAcknowledged,
    });

    if (!grant) {
      return errorResponse(
        'BREAK_GLASS_SELF',
        'You cannot declare emergency access to your own records — read them directly.',
        HTTP.BAD_REQUEST,
      );
    }

    return successResponse({ grant }, HTTP.CREATED, {
      message:
        'Emergency access granted for one hour, read-only. The patient has been '
        + 'notified and this use will be retrospectively reviewed.',
    });
  } catch (err) {
    if (err instanceof ZodError) return validationError(err);
    throw err;
  }
}
