/** @jest-environment node */

jest.mock('@/lib/api/middleware', () => {
  const actual = jest.requireActual('@/lib/api/middleware');
  return { ...actual, runMiddleware: jest.fn((...args: unknown[]) => actual.runMiddleware(...args)) };
});

import { NextRequest, NextResponse } from 'next/server';
import { runMiddleware } from '@/lib/api/middleware';
import { GET } from '@/app/api/me/activity/route';
import { getAuditLog, __resetAuditLogForTests } from '@/lib/api/audit-log';
import { createSessionToken } from '@/lib/api/session';
import { seededAddress } from '@/lib/utils';

const mockedRunMiddleware = runMiddleware as jest.MockedFunction<typeof runMiddleware>;
const USER = seededAddress(700);
const OTHER = seededAddress(701);
const token = createSessionToken(USER).token;

beforeEach(() => __resetAuditLogForTests());

afterEach(() => {
  mockedRunMiddleware.mockImplementation((...args: unknown[]) => {
    const actual = jest.requireActual('@/lib/api/middleware');
    return actual.runMiddleware(...args);
  });
});

const URL = 'http://localhost:3000/api/me/activity';

function authed(url: string): NextRequest {
  return new NextRequest(url, { headers: { authorization: `Bearer ${token}` } });
}

async function seed(actor: string, action: string, resourceId: string) {
  await getAuditLog().record({
    action: action as never, actor, resource: 'health_records', resourceId, success: true,
  });
}

describe('GET /api/me/activity', () => {
  it('returns the middleware error when blocked', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(NextResponse.json({ error: 'blocked' }, { status: 403 }));
    expect((await GET(authed(URL))).status).toBe(403);
  });

  it('returns 401 when the middleware is bypassed but unauthenticated', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(null);
    expect((await GET(new NextRequest(URL))).status).toBe(401);
  });

  it('returns an empty feed for a user with no activity', async () => {
    const res = await GET(authed(URL));
    expect(res.status).toBe(200);
    expect((await res.json()).data.total).toBe(0);
  });

  it('shows only the caller\'s own activity (self-scoped)', async () => {
    await seed(USER, 'RECORD_CREATE', 'rec-1');
    await seed(USER, 'CONSENT_CREATE', 'con-1');
    await seed(OTHER, 'RECORD_CREATE', 'rec-2'); // someone else's activity

    const body = await (await GET(authed(URL))).json();
    expect(body.data.total).toBe(2); // OTHER's entry is excluded
    expect(body.data.activity.every((a: { resource: string }) => a.resource === 'health_records')).toBe(true);
    expect(body.data.activity[0]).toHaveProperty('seq');
    expect(body.data.activity[0]).toHaveProperty('action');
    expect(body.data.activity[0]).toHaveProperty('success', true);
  });

  it('filters by action', async () => {
    await seed(USER, 'RECORD_CREATE', 'rec-1');
    await seed(USER, 'CONSENT_CREATE', 'con-1');

    const body = await (await GET(authed(`${URL}?action=RECORD_CREATE`))).json();
    expect(body.data.total).toBe(1);
    expect(body.data.activity[0].action).toBe('RECORD_CREATE');
  });

  it('returns 422 for an invalid limit', async () => {
    expect((await GET(authed(`${URL}?limit=0`))).status).toBe(422);
  });

  it('re-throws a non-Zod error from the audit log', async () => {
    const spy = jest.spyOn(getAuditLog(), 'list').mockRejectedValueOnce(new Error('audit store down'));
    await expect(GET(authed(URL))).rejects.toThrow('audit store down');
    spy.mockRestore();
  });
});
