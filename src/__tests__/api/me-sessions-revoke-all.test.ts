/** @jest-environment node */

jest.mock('@/lib/api/middleware', () => {
  const actual = jest.requireActual('@/lib/api/middleware');
  return { ...actual, runMiddleware: jest.fn((...args: unknown[]) => actual.runMiddleware(...args)) };
});

import { NextRequest, NextResponse } from 'next/server';
import { runMiddleware } from '@/lib/api/middleware';
import { POST as revokeAll } from '@/app/api/me/sessions/revoke-all/route';
import { createSessionToken, verifySessionToken } from '@/lib/api/session';
import { isSessionRevoked } from '@/lib/api/session-revocation';
import { __resetRevocationStoreForTests } from '@/lib/persistence/revocation-store';
import { seededAddress } from '@/lib/utils';

const mockedRunMiddleware = runMiddleware as jest.MockedFunction<typeof runMiddleware>;
const ADDR = seededAddress(31415);
const URL = 'http://localhost:3000/api/me/sessions/revoke-all';

function authed(token: string): NextRequest {
  return new NextRequest(URL, { method: 'POST', headers: { authorization: `Bearer ${token}` } });
}

afterEach(() => {
  __resetRevocationStoreForTests();
  mockedRunMiddleware.mockImplementation((...args: unknown[]) =>
    jest.requireActual('@/lib/api/middleware').runMiddleware(...args));
});

describe('POST /api/me/sessions/revoke-all', () => {
  it('revokes all prior sessions but keeps the current device signed in', async () => {
    __resetRevocationStoreForTests();
    const old = createSessionToken(ADDR);
    await new Promise((r) => setTimeout(r, 2)); // ensure a later cutoff than `old`

    const res = await revokeAll(authed(old.token));
    expect(res.status).toBe(200);

    // The presenting (old) token is now revoked...
    expect(await isSessionRevoked(verifySessionToken(old.token)!)).toBe(true);

    // ...but a fresh session cookie was issued and it is NOT revoked.
    const setCookie = res.headers.get('set-cookie');
    expect(setCookie).toContain('shiora_session');
    const raw = /shiora_session=([^;]+)/.exec(setCookie!)?.[1];
    const newClaims = verifySessionToken(decodeURIComponent(raw!));
    expect(newClaims).not.toBeNull();
    expect(newClaims!.sub).toBe(ADDR);
    expect(await isSessionRevoked(newClaims!)).toBe(false);
  });

  it('requires authentication', async () => {
    const res = await revokeAll(new NextRequest(URL, { method: 'POST' }));
    expect(res.status).toBe(401);
  });

  it('returns the middleware block when blocked', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(NextResponse.json({ error: 'blocked' }, { status: 429 }));
    const res = await revokeAll(authed(createSessionToken(ADDR).token));
    expect(res.status).toBe(429);
  });

  it('route-level requireAuth still blocks if middleware passed without auth (defense in depth)', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(null);
    const res = await revokeAll(new NextRequest(URL, { method: 'POST' }));
    expect(res.status).toBe(401);
  });
});
