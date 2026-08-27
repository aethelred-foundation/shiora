// ============================================================
// Shiora on Aethelred — MFA Enrolment API
// POST /api/mfa/enroll — begin TOTP enrolment (returns secret + otpauth URI)
// ============================================================

import { NextRequest } from 'next/server';

import { successResponse, HTTP } from '@/lib/api/responses';
import { requireAuth, runMiddleware } from '@/lib/api/middleware';
import { requireStepUp } from '@/lib/api/step-up';
import { beginMfaEnrollment } from '@/lib/api/mfa-service';

export async function POST(request: NextRequest) {
  const blocked = await runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const auth = requireAuth(request);
  if ('status' in auth) return auth;

  // Restarting enrolment replaces the secret and disables the current factor,
  // so with MFA enabled it is itself a sensitive operation: without this gate a
  // stolen session could neutralize MFA (and every step-up-protected route) by
  // simply re-enrolling. First-time enrolment is unaffected. A patient who lost
  // their authenticator passes this gate with a recovery-code assertion from
  // POST /api/me/recovery/consume.
  const stepUp = await requireStepUp(request, auth.walletAddress!);
  if (stepUp) return stepUp;

  const enrollment = await beginMfaEnrollment(auth.walletAddress!);
  return successResponse(enrollment, HTTP.CREATED, {
    message: 'Scan the otpauth URI in an authenticator app, then confirm with a code at /api/mfa/verify.',
  });
}
