/** @jest-environment node */

jest.mock('@/lib/api/middleware', () => {
  const actual = jest.requireActual('@/lib/api/middleware');
  return { ...actual, runMiddleware: jest.fn((...args: unknown[]) => actual.runMiddleware(...args)) };
});

import { NextRequest, NextResponse } from 'next/server';
import { runMiddleware } from '@/lib/api/middleware';
import { GET as listOrgs, POST as createOrg } from '@/app/api/employer/organizations/route';
import { GET as listMembers, POST as addMember } from '@/app/api/employer/organizations/[id]/members/route';
import { DELETE as removeMember } from '@/app/api/employer/organizations/[id]/members/[address]/route';
import { __resetEmployerForTests } from '@/lib/api/employer-service';
import { assignRole, __resetRolesForTests } from '@/lib/api/roles-service';
import { createSessionToken } from '@/lib/api/session';
import { seededAddress } from '@/lib/utils';

const mockedRunMiddleware = runMiddleware as jest.MockedFunction<typeof runMiddleware>;

const ADMIN = seededAddress(600);
const USER = seededAddress(601);
const MEMBER = seededAddress(610);
const adminToken = createSessionToken(ADMIN).token;
const userToken = createSessionToken(USER).token;

beforeEach(async () => {
  __resetRolesForTests();
  __resetEmployerForTests();
  await assignRole(ADMIN, 'employer_admin');
});

afterEach(() => {
  mockedRunMiddleware.mockImplementation((...args: unknown[]) => {
    const actual = jest.requireActual('@/lib/api/middleware');
    return actual.runMiddleware(...args);
  });
});

const ORGS_URL = 'http://localhost:3001/api/employer/organizations';

function authed(url: string, init: RequestInit, token?: string): NextRequest {
  const headers: Record<string, string> = { ...(init.headers as Record<string, string>) };
  if (token) headers.authorization = `Bearer ${token}`;
  return new NextRequest(url, { ...init, headers });
}

function jsonBody(body: unknown): RequestInit {
  return { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body) };
}

async function createOrgAsAdmin(): Promise<string> {
  const res = await createOrg(authed(ORGS_URL, jsonBody({ name: 'Acme' }), adminToken));
  return (await res.json()).data.id;
}

function ctx(id: string, address?: string) {
  return { params: Promise.resolve(address ? { id, address } : { id }) } as { params: Promise<{ id: string; address: string }> };
}

describe('/api/employer/organizations', () => {
  it('returns the middleware error when blocked', async () => {
    mockedRunMiddleware.mockReturnValueOnce(NextResponse.json({ error: 'blocked' }, { status: 403 }));
    expect((await listOrgs(authed(ORGS_URL, { method: 'GET' }, adminToken))).status).toBe(403);
  });

  it('GET returns 401 when unauthenticated', async () => {
    mockedRunMiddleware.mockReturnValueOnce(null);
    expect((await listOrgs(new NextRequest(ORGS_URL))).status).toBe(401);
  });

  it('GET returns 403 for a non-employer-admin', async () => {
    expect((await listOrgs(authed(ORGS_URL, { method: 'GET' }, userToken))).status).toBe(403);
  });

  it('creates and lists organizations for an employer admin', async () => {
    const created = await createOrg(authed(ORGS_URL, jsonBody({ name: 'Acme', industry: 'Tech' }), adminToken));
    expect(created.status).toBe(201);
    expect((await created.json()).data.name).toBe('Acme');

    const list = await listOrgs(authed(ORGS_URL, { method: 'GET' }, adminToken));
    expect(list.status).toBe(200);
    expect((await list.json()).data).toHaveLength(1);
  });

  it('POST returns the middleware error when blocked', async () => {
    mockedRunMiddleware.mockReturnValueOnce(NextResponse.json({ error: 'blocked' }, { status: 403 }));
    expect((await createOrg(authed(ORGS_URL, jsonBody({ name: 'x' }), adminToken))).status).toBe(403);
  });

  it('POST returns 401 when unauthenticated', async () => {
    mockedRunMiddleware.mockReturnValueOnce(null);
    expect((await createOrg(new NextRequest(ORGS_URL, jsonBody({ name: 'x' })))).status).toBe(401);
  });

  it('POST returns 403 for a non-employer-admin', async () => {
    expect((await createOrg(authed(ORGS_URL, jsonBody({ name: 'x' }), userToken))).status).toBe(403);
  });

  it('POST returns 422 for an invalid body', async () => {
    expect((await createOrg(authed(ORGS_URL, jsonBody({ name: '' }), adminToken))).status).toBe(422);
  });

  it('POST throws on an invalid JSON body', async () => {
    await expect(createOrg(authed(ORGS_URL, jsonBody('not-json'), adminToken))).rejects.toThrow();
  });
});

