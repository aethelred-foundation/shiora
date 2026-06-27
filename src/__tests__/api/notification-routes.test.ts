/** @jest-environment node */

jest.mock('@/lib/api/middleware', () => {
  const actual = jest.requireActual('@/lib/api/middleware');
  return { ...actual, runMiddleware: jest.fn((...args: unknown[]) => actual.runMiddleware(...args)) };
});

import { NextRequest, NextResponse } from 'next/server';
import { runMiddleware } from '@/lib/api/middleware';
import { GET } from '@/app/api/notifications/route';
import { PATCH } from '@/app/api/notifications/[id]/route';
import { POST as readAll } from '@/app/api/notifications/read-all/route';
import { GET as getPrefs, PUT as putPrefs } from '@/app/api/notifications/preferences/route';
import { notify, __resetNotificationsForTests } from '@/lib/api/notification-service';
import { createSessionToken } from '@/lib/api/session';
import { seededAddress } from '@/lib/utils';

const mockedRunMiddleware = runMiddleware as jest.MockedFunction<typeof runMiddleware>;
const USER = seededAddress(700);
const token = createSessionToken(USER).token;

beforeEach(() => __resetNotificationsForTests());

afterEach(() => {
  mockedRunMiddleware.mockImplementation((...args: unknown[]) => {
    const actual = jest.requireActual('@/lib/api/middleware');
    return actual.runMiddleware(...args);
  });
});

const URL = 'http://localhost:3000/api/notifications';

function authed(url: string, init: RequestInit = {}): NextRequest {
  return new NextRequest(url, {
    ...init,
    headers: { ...(init.headers as Record<string, string>), authorization: `Bearer ${token}` },
  });
}

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

const blocked = () => mockedRunMiddleware.mockResolvedValueOnce(NextResponse.json({ error: 'blocked' }, { status: 403 }));
const seed = (title: string) => notify(USER, { type: 'system', title, body: 'b' });

describe('GET /api/notifications', () => {
  it('returns the middleware error when blocked', async () => {
    blocked();
    expect((await GET(authed(URL))).status).toBe(403);
  });

  it('returns 401 when the middleware is bypassed but unauthenticated', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(null);
    expect((await GET(new NextRequest(URL))).status).toBe(401);
  });

  it('lists notifications with an unread count and an unread filter', async () => {
    const a = await seed('A');
    await seed('B');

    const all = await GET(authed(URL));
    const allBody = await all.json();
    expect(allBody.data.total).toBe(2);
    expect(allBody.data.unreadCount).toBe(2);

    await PATCH(authed(`${URL}/${a.id}`, { method: 'PATCH' }), ctx(a.id));

    const unread = await GET(authed(`${URL}?unread=true`));
    const unreadBody = await unread.json();
    expect(unreadBody.data.total).toBe(1);
    expect(unreadBody.data.unreadCount).toBe(1);
  });
});

describe('PATCH /api/notifications/[id]', () => {
  it('returns the middleware error when blocked', async () => {
    blocked();
    expect((await PATCH(authed(`${URL}/x`, { method: 'PATCH' }), ctx('x'))).status).toBe(403);
  });

  it('returns 401 when the middleware is bypassed but unauthenticated', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(null);
    expect((await PATCH(new NextRequest(`${URL}/x`, { method: 'PATCH' }), ctx('x'))).status).toBe(401);
  });

  it('marks a notification read', async () => {
    const n = await seed('A');
    const res = await PATCH(authed(`${URL}/${n.id}`, { method: 'PATCH' }), ctx(n.id));
    expect(res.status).toBe(200);
    expect((await res.json()).data.read).toBe(true);
  });

  it('returns 404 for an unknown notification', async () => {
    expect((await PATCH(authed(`${URL}/nope`, { method: 'PATCH' }), ctx('nope'))).status).toBe(404);
  });
});

describe('POST /api/notifications/read-all', () => {
  it('returns the middleware error when blocked', async () => {
    blocked();
    expect((await readAll(authed(`${URL}/read-all`, { method: 'POST' }))).status).toBe(403);
  });

  it('returns 401 when the middleware is bypassed but unauthenticated', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(null);
    expect((await readAll(new NextRequest(`${URL}/read-all`, { method: 'POST' }))).status).toBe(401);
  });

  it('marks every unread notification read', async () => {
    await seed('A');
    await seed('B');
    const res = await readAll(authed(`${URL}/read-all`, { method: 'POST' }));
    expect(res.status).toBe(200);
    expect((await res.json()).data.markedRead).toBe(2);
  });
});

describe('/api/notifications/preferences', () => {
  const PREFS = `${URL}/preferences`;
  const putBody = (body: unknown): RequestInit => ({
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

  it('GET returns the middleware error when blocked', async () => {
    blocked();
    expect((await getPrefs(authed(PREFS))).status).toBe(403);
  });

  it('GET returns 401 when the middleware is bypassed but unauthenticated', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(null);
    expect((await getPrefs(new NextRequest(PREFS))).status).toBe(401);
  });

  it('GET defaults to nothing muted', async () => {
    const body = await (await getPrefs(authed(PREFS))).json();
    expect(body.data.mutedTypes).toEqual([]);
  });

  it('PUT returns the middleware error when blocked', async () => {
    blocked();
    expect((await putPrefs(authed(PREFS, putBody({ mutedTypes: [] })))).status).toBe(403);
  });

  it('PUT returns 401 when the middleware is bypassed but unauthenticated', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(null);
    expect((await putPrefs(new NextRequest(PREFS, putBody({ mutedTypes: [] })))).status).toBe(401);
  });

  it('PUT sets muted types and GET reflects them', async () => {
    const res = await putPrefs(authed(PREFS, putBody({ mutedTypes: ['wellness', 'care_gap'] })));
    expect(res.status).toBe(200);
    expect((await res.json()).data.mutedTypes).toEqual(['wellness', 'care_gap']);

    const after = await (await getPrefs(authed(PREFS))).json();
    expect(after.data.mutedTypes).toEqual(['wellness', 'care_gap']);
  });

  it('PUT returns 422 for an invalid notification type', async () => {
    expect((await putPrefs(authed(PREFS, putBody({ mutedTypes: ['nope'] })))).status).toBe(422);
  });

  it('PUT throws on an invalid JSON body', async () => {
    await expect(putPrefs(authed(PREFS, putBody('not-json')))).rejects.toThrow();
  });
});
