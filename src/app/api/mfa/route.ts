// ============================================================
// Shiora on Aethelred — MFA API
// GET    /api/mfa — the caller's MFA status
// DELETE /api/mfa — disable MFA (requires a current code)
// ============================================================

import { NextRequest } from 'next/server';
import { z, ZodError } from 'zod';

import { successResponse, errorResponse, validationError, HTTP } from '@/lib/api/responses';
import { requireAuth, runMiddleware } from '@/lib/api/middleware';
import { disableMfa, getMfaStatus } from '@/lib/api/mfa-service';

const CodeSchema = z.object({ code: z.string().regex(/^\d{6}$/, 'code must be 6 digits') });

export async function GET(request: NextRequest) {
  const blocked = runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const auth = requireAuth(request);
  if ('status' in auth) return auth;

  return successResponse(await getMfaStatus(auth.walletAddress!));
}

export async function DELETE(request: NextRequest) {
  const blocked = runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const auth = requireAuth(request);
  if ('status' in auth) return auth;

  try {
    const { code } = CodeSchema.parse(await request.json());
    const ok = await disableMfa(auth.walletAddress!, code);
    if (!ok) {
      return errorResponse('MFA_INVALID', 'MFA is not enabled or the code is invalid.', HTTP.BAD_REQUEST);
    }
    return successResponse({ enabled: false });
  } catch (err) {
    if (err instanceof ZodError) return validationError(err);
    throw err;
  }
}