describe('/api/employer/organizations/[id]/members', () => {
  it('GET returns the middleware error when blocked', async () => {
    const id = await createOrgAsAdmin();
    mockedRunMiddleware.mockReturnValueOnce(NextResponse.json({ error: 'blocked' }, { status: 403 }));
    expect((await listMembers(authed(`${ORGS_URL}/${id}/members`, { method: 'GET' }, adminToken), ctx(id))).status).toBe(403);
  });

  it('GET returns 401 when unauthenticated', async () => {
    mockedRunMiddleware.mockReturnValueOnce(null);
    expect((await listMembers(new NextRequest(`${ORGS_URL}/x/members`), ctx('x'))).status).toBe(401);
  });

  it('GET returns 403 for a non-employer-admin', async () => {
    expect((await listMembers(authed(`${ORGS_URL}/x/members`, { method: 'GET' }, userToken), ctx('x'))).status).toBe(403);
  });

  it('GET returns 404 for an organization the caller does not own', async () => {
    expect((await listMembers(authed(`${ORGS_URL}/org-missing/members`, { method: 'GET' }, adminToken), ctx('org-missing'))).status).toBe(404);
  });

  it('POST adds a member and GET lists it', async () => {
    const id = await createOrgAsAdmin();
    const added = await addMember(authed(`${ORGS_URL}/${id}/members`, jsonBody({ address: MEMBER, role: 'employee' }), adminToken), ctx(id));
    expect(added.status).toBe(201);
    expect((await added.json()).data.address).toBe(MEMBER);

    const list = await listMembers(authed(`${ORGS_URL}/${id}/members`, { method: 'GET' }, adminToken), ctx(id));
    expect((await list.json()).data).toHaveLength(1);
  });

  it('POST returns 404 for an organization the caller does not own', async () => {
    expect((await addMember(authed(`${ORGS_URL}/org-missing/members`, jsonBody({ address: MEMBER }), adminToken), ctx('org-missing'))).status).toBe(404);
  });

  it('POST returns 422 for an invalid member address', async () => {
    const id = await createOrgAsAdmin();
    expect((await addMember(authed(`${ORGS_URL}/${id}/members`, jsonBody({ address: 'not-an-address' }), adminToken), ctx(id))).status).toBe(422);
  });

  it('POST returns the middleware error when blocked', async () => {
    mockedRunMiddleware.mockReturnValueOnce(NextResponse.json({ error: 'blocked' }, { status: 403 }));
    expect((await addMember(authed(`${ORGS_URL}/x/members`, jsonBody({ address: MEMBER }), adminToken), ctx('x'))).status).toBe(403);
  });

  it('POST returns 401 when unauthenticated', async () => {
    mockedRunMiddleware.mockReturnValueOnce(null);
    expect((await addMember(new NextRequest(`${ORGS_URL}/x/members`, jsonBody({ address: MEMBER })), ctx('x'))).status).toBe(401);
  });

  it('POST throws on an invalid JSON body', async () => {
    const id = await createOrgAsAdmin();
    await expect(addMember(authed(`${ORGS_URL}/${id}/members`, jsonBody('not-json'), adminToken), ctx(id))).rejects.toThrow();
  });
});

describe('/api/employer/organizations/[id]/members/[address]', () => {
  function del(id: string, address: string, token?: string): Promise<Response> {
    return removeMember(authed(`${ORGS_URL}/${id}/members/${address}`, { method: 'DELETE' }, token), ctx(id, address)) as unknown as Promise<Response>;
  }

  it('returns the middleware error when blocked', async () => {
    mockedRunMiddleware.mockReturnValueOnce(NextResponse.json({ error: 'blocked' }, { status: 403 }));
    expect((await del('x', MEMBER, adminToken)).status).toBe(403);
  });

  it('returns 401 when unauthenticated', async () => {
    mockedRunMiddleware.mockReturnValueOnce(null);
    expect((await del('x', MEMBER)).status).toBe(401);
  });

  it('returns 403 for a non-employer-admin', async () => {
    expect((await del('x', MEMBER, userToken)).status).toBe(403);
  });

  it('returns 404 for an organization the caller does not own', async () => {
    expect((await del('org-missing', MEMBER, adminToken)).status).toBe(404);
  });

  it('returns 404 when the member is not in the organization', async () => {
    const id = await createOrgAsAdmin();
    expect((await del(id, MEMBER, adminToken)).status).toBe(404);
  });

  it('removes an existing member', async () => {
    const id = await createOrgAsAdmin();
    await addMember(authed(`${ORGS_URL}/${id}/members`, jsonBody({ address: MEMBER, role: 'employee' }), adminToken), ctx(id));

    const res = await del(id, MEMBER, adminToken);
    expect(res.status).toBe(200);
    expect((await res.json()).data.status).toBe('removed');
  });
});
