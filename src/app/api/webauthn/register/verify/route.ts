// POST /api/webauthn/register/verify — complete passkey registration (GAP-12)
import { NextRequest } from 'next/server';
import { z, ZodError } from 'zod';
import { successResponse, errorResponse, validationError, HTTP } from '@/lib/api/responses';
import { runMiddleware, requireAuth } from '@/lib/api/middleware';
import { finishRegistration } from '@/lib/api/webauthn-service';

const Schema = z.object({ attestationObject: z.string().min(1).max(20000), clientDataJSON: z.string().min(1).max(8000) });

export async function POST(request: NextRequest) {
  const blocked = await runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;
  const auth = requireAuth(request);
  if ('status' in auth) return auth;
  try {
    const body = Schema.parse(await request.json());
    const credential = await finishRegistration(auth.walletAddress!, body);
    return successResponse({ registered: true, credential }, HTTP.CREATED);
  } catch (err) {
    if (err instanceof ZodError) return validationError(err);
    if (err instanceof Error) return errorResponse('WEBAUTHN_REGISTRATION_FAILED', err.message, HTTP.BAD_REQUEST);
    throw err;
  }
}
