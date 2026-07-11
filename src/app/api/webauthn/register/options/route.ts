// POST /api/webauthn/register/options — begin passkey registration (GAP-12)
import { NextRequest } from 'next/server';
import { successResponse } from '@/lib/api/responses';
import { runMiddleware, requireAuth } from '@/lib/api/middleware';
import { startRegistration } from '@/lib/api/webauthn-service';

export async function POST(request: NextRequest) {
  const blocked = await runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;
  const auth = requireAuth(request);
  if ('status' in auth) return auth;
  return successResponse(await startRegistration(auth.walletAddress!));
}
