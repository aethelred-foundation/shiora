/** @jest-environment node */

jest.mock('@/lib/api/middleware', () => {
  const actual = jest.requireActual('@/lib/api/middleware');
  return { ...actual, runMiddleware: jest.fn((...args: unknown[]) => actual.runMiddleware(...args)) };
});

import { NextRequest, NextResponse } from 'next/server';
import { runMiddleware } from '@/lib/api/middleware';
import { GET } from '@/app/api/me/access-log/route';
import { getAuditLog, __resetAuditLogForTests } from '@/lib/api/audit-log';
import { createSessionToken } from '@/lib/api/session';
import { seededAddress } from '@/lib/utils';

const mockedRunMiddleware = runMiddleware as jest.MockedFunction<typeof runMiddleware>;
const USER = seededAddress(700); // the patient (subject)
const PROVIDER = seededAddress(710);
const OTHER_PATIENT = seededAddress(720);
const token = createSessionToken(USER).token;

beforeEach(() => __resetAuditLogForTests());

afterEach(() => {
  mockedRunMiddleware.mockImplementation((...args: unknown[]) => {
    const actual = jest.requireActual('@/lib/api/middleware');
    return actual.runMiddleware(...args);
  });
});

const URL = 'http://localhost:3000/api/me/access-log';

function authed(url: string): NextRequest {
  return new NextRequest(url, { headers: { authorization: `Bearer ${token}` } });
}

async function read(actor: string, subject: string) {
  await getAuditLog().record({
    action: 'RECORD_READ', actor, resource: 'health_records', resourceId: subject, success: true,
  });
}

describe('GET /api/me/access-log', () => {
  it('returns the middleware error when blocked', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(NextResponse.json({ error: 'blocked' }, { status: 403 }));
    expect((await GET(authed(URL))).status).toBe(403);
  });

  it('returns 401 when the middleware is bypassed but unauthenticated', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(null);
    expect((await GET(new NextRequest(URL))).status).toBe(401);
  });

  it('returns an empty log when no one has accessed the caller\'s records', async () => {
    const res = await GET(authed(URL));
    expect(res.status).toBe(200);
    expect((await res.json()).data.total).toBe(0);
  });

  it('shows third-party accesses to the caller\'s records, scoped to the subject', async () => {
    await read(PROVIDER, USER); // a provider read MY record — shown
    await read(PROVIDER, OTHER_PATIENT); // a provider read someone else's — excluded (subject scope)
    await read(USER, USER); // my own read of my record — excluded (not a third party)

    const body = await (await GET(authed(URL))).json();
    expect(body.data.total).toBe(1);
    expect(body.data.accesses[0].by).toBe(PROVIDER);
    expect(body.data.accesses[0]).toHaveProperty('timestamp');
    expect(body.data.accesses[0]).toHaveProperty('action', 'RECORD_READ');
    expect(body.data.accesses[0]).toHaveProperty('success', true);
  });

  it('returns 422 for an invalid limit', async () => {
    expect((await GET(authed(`${URL}?limit=0`))).status).toBe(422);
  });

  it('re-throws a non-Zod error from the audit log', async () => {
    const spy = jest.spyOn(getAuditLog(), 'list')
      .mockRejectedValueOnce(new Error('audit store down') as never);
    await expect(GET(authed(URL))).rejects.toThrow('audit store down');
    spy.mockRestore();
  });
});
