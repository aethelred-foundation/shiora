/** @jest-environment node */

jest.mock('@/lib/api/middleware', () => {
  const actual = jest.requireActual('@/lib/api/middleware');
  return { ...actual, runMiddleware: jest.fn((...args: unknown[]) => actual.runMiddleware(...args)) };
});

import { NextRequest, NextResponse } from 'next/server';
import { runMiddleware } from '@/lib/api/middleware';
import { GET as getMe } from '@/app/api/me/route';
import { assignRole, __resetRolesForTests } from '@/lib/api/roles-service';
import { createSessionToken } from '@/lib/api/session';
import { seededAddress } from '@/lib/utils';

const mockedRunMiddleware = runMiddleware as jest.MockedFunction<typeof runMiddleware>;

beforeEach(() => {
  __resetRolesForTests();
});

afterEach(() => {
  mockedRunMiddleware.mockImplementation((...args: unknown[]) => {
    const actual = jest.requireActual('@/lib/api/middleware');
    return actual.runMiddleware(...args);
  });
});

function req(token?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (token) headers.authorization = `Bearer ${token}`;
  return new NextRequest('http://localhost:3001/api/me', { headers });
}

describe('GET /api/me', () => {
  it('returns the middleware error when blocked', async () => {
    mockedRunMiddleware.mockReturnValueOnce(NextResponse.json({ error: 'blocked' }, { status: 403 }));
    expect((await getMe(req(createSessionToken(seededAddress(1)).token))).status).toBe(403);
  });

  it('returns 401 when unauthenticated', async () => {
    mockedRunMiddleware.mockReturnValueOnce(null);
    expect((await getMe(req())).status).toBe(401);
  });

  it('returns identity with the default individual role and capabilities', async () => {
    const addr = seededAddress(2);
    const res = await getMe(req(createSessionToken(addr).token));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.address).toBe(addr);
    expect(body.data.roles).toEqual(['individual']);
    expect(body.data.labels).toContain('Individual');
    expect(body.data.capabilities).toContain('manage_own_records');
  });

  it('reflects an assigned role and its capabilities', async () => {
    const addr = seededAddress(3);
    await assignRole(addr, 'provider');
    const res = await getMe(req(createSessionToken(addr).token));
    const body = await res.json();
    expect(body.data.roles).toContain('provider');
    expect(body.data.capabilities).toContain('view_granted_records');
  });
});
