/** @jest-environment node */

jest.mock('@/lib/api/middleware', () => {
  const actual = jest.requireActual('@/lib/api/middleware');
  return { ...actual, runMiddleware: jest.fn((...args: unknown[]) => actual.runMiddleware(...args)) };
});

import { NextRequest, NextResponse } from 'next/server';
import { runMiddleware, AUTH_RATE_LIMIT } from '@/lib/api/middleware';
import { POST as generateCodes, GET as codesStatus } from '@/app/api/me/recovery/codes/route';
import { POST as consume } from '@/app/api/me/recovery/consume/route';
import { createSessionToken } from '@/lib/api/session';
import { mintStepUpAssertion, verifyStepUpAssertion, STEP_UP_HEADER } from '@/lib/api/step-up';
import {
  beginMfaEnrollment,
  confirmMfaEnrollment,
  __resetMfaForTests,
} from '@/lib/api/mfa-service';
import { totpCode } from '@/lib/api/totp';
import { RECOVERY_CODE_COUNT, __resetRecoveryForTests } from '@/lib/api/recovery-service';
import { getAuditLog as getAuditEntries } from '@/lib/api/audit';
import { __resetAuditLogForTests } from '@/lib/api/audit-log';
import { __resetRateLimiterForTests } from '@/lib/api/rate-limiter';
import { seededAddress } from '@/lib/utils';

const mockedRunMiddleware = runMiddleware as jest.MockedFunction<typeof runMiddleware>;
const CODES_URL = 'http://localhost:3000/api/me/recovery/codes';
const CONSUME_URL = 'http://localhost:3000/api/me/recovery/consume';
const ADDR = seededAddress(7201);
const TOKEN = createSessionToken(ADDR).token;

afterEach(() => {
  __resetRecoveryForTests();
  __resetMfaForTests();
  __resetAuditLogForTests();
  __resetRateLimiterForTests();
  mockedRunMiddleware.mockImplementation((...args: unknown[]) =>
    jest.requireActual('@/lib/api/middleware').runMiddleware(...args));
});

function request(
  url: string,
  method: 'GET' | 'POST',
  body?: unknown,
  token: string | null = TOKEN,
  headers: Record<string, string> = {},
): NextRequest {
  return new NextRequest(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

async function generateBatch(): Promise<string[]> {
  const res = await generateCodes(request(CODES_URL, 'POST'));
  expect(res.status).toBe(201);
  return (await res.json()).data.codes;
}

describe('POST /api/me/recovery/codes', () => {
  it('mints a batch of one-time codes, returned in plaintext exactly once', async () => {
    const res = await generateCodes(request(CODES_URL, 'POST'));
    expect(res.status).toBe(201);
    const { data } = await res.json();
    expect(data.codes).toHaveLength(RECOVERY_CODE_COUNT);
    expect(data.generatedAt).toBeLessThanOrEqual(Date.now());

    // The status view never repeats the codes.
    const status = await codesStatus(request(CODES_URL, 'GET'));
    const statusBody = await status.json();
    expect(JSON.stringify(statusBody)).not.toContain(data.codes[0]);
    expect(statusBody.data).toEqual({
      active: true,
      remaining: RECOVERY_CODE_COUNT,
      generatedAt: data.generatedAt,
    });
  });

  it('demands a fresh step-up assertion when MFA is enabled', async () => {
    const { secret } = await beginMfaEnrollment(ADDR);
    await confirmMfaEnrollment(ADDR, totpCode(secret));

    const denied = await generateCodes(request(CODES_URL, 'POST'));
    expect(denied.status).toBe(403);
    expect((await denied.json()).error.code).toBe('STEP_UP_REQUIRED');

    const { assertion } = mintStepUpAssertion(ADDR);
    const allowed = await generateCodes(
      request(CODES_URL, 'POST', undefined, TOKEN, { [STEP_UP_HEADER]: assertion }),
    );
    expect(allowed.status).toBe(201);
  });

  it('requires authentication', async () => {
    const res = await generateCodes(request(CODES_URL, 'POST', undefined, null));
    expect(res.status).toBe(401);
  });

  it('route-level requireAuth blocks if middleware passed without auth', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(null);
    const res = await generateCodes(request(CODES_URL, 'POST', undefined, null));
    expect(res.status).toBe(401);
  });

  it('runs under the stricter auth rate-limit class', async () => {
    await generateCodes(request(CODES_URL, 'POST'));
    expect(mockedRunMiddleware).toHaveBeenLastCalledWith(
      expect.anything(),
      { ...AUTH_RATE_LIMIT, requireAuth: true },
    );
  });

  it('returns the middleware block when blocked', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(NextResponse.json({ error: 'blocked' }, { status: 429 }));
    const res = await generateCodes(request(CODES_URL, 'POST'));
    expect(res.status).toBe(429);
  });
});

