// ============================================================
// Shiora on Aethelred — MFA Enrolment API
// POST /api/mfa/enroll — begin TOTP enrolment (returns secret + otpauth URI)
// ============================================================

import { NextRequest } from 'next/server';

import { successResponse, HTTP } from '@/lib/api/responses';
import { requireAuth, runMiddleware } from '@/lib/api/middleware';
import { beginMfaEnrollment } from '@/lib/api/mfa-service';

export async function POST(request: NextRequest) {
  const blocked = await runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const auth = requireAuth(request);
  if ('status' in auth) return auth;

  const enrollment = await beginMfaEnrollment(auth.walletAddress!);
  return successResponse(enrollment, HTTP.CREATED, {
    message: 'Scan the otpauth URI in an authenticator app, then confirm with a code at /api/mfa/verify.',
  });
}
