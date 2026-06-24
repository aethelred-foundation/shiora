/** @jest-environment node */

jest.mock('@/lib/api/middleware', () => {
  const actual = jest.requireActual('@/lib/api/middleware');
  return { ...actual, runMiddleware: jest.fn((...args: unknown[]) => actual.runMiddleware(...args)) };
});

import { NextRequest, NextResponse } from 'next/server';
import { runMiddleware } from '@/lib/api/middleware';
import { GET, POST } from '@/app/api/health-plans/care-gaps/route';
import { PATCH } from '@/app/api/health-plans/care-gaps/[id]/route';
import { createCareGap, __resetCareGapsForTests } from '@/lib/api/care-gap-service';
import { assignRole, __resetRolesForTests } from '@/lib/api/roles-service';
import { createSessionToken } from '@/lib/api/session';
import { seededAddress } from '@/lib/utils';

const mockedRunMiddleware = runMiddleware as jest.MockedFunction<typeof runMiddleware>;
const PAYER = seededAddress(400);
const OUTSIDER = seededAddress(405); // default individual — lacks manage_care_gaps
const payerToken = createSessionToken(PAYER).token;
const outsiderToken = createSessionToken(OUTSIDER).token;

beforeEach(async () => {
  __resetCareGapsForTests();
  __resetRolesForTests();
  await assignRole(PAYER, 'payer_analyst');
});

afterEach(() => {
  mockedRunMiddleware.mockImplementation((...args: unknown[]) => {
    const actual = jest.requireActual('@/lib/api/middleware');
    return actual.runMiddleware(...args);
  });
});

const URL = 'http://localhost:3000/api/health-plans/care-gaps';

function authed(url: string, init: RequestInit, token?: string): NextRequest {
  const headers: Record<string, string> = { ...(init.headers as Record<string, string>) };
  if (token) headers.authorization = `Bearer ${token}`;
  return new NextRequest(url, { ...init, headers });
}

function jsonBody(body: unknown, method = 'POST'): RequestInit {
  return { method, headers: { 'Content-Type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body) };
}

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

const blocked = () => mockedRunMiddleware.mockResolvedValueOnce(NextResponse.json({ error: 'blocked' }, { status: 403 }));
const validGap = { measure: 'A1c screening', cohort: 'Diabetic Q3', openCount: 12 };

describe('GET/POST /api/health-plans/care-gaps', () => {
  it('GET returns the middleware error when blocked', async () => {
    blocked();
    expect((await GET(authed(URL, { method: 'GET' }, payerToken))).status).toBe(403);
  });

  it('GET returns 403 for a non-payer', async () => {
    expect((await GET(authed(URL, { method: 'GET' }, outsiderToken))).status).toBe(403);
  });

  it('GET lists the payer\'s gaps with a status filter', async () => {
    await createCareGap(PAYER, validGap);
    const all = await GET(authed(URL, { method: 'GET' }, payerToken));
    expect((await all.json()).data.total).toBe(1);

    const open = await GET(authed(`${URL}?status=open`, { method: 'GET' }, payerToken));
    expect((await open.json()).data.total).toBe(1);

    const closed = await GET(authed(`${URL}?status=closed`, { method: 'GET' }, payerToken));
    expect((await closed.json()).data.total).toBe(0);
  });

  it('POST returns the middleware error when blocked', async () => {
    blocked();
    expect((await POST(authed(URL, jsonBody(validGap), payerToken))).status).toBe(403);
  });

  it('POST returns 403 for a non-payer', async () => {
    expect((await POST(authed(URL, jsonBody(validGap), outsiderToken))).status).toBe(403);
  });

  it('POST opens a gap', async () => {
    const res = await POST(authed(URL, jsonBody(validGap), payerToken));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.measure).toBe('A1c screening');
    expect(body.data.status).toBe('open');
  });

  it('POST returns 422 for an invalid gap', async () => {
    expect((await POST(authed(URL, jsonBody({ measure: '', cohort: '', openCount: -1 }), payerToken))).status).toBe(422);
  });

  it('POST throws on an invalid JSON body', async () => {
    await expect(POST(authed(URL, jsonBody('not-json'), payerToken))).rejects.toThrow();
  });
});

describe('PATCH /api/health-plans/care-gaps/[id]', () => {
  it('returns the middleware error when blocked', async () => {
    blocked();
    expect((await PATCH(authed(`${URL}/x`, jsonBody({ status: 'closed' }, 'PATCH'), payerToken), ctx('x'))).status).toBe(403);
  });

  it('returns 403 for a non-payer', async () => {
    expect((await PATCH(authed(`${URL}/x`, jsonBody({ status: 'closed' }, 'PATCH'), outsiderToken), ctx('x'))).status).toBe(403);
  });

  it('returns 404 for an unknown gap', async () => {
    expect((await PATCH(authed(`${URL}/nope`, jsonBody({ status: 'closed' }, 'PATCH'), payerToken), ctx('nope'))).status).toBe(404);
  });

  it('updates the open count and closes a gap', async () => {
    const gap = await createCareGap(PAYER, validGap);

    const reduced = await PATCH(authed(`${URL}/${gap.id}`, jsonBody({ openCount: 4 }, 'PATCH'), payerToken), ctx(gap.id));
    expect(reduced.status).toBe(200);
    expect((await reduced.json()).data.openCount).toBe(4);

    const closed = await PATCH(authed(`${URL}/${gap.id}`, jsonBody({ status: 'closed' }, 'PATCH'), payerToken), ctx(gap.id));
    expect((await closed.json()).data.status).toBe('closed');
  });

  it('returns 422 for an invalid patch', async () => {
    const gap = await createCareGap(PAYER, validGap);
    expect((await PATCH(authed(`${URL}/${gap.id}`, jsonBody({ status: 'archived' }, 'PATCH'), payerToken), ctx(gap.id))).status).toBe(422);
  });

  it('throws on an invalid JSON body', async () => {
    const gap = await createCareGap(PAYER, validGap);
    await expect(PATCH(authed(`${URL}/${gap.id}`, jsonBody('not-json', 'PATCH'), payerToken), ctx(gap.id))).rejects.toThrow();
  });
});