describe('GET /api/me/recovery/codes', () => {
  it('reports an inactive batch before generation', async () => {
    const res = await codesStatus(request(CODES_URL, 'GET'));
    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual({ active: false, remaining: 0, generatedAt: null });
  });

  it('requires authentication', async () => {
    const res = await codesStatus(request(CODES_URL, 'GET', undefined, null));
    expect(res.status).toBe(401);
  });

  it('route-level requireAuth blocks if middleware passed without auth', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(null);
    const res = await codesStatus(request(CODES_URL, 'GET', undefined, null));
    expect(res.status).toBe(401);
  });

  it('returns the middleware block when blocked', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(NextResponse.json({ error: 'blocked' }, { status: 429 }));
    const res = await codesStatus(request(CODES_URL, 'GET'));
    expect(res.status).toBe(429);
  });
});

describe('POST /api/me/recovery/consume', () => {
  it('exchanges an unused code for a step-up assertion (the recovery second factor)', async () => {
    const codes = await generateBatch();

    const res = await consume(request(CONSUME_URL, 'POST', { code: codes[0] }));
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data.header).toBe(STEP_UP_HEADER);
    expect(data.remaining).toBe(RECOVERY_CODE_COUNT - 1);
    expect(data.expiresAt).toBeGreaterThan(Date.now());
    expect(verifyStepUpAssertion(data.assertion, ADDR)).toBe(true);
    // Bound to the subject, not bearer-transferable.
    expect(verifyStepUpAssertion(data.assertion, seededAddress(7202))).toBe(false);
  });

  it('rejects a spent code and audits the failed attempt', async () => {
    const codes = await generateBatch();
    await consume(request(CONSUME_URL, 'POST', { code: codes[0] }));

    const res = await consume(request(CONSUME_URL, 'POST', { code: codes[0] }));
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('RECOVERY_INVALID');

    const attempts = getAuditEntries({ action: 'RECOVERY_CODE_CONSUME', actor: ADDR });
    expect(attempts.some((entry) => entry.success === false)).toBe(true);
    expect(attempts.some((entry) => entry.success === true)).toBe(true);
  });

  it('rejects an unknown code', async () => {
    await generateBatch();
    const res = await consume(request(CONSUME_URL, 'POST', { code: 'AAAAA-AAAAA' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('RECOVERY_INVALID');
  });

  it('validates the request shape', async () => {
    const res = await consume(request(CONSUME_URL, 'POST', { code: '' }));
    expect(res.status).toBe(422);
  });

  it('requires authentication', async () => {
    const res = await consume(request(CONSUME_URL, 'POST', { code: 'AAAAA-AAAAA' }, null));
    expect(res.status).toBe(401);
  });

  it('route-level requireAuth blocks if middleware passed without auth', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(null);
    const res = await consume(request(CONSUME_URL, 'POST', { code: 'AAAAA-AAAAA' }, null));
    expect(res.status).toBe(401);
  });

  it('runs under the stricter auth rate-limit class (a brute-force surface)', async () => {
    await consume(request(CONSUME_URL, 'POST', { code: 'AAAAA-AAAAA' }));
    expect(mockedRunMiddleware).toHaveBeenLastCalledWith(
      expect.anything(),
      { ...AUTH_RATE_LIMIT, requireAuth: true },
    );
  });

  it('returns the middleware block when blocked', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(NextResponse.json({ error: 'blocked' }, { status: 429 }));
    const res = await consume(request(CONSUME_URL, 'POST', { code: 'AAAAA-AAAAA' }));
    expect(res.status).toBe(429);
  });

  it('re-throws an unexpected (non-validation) error', async () => {
    const bad = new NextRequest(CONSUME_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', authorization: `Bearer ${TOKEN}` },
      body: '{ not json',
    });
    await expect(consume(bad)).rejects.toThrow();
  });

  it('completes the lockout-recovery loop: the assertion authorizes MFA re-enrolment', async () => {
    // Enable MFA, then "lose" the authenticator: the only way back in is a
    // recovery code, whose assertion must satisfy the step-up gate.
    const { secret } = await beginMfaEnrollment(ADDR);
    await confirmMfaEnrollment(ADDR, totpCode(secret));
    const { assertion: preLoss } = mintStepUpAssertion(ADDR);
    const generated = await generateCodes(
      request(CODES_URL, 'POST', undefined, TOKEN, { [STEP_UP_HEADER]: preLoss }),
    );
    const codes = (await generated.json()).data.codes as string[];

    const res = await consume(request(CONSUME_URL, 'POST', { code: codes[0] }));
    const { data } = await res.json();
    expect(verifyStepUpAssertion(data.assertion, ADDR)).toBe(true);
  });
});
