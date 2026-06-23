/** @jest-environment node */

jest.mock('@/lib/api/middleware', () => {
  const actual = jest.requireActual('@/lib/api/middleware');
  return { ...actual, runMiddleware: jest.fn((...args: unknown[]) => actual.runMiddleware(...args)) };
});

import { NextRequest, NextResponse } from 'next/server';
import { runMiddleware } from '@/lib/api/middleware';
import { GET as getMyRoles, POST as assign, DELETE as revoke } from '@/app/api/roles/route';
import { GET as getRolesFor } from '@/app/api/roles/[address]/route';
import { __resetRolesForTests } from '@/lib/api/roles-service';
import { createSessionToken } from '@/lib/api/session';
import { seededAddress } from '@/lib/utils';

const mockedRunMiddleware = runMiddleware as jest.MockedFunction<typeof runMiddleware>;

const ADMIN = seededAddress(800);
const NON_ADMIN = seededAddress(801);
const TARGET = seededAddress(802);
const adminToken = createSessionToken(ADMIN).token;
const userToken = createSessionToken(NON_ADMIN).token;
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
  mockedRunMiddleware.mockImplementation((...args: unknown[]) => {
    const actual = jest.requireActual('@/lib/api/middleware');
    return actual.runMiddleware(...args);
  });
});

function authed(init: RequestInit, token: string): NextRequest {
  return new NextRequest('http://localhost:3001/api/roles', {
    ...init,
    headers: { ...(init.headers ?? {}), authorization: `Bearer ${token}` },
  });
}

function jsonBody(body: unknown) {
  return { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

describe('GET /api/roles (self)', () => {
  it('returns the middleware error when blocked', async () => {
    mockedRunMiddleware.mockReturnValueOnce(NextResponse.json({ error: 'blocked' }, { status: 403 }));
    expect((await getMyRoles(authed({ method: 'GET' }, userToken))).status).toBe(403);
  });

  it('returns 401 when unauthenticated', async () => {
    mockedRunMiddleware.mockReturnValueOnce(null);
    expect((await getMyRoles(new NextRequest('http://localhost:3001/api/roles'))).status).toBe(401);
  });

  it('returns the caller default role (individual)', async () => {
    const res = await getMyRoles(authed({ method: 'GET' }, userToken));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.roles).toEqual(['individual']);
    expect(body.data.labels).toContain('Individual');
  });
});

describe('POST /api/roles (assign)', () => {
  it('returns the middleware error when blocked', async () => {
    mockedRunMiddleware.mockReturnValueOnce(NextResponse.json({ error: 'blocked' }, { status: 403 }));
    expect((await assign(authed(jsonBody({ address: TARGET, role: 'provider' }), adminToken))).status).toBe(403);
  });

  it('returns 401 when unauthenticated', async () => {
    mockedRunMiddleware.mockReturnValueOnce(null);
    expect((await assign(new NextRequest('http://localhost:3001/api/roles', jsonBody({ address: TARGET, role: 'provider' })))).status).toBe(401);
  });

  it('returns 403 for a non-admin caller', async () => {
    const res = await assign(authed(jsonBody({ address: TARGET, role: 'provider' }), userToken));
    expect(res.status).toBe(403);
  });

  it('assigns a role (201) when called by an admin', async () => {
    const res = await assign(authed(jsonBody({ address: TARGET, role: 'provider' }), adminToken));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.roles).toEqual(['individual', 'provider']);
  });

  it('returns 422 for an invalid role', async () => {
    const res = await assign(authed(jsonBody({ address: TARGET, role: 'superuser' }), adminToken));
    expect(res.status).toBe(422);
  });

  it('throws on an invalid JSON body (non-Zod error)', async () => {
    await expect(
      assign(authed({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: 'not-json' }, adminToken)),
    ).rejects.toThrow();
  });
});

describe('DELETE /api/roles (revoke)', () => {
  it('returns the middleware error when blocked', async () => {
    mockedRunMiddleware.mockReturnValueOnce(NextResponse.json({ error: 'blocked' }, { status: 403 }));
    const res = await revoke(authed({ ...jsonBody({ address: TARGET, role: 'provider' }), method: 'DELETE' }, adminToken));
    expect(res.status).toBe(403);
  });

  it('returns 401 when unauthenticated', async () => {
    mockedRunMiddleware.mockReturnValueOnce(null);
    expect((await revoke(new NextRequest('http://localhost:3001/api/roles', { ...jsonBody({ address: TARGET, role: 'provider' }), method: 'DELETE' }))).status).toBe(401);
  });

  it('returns 403 for a non-admin caller', async () => {
    const res = await revoke(authed({ ...jsonBody({ address: TARGET, role: 'provider' }), method: 'DELETE' }, userToken));
    expect(res.status).toBe(403);
  });

  it('revokes a role (200) when called by an admin', async () => {
    await assign(authed(jsonBody({ address: TARGET, role: 'provider' }), adminToken));
    const res = await revoke(authed({ ...jsonBody({ address: TARGET, role: 'provider' }), method: 'DELETE' }, adminToken));
    expect(res.status).toBe(200);
    expect((await res.json()).data.roles).toEqual(['individual']);
  });

  it('returns 404 when revoking from an address with no assignment', async () => {
    const res = await revoke(authed({ ...jsonBody({ address: TARGET, role: 'provider' }), method: 'DELETE' }, adminToken));
    expect(res.status).toBe(404);
  });

  it('returns 422 for an invalid body', async () => {
    const res = await revoke(authed({ ...jsonBody({ address: 'not-an-address', role: 'provider' }), method: 'DELETE' }, adminToken));
    expect(res.status).toBe(422);
  });

  it('throws on an invalid JSON body (non-Zod error)', async () => {
    await expect(
      revoke(authed({ method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: 'not-json' }, adminToken)),
    ).rejects.toThrow();
  });
});

describe('GET /api/roles/[address] (admin lookup)', () => {
  it('returns the middleware error when blocked', async () => {
    mockedRunMiddleware.mockReturnValueOnce(NextResponse.json({ error: 'blocked' }, { status: 403 }));
    const res = await getRolesFor(authed({ method: 'GET' }, adminToken), { params: Promise.resolve({ address: TARGET }) });
    expect(res.status).toBe(403);
  });

  it('returns 401 when unauthenticated', async () => {
    mockedRunMiddleware.mockReturnValueOnce(null);
    const res = await getRolesFor(new NextRequest('http://localhost:3001/api/roles/x'), { params: Promise.resolve({ address: TARGET }) });
    expect(res.status).toBe(401);
  });

  it('returns 403 for a non-admin caller', async () => {
    const res = await getRolesFor(authed({ method: 'GET' }, userToken), { params: Promise.resolve({ address: TARGET }) });
    expect(res.status).toBe(403);
  });

  it('returns the roles for an address when called by an admin', async () => {
    await assign(authed(jsonBody({ address: TARGET, role: 'researcher' }), adminToken));
    const res = await getRolesFor(authed({ method: 'GET' }, adminToken), { params: Promise.resolve({ address: TARGET }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.roles).toContain('researcher');
  });
});
