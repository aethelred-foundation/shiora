/** @jest-environment node */

jest.mock('@/lib/api/middleware', () => {
  const actual = jest.requireActual('@/lib/api/middleware');
  return { ...actual, runMiddleware: jest.fn((...args: unknown[]) => actual.runMiddleware(...args)) };
});

import { NextRequest, NextResponse } from 'next/server';
import { runMiddleware } from '@/lib/api/middleware';
import { POST as prove } from '@/app/api/zkp/prove/route';
import { POST as verify } from '@/app/api/zkp/verify/route';
import { GET as getClaims } from '@/app/api/zkp/claims/route';
import { __resetZkpForTests } from '@/lib/api/zkp-service';
import { createSessionToken } from '@/lib/api/session';
import { seededAddress } from '@/lib/utils';

const mockedRunMiddleware = runMiddleware as jest.MockedFunction<typeof runMiddleware>;
const USER = seededAddress(400);
const token = createSessionToken(USER).token;

beforeEach(() => __resetZkpForTests());

afterEach(() => {
  mockedRunMiddleware.mockImplementation((...args: unknown[]) => {
    const actual = jest.requireActual('@/lib/api/middleware');
    return actual.runMiddleware(...args);
  });
  __resetZkpForTests();
});

const PROVE = 'http://localhost:3000/api/zkp/prove';
const VERIFY = 'http://localhost:3000/api/zkp/verify';
const CLAIMS = 'http://localhost:3000/api/zkp/claims';
const blocked = () => mockedRunMiddleware.mockResolvedValueOnce(NextResponse.json({ error: 'blocked' }, { status: 403 }));

function post(url: string, body: unknown, authed = true): NextRequest {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authed) headers.authorization = `Bearer ${token}`;
  return new NextRequest(url, { method: 'POST', headers, body: typeof body === 'string' ? body : JSON.stringify(body) });
}

function authedGet(url: string): NextRequest {
  return new NextRequest(url, { headers: { authorization: `Bearer ${token}` } });
}

describe('POST /api/zkp/prove', () => {
  it('returns the middleware error when blocked', async () => {
    blocked();
    expect((await prove(post(PROVE, { claimType: 'age_range', value: 30, set: [18, 30] }))).status).toBe(403);
  });

  it('returns 401 when bypassed but unauthenticated', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(null);
    expect((await prove(post(PROVE, { claimType: 'age_range', value: 30, set: [18, 30] }, false))).status).toBe(401);
  });

  it('generates a real proof the verify endpoint accepts', async () => {
    const res = await prove(post(PROVE, { claimType: 'age_range', value: 30, set: [18, 30, 65] }));
    expect(res.status).toBe(201);
    const data = (await res.json()).data;
    expect(data.proofId).toMatch(/^zkp-/);

    const verifyRes = await verify(post(VERIFY, { proof: data.proof, context: data.context }, false));
    expect((await verifyRes.json()).data.valid).toBe(true);
  });

  it('returns 400 when the value is not in the set', async () => {
    const res = await prove(post(PROVE, { claimType: 'data_quality', value: 99, set: [80, 90] }));
    expect(res.status).toBe(400);
  });

  it('returns 422 for an invalid claim type', async () => {
    expect((await prove(post(PROVE, { claimType: 'nope', value: 1, set: [1] }))).status).toBe(422);
  });
});

describe('POST /api/zkp/verify', () => {
  it('rejects a tampered proof', async () => {
    const proveRes = await prove(post(PROVE, { claimType: 'age_range', value: 18, set: [18, 30] }));
    const data = (await proveRes.json()).data;
    const tampered = { ...data.proof, z: [data.proof.z[0], 'deadbeef'] };

    const res = await verify(post(VERIFY, { proof: tampered, context: data.context }, false));
    expect((await res.json()).data.valid).toBe(false);
  });

  it('returns the middleware error when blocked', async () => {
    blocked();
    expect((await verify(post(VERIFY, { proof: {}, context: 'x' }, false))).status).toBe(403);
  });

  it('returns 422 for a malformed verify body', async () => {
    expect((await verify(post(VERIFY, { context: 'x' }, false))).status).toBe(422);
  });

  it('returns 400 for an invalid JSON body', async () => {
    expect((await verify(post(VERIFY, 'not-json', false))).status).toBe(400);
  });
});

describe('GET /api/zkp/claims', () => {
  it('returns the middleware error when blocked', async () => {
    blocked();
    expect((await getClaims(authedGet(CLAIMS))).status).toBe(403);
  });

  it('returns 401 when bypassed but unauthenticated', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(null);
    expect((await getClaims(new NextRequest(CLAIMS))).status).toBe(401);
  });

  it('returns the claim-type catalog and the caller\'s proofs, newest first', async () => {
    await prove(post(PROVE, { claimType: 'age_range', value: 30, set: [18, 30] }));
    await prove(post(PROVE, { claimType: 'data_quality', value: 90, set: [80, 90] }));

    const body = await (await getClaims(authedGet(CLAIMS))).json();
    expect(body.data.claimTypes.length).toBeGreaterThanOrEqual(6);
    expect(body.data.proofs).toHaveLength(2);
    // newest-first ordering (exercises the sort comparator)
    const [a, b] = body.data.proofs;
    expect(a.createdAt).toBeGreaterThanOrEqual(b.createdAt);
  });
});
