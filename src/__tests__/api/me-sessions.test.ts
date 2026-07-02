/** @jest-environment node */

jest.mock('@/lib/api/middleware', () => {
  const actual = jest.requireActual('@/lib/api/middleware');
  return { ...actual, runMiddleware: jest.fn((...args: unknown[]) => actual.runMiddleware(...args)) };
});

import { NextRequest, NextResponse } from 'next/server';
import { runMiddleware } from '@/lib/api/middleware';
import { GET as listSessions } from '@/app/api/me/sessions/route';
import { DELETE as revokeSession } from '@/app/api/me/sessions/[jti]/route';
import { createSessionToken, verifySessionToken } from '@/lib/api/session';
import { recordIssuedSession, listSessionsForSubject } from '@/lib/api/session-inventory';
import { isSessionRevoked } from '@/lib/api/session-revocation';
import { __resetSessionIndexStoreForTests } from '@/lib/persistence/session-index-store';
import { __resetRevocationStoreForTests } from '@/lib/persistence/revocation-store';
import { seededAddress } from '@/lib/utils';

const mockedRunMiddleware = runMiddleware as jest.MockedFunction<typeof runMiddleware>;
const BASE = 'http://localhost:3000/api/me/sessions';
const OWNER = seededAddress(4711);
const OTHER = seededAddress(4712);

afterEach(() => {
  __resetSessionIndexStoreForTests();
  __resetRevocationStoreForTests();
  mockedRunMiddleware.mockImplementation((...args: unknown[]) =>
    jest.requireActual('@/lib/api/middleware').runMiddleware(...args));
});

function authed(url: string, token: string, method = 'GET'): NextRequest {
  return new NextRequest(url, {
    method,
    headers: { authorization: `Bearer ${token}`, 'user-agent': 'DeviceA/1.0' },
  });
}

async function issueSession(address: string, ua = 'DeviceA/1.0') {
  const issued = createSessionToken(address);
  const req = new NextRequest(BASE, { headers: { 'user-agent': ua } });
  await recordIssuedSession(issued.claims, req);
  return issued;
}

describe('GET /api/me/sessions', () => {
  it('lists the caller sessions with current + revocation flags', async () => {
    const a = await issueSession(OWNER, 'DeviceA/1.0');
    await new Promise((r) => setTimeout(r, 2));
    const b = await issueSession(OWNER, 'DeviceB/2.0');
    await issueSession(OTHER, 'Stranger/9.9'); // different wallet, never shown

    const res = await listSessions(authed(BASE, a.token));
    expect(res.status).toBe(200);
    const { data } = await res.json();

    expect(data.total).toBe(2);
    const byJti = Object.fromEntries(data.sessions.map((s: { jti: string }) => [s.jti, s]));
    expect(byJti[a.claims.jti]).toMatchObject({ current: true, revoked: false, userAgent: 'DeviceA/1.0' });
    expect(byJti[b.claims.jti]).toMatchObject({ current: false, revoked: false, userAgent: 'DeviceB/2.0' });
    // Newest first.
    expect(data.sessions[0].jti).toBe(b.claims.jti);
  });

  it('requires authentication', async () => {
    const res = await listSessions(new NextRequest(BASE));
    expect(res.status).toBe(401);
  });

  it('handles header-based auth with no session token (nothing marked current)', async () => {
    // Dev wallet-header auth carries no session token, so no jti can match.
    const a = await issueSession(OWNER);
    const res = await listSessions(new NextRequest(BASE, {
      headers: { 'x-wallet-address': OWNER },
    }));
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data.sessions.find((s: { jti: string }) => s.jti === a.claims.jti).current).toBe(false);
  });

  it('records "unknown" device hints when the login request has no user-agent', async () => {
    const issued = createSessionToken(OWNER);
    await recordIssuedSession(issued.claims, new NextRequest(BASE));
    const views = await listSessionsForSubject(OWNER, issued.claims.jti);
    expect(views[0]).toMatchObject({ userAgent: 'unknown', current: true });
  });

  it('route-level requireAuth blocks if middleware passed without auth', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(null);
    const res = await listSessions(new NextRequest(BASE));
    expect(res.status).toBe(401);
  });

  it('returns the middleware block when blocked', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(NextResponse.json({ error: 'blocked' }, { status: 429 }));
    const res = await listSessions(authed(BASE, createSessionToken(OWNER).token));
    expect(res.status).toBe(429);
  });
});

describe('DELETE /api/me/sessions/{jti}', () => {
  function del(token: string, jti: string) {
    return revokeSession(
      authed(`${BASE}/${jti}`, token, 'DELETE'),
      { params: Promise.resolve({ jti }) },
    );
  }

  it('revokes one of the caller own sessions', async () => {
    const current = await issueSession(OWNER);
    const target = await issueSession(OWNER, 'OldPhone/3.0');

    const res = await del(current.token, target.claims.jti);
    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual({ revoked: true, jti: target.claims.jti });

    // The target token stops being honored; the current one survives.
    expect(await isSessionRevoked(verifySessionToken(target.token)!)).toBe(true);
    expect(await isSessionRevoked(verifySessionToken(current.token)!)).toBe(false);

    // And the inventory reflects it.
    const views = await listSessionsForSubject(OWNER, current.claims.jti);
    expect(views.find((v) => v.jti === target.claims.jti)!.revoked).toBe(true);
  });

  it('404s for an unknown jti and for another wallet session alike (no probing)', async () => {
    const mine = await issueSession(OWNER);
    const theirs = await issueSession(OTHER);

    const unknown = await del(mine.token, 'no-such-jti');
    expect(unknown.status).toBe(404);

    const foreign = await del(mine.token, theirs.claims.jti);
    expect(foreign.status).toBe(404);
    // The other wallet's session is untouched.
    expect(await isSessionRevoked(verifySessionToken(theirs.token)!)).toBe(false);
  });

  it('requires authentication', async () => {
    const res = await revokeSession(
      new NextRequest(`${BASE}/x`, { method: 'DELETE' }),
      { params: Promise.resolve({ jti: 'x' }) },
    );
    expect(res.status).toBe(401);
  });

  it('route-level requireAuth blocks if middleware passed without auth', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(null);
    const res = await revokeSession(
      new NextRequest(`${BASE}/x`, { method: 'DELETE' }),
      { params: Promise.resolve({ jti: 'x' }) },
    );
    expect(res.status).toBe(401);
  });

  it('returns the middleware block when blocked', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(NextResponse.json({ error: 'blocked' }, { status: 403 }));
    const res = await del(createSessionToken(OWNER).token, 'any');
    expect(res.status).toBe(403);
  });
});
