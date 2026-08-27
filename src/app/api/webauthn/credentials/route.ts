// GET /api/webauthn/credentials — list registered passkeys (GAP-12)
import { NextRequest } from 'next/server';
import { successResponse } from '@/lib/api/responses';
import { runMiddleware, requireAuth } from '@/lib/api/middleware';
import { listCredentials } from '@/lib/api/webauthn-service';

export async function GET(request: NextRequest) {
  const blocked = await runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;
  const auth = requireAuth(request);
  if ('status' in auth) return auth;
  const credentials = await listCredentials(auth.walletAddress!);
  return successResponse({ credentials, total: credentials.length });
}
