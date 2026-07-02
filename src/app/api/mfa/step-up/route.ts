// ============================================================
// Shiora on Aethelred — Mint a step-up assertion (GAP-07)
// POST /api/mfa/step-up — exchange a fresh TOTP code for a 5-minute
// assertion that authorizes sensitive operations.
// ============================================================

import { NextRequest } from 'next/server';
import { z, ZodError } from 'zod';

import { successResponse, errorResponse, validationError, HTTP } from '@/lib/api/responses';
import { AUTH_RATE_LIMIT, requireAuth, runMiddleware } from '@/lib/api/middleware';
import { verifyMfaCode } from '@/lib/api/mfa-service';
import { mintStepUpAssertion, STEP_UP_HEADER } from '@/lib/api/step-up';
import { audit } from '@/lib/api/audit';

const CodeSchema = z.object({ code: z.string().regex(/^\d{6}$/, 'code must be 6 digits') });

export async function POST(request: NextRequest) {
  // Second-factor codes are a brute-force surface: auth-class budget.
  const blocked = await runMiddleware(request, { ...AUTH_RATE_LIMIT, requireAuth: true });
  if (blocked) return blocked;

  const auth = requireAuth(request);
  if ('status' in auth) return auth;

  const address = auth.walletAddress!;

  try {
    const { code } = CodeSchema.parse(await request.json());
    const valid = await verifyMfaCode(address, code);

    audit({
      action: 'MFA_ENABLE',
      actor: address,
      success: valid,
      metadata: { scope: 'step-up', outcome: valid ? 'minted' : 'rejected' },
    });

    if (!valid) {
      return errorResponse(
        'MFA_INVALID',
        'MFA is not enabled for this account or the code is invalid.',
        HTTP.BAD_REQUEST,
      );
    }

    const { assertion, expiresAt } = mintStepUpAssertion(address);
    return successResponse({ assertion, expiresAt, header: STEP_UP_HEADER });
  } catch (err) {
    if (err instanceof ZodError) return validationError(err);
    throw err;
  }
}
