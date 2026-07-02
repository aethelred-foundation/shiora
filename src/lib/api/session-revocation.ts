// ============================================================
// Shiora on Aethelred — Session revocation helpers
//
// Thin policy layer over the RevocationStore that the middleware and the
// session-management routes share. A session is revoked when its specific jti
// has been revoked (logout / "this device") OR it was issued at/before the
// subject's "sign out everywhere" cutoff.
// ============================================================

import type { SessionClaims } from '@/lib/api/session';
import { getRevocationStore } from '@/lib/persistence/revocation-store';

/** Whether a verified session has been revoked server-side. */
export async function isSessionRevoked(claims: SessionClaims): Promise<boolean> {
  const store = getRevocationStore();
  if (await store.isTokenRevoked(claims.jti)) {
    return true;
  }
  // Strictly-before: a token issued at or after the cutoff survives, so a fresh
  // "keep this device signed in" token minted at the cutoff instant stays valid.
  const cutoff = await store.earliestValidIssuedAt(claims.sub);
  return claims.iat < cutoff;
}

/** Revoke this specific session (logout of the current device). */
export async function revokeSession(claims: SessionClaims): Promise<void> {
  await getRevocationStore().revokeToken(claims.jti, claims.exp);
}

/**
 * Sign out everywhere for a subject: invalidate every session issued at or
 * before `now`, so all existing tokens for the wallet stop being honored.
 */
export async function revokeAllSessions(subject: string, now: number = Date.now()): Promise<void> {
  await getRevocationStore().revokeAllForSubject(subject, now);
}
