/** @jest-environment node */

jest.mock('@/lib/api/middleware', () => {
  const actual = jest.requireActual('@/lib/api/middleware');
  return { ...actual, runMiddleware: jest.fn((...args: unknown[]) => actual.runMiddleware(...args)) };
});

import { NextRequest, NextResponse } from 'next/server';
import { runMiddleware } from '@/lib/api/middleware';
import { GET, PUT } from '@/app/api/me/profile/route';
import { __resetProfileForTests } from '@/lib/api/profile-service';
import { createSessionToken } from '@/lib/api/session';
import { seededAddress } from '@/lib/utils';

const mockedRunMiddleware = runMiddleware as jest.MockedFunction<typeof runMiddleware>;
const USER = seededAddress(600);
const token = createSessionToken(USER).token;

beforeEach(() => __resetProfileForTests());

afterEach(() => {
  mockedRunMiddleware.mockImplementation((...args: unknown[]) => {
    const actual = jest.requireActual('@/lib/api/middleware');
    return actual.runMiddleware(...args);
  });
  __resetProfileForTests();
});

const URL = 'http://localhost:3000/api/me/profile';

function authed(url: string): NextRequest {
  return new NextRequest(url, { headers: { authorization: `Bearer ${token}` } });
}

function putBody(body: unknown): RequestInit {
  return {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  };
}

describe('/api/me/profile', () => {
  it('GET returns the middleware error when blocked', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(NextResponse.json({ error: 'blocked' }, { status: 403 }));
    expect((await GET(authed(URL))).status).toBe(403);
  });

  it('GET returns 401 when the middleware is bypassed but unauthenticated', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(null);
    expect((await GET(new NextRequest(URL))).status).toBe(401);
  });

  it('GET returns empty defaults before any profile is set', async () => {
    const body = await (await GET(authed(URL))).json();
    expect(body.data.displayName).toBe('');
    expect(body.data.updatedAt).toBeNull();
  });

  it('PUT returns the middleware error when blocked', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(NextResponse.json({ error: 'blocked' }, { status: 403 }));
    expect((await PUT(new NextRequest(URL, putBody({ displayName: 'Ada' })))).status).toBe(403);
  });

  it('PUT returns 401 when the middleware is bypassed but unauthenticated', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(null);
    const req = new NextRequest(URL, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    expect((await PUT(req)).status).toBe(401);
  });

  it('PUT saves the profile and GET reflects it', async () => {
    const res = await PUT(new NextRequest(URL, putBody({ displayName: 'Ada', timezone: 'UTC' })));
    expect(res.status).toBe(200);
    expect((await res.json()).data.displayName).toBe('Ada');

    const after = await (await GET(authed(URL))).json();
    expect(after.data.displayName).toBe('Ada');
    expect(after.data.timezone).toBe('UTC');
  });

  it('PUT returns 422 for an over-long field', async () => {
    const res = await PUT(new NextRequest(URL, putBody({ displayName: 'x'.repeat(101) })));
    expect(res.status).toBe(422);
  });

  it('PUT throws on an invalid JSON body', async () => {
    await expect(PUT(new NextRequest(URL, putBody('not-json')))).rejects.toThrow();
  });
});
