// ============================================================
// Shiora on Aethelred — Sign out of all other sessions
// POST /api/me/sessions/revoke-all
//
// "Sign out everywhere": revoke every session the caller's wallet has issued so
// far (audit M-03), then mint a fresh token so the CURRENT device stays signed
// in. Every other outstanding token — on any device, of any age — stops being
// honored on its next request.
// ============================================================

import { NextRequest } from 'next/server';

import { successResponse, HTTP } from '@/lib/api/responses';
import { runMiddleware, requireAuth } from '@/lib/api/middleware';
import { applySessionCookie, createSessionToken } from '@/lib/api/session';
import { revokeAllSessions } from '@/lib/api/session-revocation';
import { audit } from '@/lib/api/audit';

export async function POST(request: NextRequest) {
  const blocked = await runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const auth = requireAuth(request);
  if ('status' in auth) return auth;

  const address = auth.walletAddress!;
  const cutoff = Date.now();
  await revokeAllSessions(address, cutoff);

  audit({
    action: 'SESSION_DESTROY',
    actor: address,
    success: true,
    metadata: { scope: 'all-other-sessions' },
  });

  // Keep the current device signed in with a token issued at/after the cutoff.
  const { token, expiresAt } = createSessionToken(address);
  const response = successResponse(
    { address, revokedBefore: cutoff, expiresAt },
    HTTP.OK,
    { message: 'Signed out of all other sessions.' },
  );
  applySessionCookie(response, token, expiresAt);
  return response;
}
