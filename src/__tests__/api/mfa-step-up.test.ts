/** @jest-environment node */

jest.mock('@/lib/api/middleware', () => {
  const actual = jest.requireActual('@/lib/api/middleware');
  return { ...actual, runMiddleware: jest.fn((...args: unknown[]) => actual.runMiddleware(...args)) };
});

import { NextRequest, NextResponse } from 'next/server';
import { runMiddleware, AUTH_RATE_LIMIT } from '@/lib/api/middleware';
import { POST as stepUp } from '@/app/api/mfa/step-up/route';
import { createSessionToken } from '@/lib/api/session';
import { verifyStepUpAssertion, STEP_UP_HEADER } from '@/lib/api/step-up';
import {
  beginMfaEnrollment,
  confirmMfaEnrollment,
  __resetMfaForTests,
} from '@/lib/api/mfa-service';
import { totpCode } from '@/lib/api/totp';
import { __resetRateLimiterForTests } from '@/lib/api/rate-limiter';
import { seededAddress } from '@/lib/utils';

const mockedRunMiddleware = runMiddleware as jest.MockedFunction<typeof runMiddleware>;
const URL = 'http://localhost:3000/api/mfa/step-up';
const ADDR = seededAddress(3001);
const TOKEN = createSessionToken(ADDR).token;

afterEach(() => {
  __resetMfaForTests();
  __resetRateLimiterForTests();
  mockedRunMiddleware.mockImplementation((...args: unknown[]) =>
    jest.requireActual('@/lib/api/middleware').runMiddleware(...args));
});

function post(body: unknown, token: string | null = TOKEN): NextRequest {
  return new NextRequest(URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

describe('POST /api/mfa/step-up', () => {
  it('exchanges a fresh TOTP code for a verifiable assertion', async () => {
    const { secret } = await beginMfaEnrollment(ADDR);
    await confirmMfaEnrollment(ADDR, totpCode(secret));

    const res = await stepUp(post({ code: totpCode(secret) }));
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data.header).toBe(STEP_UP_HEADER);
    expect(data.expiresAt).toBeGreaterThan(Date.now());
    expect(verifyStepUpAssertion(data.assertion, ADDR)).toBe(true);
    // Bound to the subject, not bearer-transferable.
    expect(verifyStepUpAssertion(data.assertion, seededAddress(3002))).toBe(false);
  });

  it('rejects a wrong code', async () => {
    const { secret } = await beginMfaEnrollment(ADDR);
    await confirmMfaEnrollment(ADDR, totpCode(secret));

    const wrong = totpCode(secret) === '000000' ? '000001' : '000000';
    const res = await stepUp(post({ code: wrong }));
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('MFA_INVALID');
  });

  it('rejects when MFA is not enabled for the account', async () => {
    const res = await stepUp(post({ code: '123456' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('MFA_INVALID');
  });

  it('validates the code shape', async () => {
    const res = await stepUp(post({ code: 'not-six-digits' }));
    expect(res.status).toBe(422);
  });

  it('requires authentication', async () => {
    const res = await stepUp(post({ code: '123456' }, null));
    expect(res.status).toBe(401);
  });

  it('route-level requireAuth blocks if middleware passed without auth', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(null);
    const res = await stepUp(post({ code: '123456' }, null));
    expect(res.status).toBe(401);
  });

  it('runs under the stricter auth rate-limit class', async () => {
    await stepUp(post({ code: '123456' }));
    expect(mockedRunMiddleware).toHaveBeenLastCalledWith(
      expect.anything(),
      { ...AUTH_RATE_LIMIT, requireAuth: true },
    );
  });

  it('returns the middleware block when blocked', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(NextResponse.json({ error: 'blocked' }, { status: 429 }));
    const res = await stepUp(post({ code: '123456' }));
    expect(res.status).toBe(429);
  });

  it('re-throws an unexpected (non-validation) error', async () => {
    // A malformed JSON body makes request.json() throw a SyntaxError — not a
    // ZodError — so the handler surfaces it rather than masking it as a 4xx.
    const bad = new NextRequest(URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', authorization: `Bearer ${TOKEN}` },
      body: '{ not json',
    });
    await expect(stepUp(bad)).rejects.toThrow();
  });
});
