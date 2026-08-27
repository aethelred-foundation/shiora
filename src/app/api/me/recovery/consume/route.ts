// ============================================================
// Shiora on Aethelred — Recovery-code consumption (consultant P0)
// POST /api/me/recovery/consume — exchange one unused recovery code for a
// short-lived step-up assertion. This is the lockout escape hatch: a patient
// who lost their authenticator presents a recovery code as the second factor,
// then uses the assertion to pass step-up gates (e.g. re-enrolling MFA).
// ============================================================

import { NextRequest } from 'next/server';
import { z, ZodError } from 'zod';

import { successResponse, errorResponse, validationError, HTTP } from '@/lib/api/responses';
import { AUTH_RATE_LIMIT, requireAuth, runMiddleware } from '@/lib/api/middleware';
import { consumeRecoveryCode } from '@/lib/api/recovery-service';
import { mintStepUpAssertion, STEP_UP_HEADER } from '@/lib/api/step-up';
import { audit } from '@/lib/api/audit';

const ConsumeSchema = z.object({
  // Format-tolerant (the service normalizes case and separators); the length
  // cap bounds the scrypt work an attacker can request per attempt.
  code: z.string().min(1).max(64),
});

export async function POST(request: NextRequest) {
  // Recovery codes are a brute-force surface: auth-class budget.
  const blocked = await runMiddleware(request, { ...AUTH_RATE_LIMIT, requireAuth: true });
  if (blocked) return blocked;

  const auth = requireAuth(request);
  if ('status' in auth) return auth;

  const address = auth.walletAddress!;

  try {
    const { code } = ConsumeSchema.parse(await request.json());
    const result = await consumeRecoveryCode(address, code);

    audit({
      action: 'RECOVERY_CODE_CONSUME',
      actor: address,
      subject: address,
      resource: 'recovery-codes',
      success: result.consumed,
      metadata: { outcome: result.consumed ? 'consumed' : 'rejected' },
    });

    if (!result.consumed) {
      // One opaque failure for every cause (unknown, spent, no batch) so the
      // endpoint cannot be used to probe an account's recovery state.
      return errorResponse(
        'RECOVERY_INVALID',
        'The recovery code is invalid or has already been used.',
        HTTP.BAD_REQUEST,
      );
    }

    const { assertion, expiresAt } = mintStepUpAssertion(address);
    return successResponse({
      assertion,
      expiresAt,
      header: STEP_UP_HEADER,
      remaining: result.remaining,
    });
  } catch (err) {
    if (err instanceof ZodError) return validationError(err);
    throw err;
  }
}
