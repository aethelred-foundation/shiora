// ============================================================
// Shiora on Aethelred — MFA Verify API
// POST /api/mfa/verify — confirm enrolment with a code, enabling MFA
// ============================================================

import { NextRequest } from 'next/server';
import { z, ZodError } from 'zod';

import { successResponse, errorResponse, validationError, HTTP } from '@/lib/api/responses';
import { requireAuth, runMiddleware } from '@/lib/api/middleware';
import { confirmMfaEnrollment } from '@/lib/api/mfa-service';

const CodeSchema = z.object({ code: z.string().regex(/^\d{6}$/, 'code must be 6 digits') });

export async function POST(request: NextRequest) {
  const blocked = await runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const auth = requireAuth(request);
  if ('status' in auth) return auth;

  try {
    const { code } = CodeSchema.parse(await request.json());
    const ok = await confirmMfaEnrollment(auth.walletAddress!, code);
    if (!ok) {
      return errorResponse('MFA_INVALID', 'No pending enrolment or the code is invalid.', HTTP.BAD_REQUEST);
    }
    return successResponse({ enabled: true });
  } catch (err) {
    if (err instanceof ZodError) return validationError(err);
    throw err;
  }
}
