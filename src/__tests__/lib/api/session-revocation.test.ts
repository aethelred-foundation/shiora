/** @jest-environment node */

import {
  isSessionRevoked,
  revokeSession,
  revokeAllSessions,
} from '@/lib/api/session-revocation';
import { __resetRevocationStoreForTests } from '@/lib/persistence/revocation-store';
import type { SessionClaims } from '@/lib/api/session';

afterEach(() => __resetRevocationStoreForTests());

function claims(over: Partial<SessionClaims> = {}): SessionClaims {
  return { sub: 'aeth1subject', jti: 'jti-abc', iat: 1_000, exp: Date.now() + 60_000, v: 1, ...over };
}

describe('session revocation policy', () => {
  it('reports a fresh session as not revoked', async () => {
    __resetRevocationStoreForTests();
    expect(await isSessionRevoked(claims())).toBe(false);
  });

  it('revokes a specific token by jti (logout / this device)', async () => {
    __resetRevocationStoreForTests();
    const c = claims({ jti: 'to-revoke' });
    expect(await isSessionRevoked(c)).toBe(false);
    await revokeSession(c);
    expect(await isSessionRevoked(c)).toBe(true);
    // A different token for the same subject is unaffected.
    expect(await isSessionRevoked(claims({ jti: 'other' }))).toBe(false);
  });

  it('sign-out-everywhere revokes tokens issued strictly before the cutoff', async () => {
    __resetRevocationStoreForTests();
    const cutoff = 10_000;
    await revokeAllSessions('aeth1subject', cutoff);
    // Older token → revoked; a token issued at the cutoff instant → survives.
    expect(await isSessionRevoked(claims({ iat: cutoff - 1 }))).toBe(true);
    expect(await isSessionRevoked(claims({ iat: cutoff }))).toBe(false);
    expect(await isSessionRevoked(claims({ iat: cutoff + 1 }))).toBe(false);
    // A different subject is unaffected.
    expect(await isSessionRevoked(claims({ sub: 'aeth1other', iat: cutoff - 1 }))).toBe(false);
  });

  it('revokeAllSessions defaults the cutoff to now', async () => {
    __resetRevocationStoreForTests();
    await revokeAllSessions('aeth1subject');
    // A token issued a minute ago is now revoked.
    expect(await isSessionRevoked(claims({ iat: Date.now() - 60_000 }))).toBe(true);
  });
});
