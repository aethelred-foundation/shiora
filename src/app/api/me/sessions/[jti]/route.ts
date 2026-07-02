// ============================================================
// Shiora on Aethelred — Revoke a single session (GAP-08)
// DELETE /api/me/sessions/{jti}
//
// "Sign out that device": revokes exactly one of the caller's own sessions.
// A jti that is unknown, expired, or belongs to another wallet gets the same
// 404 — the endpoint cannot be used to probe other subjects' sessions.
// ============================================================

import { NextRequest } from 'next/server';

import { successResponse, errorResponse, HTTP } from '@/lib/api/responses';
import { runMiddleware, requireAuth } from '@/lib/api/middleware';
import { revokeOwnSession } from '@/lib/api/session-inventory';
import { audit } from '@/lib/api/audit';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ jti: string }> },
) {
  const blocked = await runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const auth = requireAuth(request);
  if ('status' in auth) return auth;

  const { jti } = await params;
  const address = auth.walletAddress!;

  const revoked = await revokeOwnSession(address, jti);
  if (!revoked) {
    return errorResponse('NOT_FOUND', 'No such session.', HTTP.NOT_FOUND);
  }

  audit({
    action: 'SESSION_DESTROY',
    actor: address,
    success: true,
    metadata: { scope: 'single-device', jti },
  });

  return successResponse({ revoked: true, jti });
}
