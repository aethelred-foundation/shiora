// ============================================================
// Shiora on Aethelred — Session inventory (GAP-08)
// GET /api/me/sessions — list the caller's active sessions
//
// Shows every unexpired session issued to the wallet (device hints, issue/
// expiry times, which one is current, and revocation state) so the owner can
// spot a session they don't recognize and revoke it.
// ============================================================

import { NextRequest } from 'next/server';

import { successResponse } from '@/lib/api/responses';
import { runMiddleware, requireAuth } from '@/lib/api/middleware';
import { extractSessionToken, verifySessionToken } from '@/lib/api/session';
import { listSessionsForSubject } from '@/lib/api/session-inventory';

export async function GET(request: NextRequest) {
  const blocked = await runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const auth = requireAuth(request);
  if ('status' in auth) return auth;

  const claims = verifySessionToken(extractSessionToken(request));
  const sessions = await listSessionsForSubject(
    auth.walletAddress!,
    claims?.jti ?? '',
  );

  return successResponse({ sessions, total: sessions.length });
}
