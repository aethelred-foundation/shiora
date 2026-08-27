/** @jest-environment node */

jest.mock('@/lib/api/middleware', () => {
  const actual = jest.requireActual('@/lib/api/middleware');
  return { ...actual, runMiddleware: jest.fn((...args: unknown[]) => actual.runMiddleware(...args)) };
});

import { NextRequest, NextResponse } from 'next/server';
import { runMiddleware } from '@/lib/api/middleware';
import { GET as getStatus, DELETE as disable } from '@/app/api/mfa/route';
import { POST as enroll } from '@/app/api/mfa/enroll/route';
import { POST as verify } from '@/app/api/mfa/verify/route';
import { __resetMfaForTests } from '@/lib/api/mfa-service';
import { totpCode } from '@/lib/api/totp';
import { createSessionToken } from '@/lib/api/session';
import { seededAddress } from '@/lib/utils';

const mockedRunMiddleware = runMiddleware as jest.MockedFunction<typeof runMiddleware>;
const token = createSessionToken(seededAddress(910)).token;

beforeEach(() => {
  __resetMfaForTests();
});

afterEach(() => {
  mockedRunMiddleware.mockImplementation((...args: unknown[]) => {
    const actual = jest.requireActual('@/lib/api/middleware');
    return actual.runMiddleware(...args);
  });
});

function authed(url: string, init: RequestInit, authToken?: string): NextRequest {
  const headers: Record<string, string> = { ...(init.headers as Record<string, string>) };
  if (authToken) headers.authorization = `Bearer ${authToken}`;
  return new NextRequest(url, { ...init, headers });
}

const ENROLL = 'http://localhost:3001/api/mfa/enroll';
const VERIFY = 'http://localhost:3001/api/mfa/verify';
const MFA = 'http://localhost:3001/api/mfa';

function body(obj: unknown): RequestInit {
  return { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: typeof obj === 'string' ? obj : JSON.stringify(obj) };
}

async function enrolAndGetSecret(): Promise<string> {
  const res = await enroll(authed(ENROLL, { method: 'POST' }, token));
  return (await res.json()).data.secret;
}

describe('MFA routes — guards', () => {
  it('enroll returns the middleware error when blocked', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(NextResponse.json({ error: 'blocked' }, { status: 403 }));
    expect((await enroll(authed(ENROLL, { method: 'POST' }, token))).status).toBe(403);
  });

  it('enroll returns 401 when unauthenticated', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(null);
    expect((await enroll(new NextRequest(ENROLL, { method: 'POST' }))).status).toBe(401);
  });

  it('status returns the middleware error when blocked', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(NextResponse.json({ error: 'blocked' }, { status: 403 }));
    expect((await getStatus(authed(MFA, { method: 'GET' }, token))).status).toBe(403);
  });

  it('status returns 401 when unauthenticated', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(null);
    expect((await getStatus(new NextRequest(MFA))).status).toBe(401);
  });

  it('verify returns the middleware error when blocked', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(NextResponse.json({ error: 'blocked' }, { status: 403 }));
    expect((await verify(authed(VERIFY, body({ code: '123456' }), token))).status).toBe(403);
  });

  it('verify returns 401 when unauthenticated', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(null);
    expect((await verify(new NextRequest(VERIFY, body({ code: '123456' })))).status).toBe(401);
  });

  it('disable returns the middleware error when blocked', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(NextResponse.json({ error: 'blocked' }, { status: 403 }));
    expect((await disable(authed(MFA, { ...body({ code: '123456' }), method: 'DELETE' }, token))).status).toBe(403);
  });

  it('disable returns 401 when unauthenticated', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(null);
    expect((await disable(new NextRequest(MFA, { ...body({ code: '123456' }), method: 'DELETE' }))).status).toBe(401);
  });
});

describe('MFA routes — lifecycle', () => {
  it('enrols, returns status, verifies, and disables', async () => {
    // Fresh status
    const status0 = await (await getStatus(authed(MFA, { method: 'GET' }, token))).json();
    expect(status0.data).toEqual({ enrolled: false, enabled: false });

    // Enrol
    const enrollRes = await enroll(authed(ENROLL, { method: 'POST' }, token));
    expect(enrollRes.status).toBe(201);
    const secret = (await enrollRes.json()).data.secret;
    expect(typeof secret).toBe('string');

    // Verify with the wrong code → 400
    const real = totpCode(secret);
    const wrong = real === '000000' ? '111111' : '000000';
    expect((await verify(authed(VERIFY, body({ code: wrong }), token))).status).toBe(400);

    // Verify with a malformed code → 422
    expect((await verify(authed(VERIFY, body({ code: 'abc' }), token))).status).toBe(422);

    // Verify with the correct code → enabled
    const verifyRes = await verify(authed(VERIFY, body({ code: totpCode(secret) }), token));
    expect(verifyRes.status).toBe(200);
    expect((await verifyRes.json()).data.enabled).toBe(true);

    // Disable with a malformed code → 422
    expect((await disable(authed(MFA, { ...body({ code: 'xx' }), method: 'DELETE' }, token))).status).toBe(422);

    // Disable with the correct code → 200
    const disableRes = await disable(authed(MFA, { ...body({ code: totpCode(secret) }), method: 'DELETE' }, token));
    expect(disableRes.status).toBe(200);
    expect((await disableRes.json()).data.enabled).toBe(false);

    // Disable again (now not enabled) → 400
    expect((await disable(authed(MFA, { ...body({ code: totpCode(secret) }), method: 'DELETE' }, token))).status).toBe(400);
  });

  it('re-enrolment with MFA enabled demands a fresh step-up assertion', async () => {
    // Without this gate a stolen session could silently neutralize MFA by
    // restarting enrolment (which replaces the secret and disables the factor).
    const secret = await enrolAndGetSecret();
    await verify(authed(VERIFY, body({ code: totpCode(secret) }), token));

    const denied = await enroll(authed(ENROLL, { method: 'POST' }, token));
    expect(denied.status).toBe(403);
    expect((await denied.json()).error.code).toBe('STEP_UP_REQUIRED');

    const { mintStepUpAssertion, STEP_UP_HEADER } = jest.requireActual('@/lib/api/step-up');
    const { assertion } = mintStepUpAssertion(seededAddress(910));
    const allowed = await enroll(
      authed(ENROLL, { method: 'POST', headers: { [STEP_UP_HEADER]: assertion } }, token),
    );
    expect(allowed.status).toBe(201);
  });

  it('verify throws on an invalid JSON body (non-Zod error)', async () => {
    await enrolAndGetSecret();
    await expect(verify(authed(VERIFY, body('not-json'), token))).rejects.toThrow();
  });

  it('disable throws on an invalid JSON body (non-Zod error)', async () => {
    await expect(
      disable(authed(MFA, { ...body('not-json'), method: 'DELETE' }, token)),
    ).rejects.toThrow();
  });
});
