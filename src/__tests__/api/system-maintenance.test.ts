/** @jest-environment node */

jest.mock('@/lib/api/middleware', () => {
  const actual = jest.requireActual('@/lib/api/middleware');
  return { ...actual, runMiddleware: jest.fn((...args: unknown[]) => actual.runMiddleware(...args)) };
});

import { NextRequest, NextResponse } from 'next/server';
import { runMiddleware } from '@/lib/api/middleware';
import { POST as postMaintenance } from '@/app/api/system/maintenance/route';
import { createSessionToken } from '@/lib/api/session';
import { __resetRolesForTests } from '@/lib/api/roles-service';
import { seededAddress } from '@/lib/utils';

const mockedRunMiddleware = runMiddleware as jest.MockedFunction<typeof runMiddleware>;
const URL = 'http://localhost:3000/api/system/maintenance';
const ADMIN = seededAddress(881);
const USER = seededAddress(882);
const originalAdmins = process.env.SHIORA_ADMIN_ADDRESSES;

beforeEach(() => {
  process.env.SHIORA_ADMIN_ADDRESSES = ADMIN;
  __resetRolesForTests();
});

afterEach(() => {
  if (originalAdmins === undefined) {
    delete process.env.SHIORA_ADMIN_ADDRESSES;
  } else {
    process.env.SHIORA_ADMIN_ADDRESSES = originalAdmins;
  }
  mockedRunMiddleware.mockImplementation((...args: unknown[]) =>
    jest.requireActual('@/lib/api/middleware').runMiddleware(...args));
});

function req(token?: string): NextRequest {
  return new NextRequest(URL, {
    method: 'POST',
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

describe('POST /api/system/maintenance', () => {
  it('runs maintenance and returns the report for an admin', async () => {
    const res = await postMaintenance(req(createSessionToken(ADMIN).token));
    expect(res.status).toBe(200);
    const body = await res.json();
    // In-memory test deployment: nothing durable to prune, honestly reported.
    expect(body.data).toMatchObject({
      durable: false,
      prunedNonces: 0,
      prunedRevocations: 0,
      prunedRateLimitWindows: 0,
      prunedSessions: 0,
      prunedIdempotencyKeys: 0,
      prunedLoginAttempts: 0,
    });
    expect(typeof body.data.ranAt).toBe('number');
  });

  it('requires authentication', async () => {
    const res = await postMaintenance(req());
    expect(res.status).toBe(401);
  });

  it('rejects non-admin sessions', async () => {
    const res = await postMaintenance(req(createSessionToken(USER).token));
    expect(res.status).toBe(403);
  });

  it('returns the middleware block when blocked', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(NextResponse.json({ error: 'blocked' }, { status: 429 }));
    const res = await postMaintenance(req(createSessionToken(ADMIN).token));
    expect(res.status).toBe(429);
  });
});
