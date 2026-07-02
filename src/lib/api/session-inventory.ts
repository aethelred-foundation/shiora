// ============================================================
// Shiora on Aethelred — Session inventory (GAP-08)
//
// M-03 made sessions revocable; this layer makes them VISIBLE. Every issued
// token is recorded (jti, device hints, lifetime) so the owner can list
// their active sessions and target one device for revocation.
// ============================================================

import type { NextRequest } from 'next/server';

import type { SessionClaims } from './session';
import { getClientIp } from './middleware';
import { getSessionIndexStore } from '@/lib/persistence/session-index-store';
import { getRevocationStore } from '@/lib/persistence/revocation-store';
import { isSessionRevoked } from './session-revocation';

const UA_MAX = 120;

/** Record a freshly issued session, with device hints from the login request. */
export async function recordIssuedSession(
  claims: SessionClaims,
  request: NextRequest,
): Promise<void> {
  await getSessionIndexStore().record({
    jti: claims.jti,
    subject: claims.sub,
    issuedAt: claims.iat,
    expiresAt: claims.exp,
    userAgent: request.headers.get('user-agent')?.slice(0, UA_MAX) ?? 'unknown',
    ip: getClientIp(request),
  });
}

export interface SessionView {
  jti: string;
  issuedAt: number;
  expiresAt: number;
  userAgent: string;
  ip: string;
  /** Whether this is the session making the request. */
  current: boolean;
  /** Whether the session has been revoked (individually or via sign-out-everywhere). */
  revoked: boolean;
}

/** Active (unexpired) sessions for a subject, annotated per the revocation state. */
export async function listSessionsForSubject(
  subject: string,
  currentJti: string,
  now: number = Date.now(),
): Promise<SessionView[]> {
  const sessions = await getSessionIndexStore().listForSubject(subject, now);
  const views: SessionView[] = [];
  for (const session of sessions) {
    views.push({
      jti: session.jti,
      issuedAt: session.issuedAt,
      expiresAt: session.expiresAt,
      userAgent: session.userAgent,
      ip: session.ip,
      current: session.jti === currentJti,
      revoked: await isSessionRevoked({
        sub: session.subject,
        jti: session.jti,
        iat: session.issuedAt,
        exp: session.expiresAt,
        v: 1,
      }),
    });
  }
  return views;
}

/**
 * Revoke one of the subject's own sessions by jti. Returns false when the
 * session does not exist, is expired, or belongs to someone else (indistinguishable
 * by design — no cross-subject probing).
 */
export async function revokeOwnSession(
  subject: string,
  jti: string,
  now: number = Date.now(),
): Promise<boolean> {
  const session = await getSessionIndexStore().get(jti, now);
  if (!session || session.subject !== subject) {
    return false;
  }
  await getRevocationStore().revokeToken(session.jti, session.expiresAt);
  return true;
}
