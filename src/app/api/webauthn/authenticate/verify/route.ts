// POST /api/webauthn/authenticate/verify — verify a passkey assertion (GAP-12)
import { NextRequest } from 'next/server';
import { z, ZodError } from 'zod';
import { successResponse, errorResponse, validationError, HTTP } from '@/lib/api/responses';
import { runMiddleware, requireAuth } from '@/lib/api/middleware';
import { finishAuthentication } from '@/lib/api/webauthn-service';

const Schema = z.object({
  credentialId: z.string().min(1).max(400),
  authenticatorData: z.string().min(1).max(8000),
  clientDataJSON: z.string().min(1).max(8000),
  signature: z.string().min(1).max(2000),
});

export async function POST(request: NextRequest) {
  const blocked = await runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;
  const auth = requireAuth(request);
  if ('status' in auth) return auth;
  try {
    const body = Schema.parse(await request.json());
    const result = await finishAuthentication(auth.walletAddress!, body);
    return successResponse(result);
  } catch (err) {
    if (err instanceof ZodError) return validationError(err);
    if (err instanceof Error) return errorResponse('WEBAUTHN_ASSERTION_FAILED', err.message, HTTP.BAD_REQUEST);
    throw err;
  }
}
