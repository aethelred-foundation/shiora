/** @jest-environment node */

jest.mock('@/lib/api/middleware', () => {
  const actual = jest.requireActual('@/lib/api/middleware');
  return { ...actual, runMiddleware: jest.fn((...args: unknown[]) => actual.runMiddleware(...args)) };
});

import { NextRequest, NextResponse } from 'next/server';
import { runMiddleware } from '@/lib/api/middleware';
import { POST as postReseal } from '@/app/api/system/kek-reseal/route';
import { createSessionToken } from '@/lib/api/session';
import { __resetRolesForTests } from '@/lib/api/roles-service';
import { seededAddress } from '@/lib/utils';

const mockedRunMiddleware = runMiddleware as jest.MockedFunction<typeof runMiddleware>;
const URL = 'http://localhost:3000/api/system/kek-reseal';
const ADMIN = seededAddress(991);
const USER = seededAddress(992);
const originalAdmins = process.env.SHIORA_ADMIN_ADDRESSES;

beforeEach(() => {
  process.env.SHIORA_ADMIN_ADDRESSES = ADMIN;
  delete process.env.DATABASE_URL; // in-memory deployment for the test
  __resetRolesForTests();
});

afterEach(() => {
  if (originalAdmins === undefined) delete process.env.SHIORA_ADMIN_ADDRESSES;
  else process.env.SHIORA_ADMIN_ADDRESSES = originalAdmins;
  mockedRunMiddleware.mockImplementation((...args: unknown[]) =>
    jest.requireActual('@/lib/api/middleware').runMiddleware(...args));
});

function req(token?: string): NextRequest {
  return new NextRequest(URL, {
    method: 'POST',
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

describe('POST /api/system/kek-reseal', () => {
  it('returns a not-applicable report for an admin on an in-memory deployment', async () => {
    const res = await postReseal(req(createSessionToken(ADMIN).token));
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data).toMatchObject({ durable: false, documentsResealed: 0, recordsResealed: 0 });
    expect(typeof data.currentVersion).toBe('number');
  });

  it('requires authentication', async () => {
    expect((await postReseal(req())).status).toBe(401);
  });

  it('rejects non-admin sessions', async () => {
    expect((await postReseal(req(createSessionToken(USER).token))).status).toBe(403);
  });

  it('returns the middleware block when blocked', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(NextResponse.json({ error: 'blocked' }, { status: 429 }));
    expect((await postReseal(req(createSessionToken(ADMIN).token))).status).toBe(429);
  });
});
