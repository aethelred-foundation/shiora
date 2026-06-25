/** @jest-environment node */

jest.mock('@/lib/api/middleware', () => {
  const actual = jest.requireActual('@/lib/api/middleware');
  return { ...actual, runMiddleware: jest.fn((...args: unknown[]) => actual.runMiddleware(...args)) };
});

import { NextRequest, NextResponse } from 'next/server';
import { runMiddleware } from '@/lib/api/middleware';
import { GET as listProgramsRoute, POST as createProgramRoute } from '@/app/api/employer/organizations/[id]/programs/route';
import { GET as listEnrollmentsRoute, POST as enrollRoute } from '@/app/api/employer/organizations/[id]/programs/[programId]/enrollments/route';
import { PATCH as progressRoute, DELETE as withdrawRoute } from '@/app/api/employer/organizations/[id]/programs/[programId]/enrollments/[address]/route';
import { GET as analyticsRoute } from '@/app/api/employer/organizations/[id]/wellness-analytics/route';
import { createProgram, enrollMember, __resetWellnessForTests } from '@/lib/api/wellness-service';
import { createOrganization, __resetEmployerForTests } from '@/lib/api/employer-service';
import { assignRole, __resetRolesForTests } from '@/lib/api/roles-service';
import { createSessionToken } from '@/lib/api/session';
import { seededAddress } from '@/lib/utils';

const mockedRunMiddleware = runMiddleware as jest.MockedFunction<typeof runMiddleware>;
const ADMIN = seededAddress(600);
const OUTSIDER = seededAddress(601);
const MEMBER = seededAddress(610);
const adminToken = createSessionToken(ADMIN).token;
const outsiderToken = createSessionToken(OUTSIDER).token;

let orgId: string;

beforeEach(async () => {
  __resetWellnessForTests();
  __resetEmployerForTests();
  __resetRolesForTests();
  await assignRole(ADMIN, 'employer_admin');
  orgId = (await createOrganization(ADMIN, { name: 'Acme' })).id;
});

afterEach(() => {
  mockedRunMiddleware.mockImplementation((...args: unknown[]) => {
    const actual = jest.requireActual('@/lib/api/middleware');
    return actual.runMiddleware(...args);
  });
});

function authed(url: string, init: RequestInit, token?: string): NextRequest {
  const headers: Record<string, string> = { ...(init.headers as Record<string, string>) };
  if (token) headers.authorization = `Bearer ${token}`;
  return new NextRequest(url, { ...init, headers });
}

function jsonBody(body: unknown): RequestInit {
  return { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body) };
}

function progCtx(id: string) {
  return { params: Promise.resolve({ id }) };
}
function enrollCtx(id: string, programId: string) {
  return { params: Promise.resolve({ id, programId }) };
}
function memberCtx(id: string, programId: string, address: string) {
  return { params: Promise.resolve({ id, programId, address }) };
}

const base = () => `http://localhost:3000/api/employer/organizations/${orgId}/programs`;
const orgUrl = () => `http://localhost:3000/api/employer/organizations/${orgId}`;
const blocked = () => mockedRunMiddleware.mockResolvedValueOnce(NextResponse.json({ error: 'blocked' }, { status: 403 }));
const newProgram = () => createProgram(orgId, { name: 'Steps', category: 'fitness' });
const jsonPatch = (body: unknown): RequestInit => ({ ...jsonBody(body), method: 'PATCH' });

describe('/api/employer/organizations/[id]/programs', () => {
  it('GET returns the middleware error when blocked', async () => {
    blocked();
    expect((await listProgramsRoute(authed(base(), { method: 'GET' }, adminToken), progCtx(orgId))).status).toBe(403);
  });

  it('GET returns 403 for a non-admin', async () => {
    expect((await listProgramsRoute(authed(base(), { method: 'GET' }, outsiderToken), progCtx(orgId))).status).toBe(403);
  });

  it('GET returns 404 for an org the caller does not own', async () => {
    expect((await listProgramsRoute(authed(base(), { method: 'GET' }, adminToken), progCtx('org-missing'))).status).toBe(404);
  });

  it('creates and lists programs', async () => {
    const created = await createProgramRoute(authed(base(), jsonBody({ name: 'Mindfulness', category: 'mental_health' }), adminToken), progCtx(orgId));
    expect(created.status).toBe(201);
    expect((await created.json()).data.name).toBe('Mindfulness');

    const list = await listProgramsRoute(authed(base(), { method: 'GET' }, adminToken), progCtx(orgId));
    expect((await list.json()).data).toHaveLength(1);
  });

  it('POST returns the middleware error when blocked', async () => {
    blocked();
    expect((await createProgramRoute(authed(base(), jsonBody({ name: 'X', category: 'fitness' }), adminToken), progCtx(orgId))).status).toBe(403);
  });

  it('POST returns 403 for a non-admin', async () => {
    expect((await createProgramRoute(authed(base(), jsonBody({ name: 'X', category: 'fitness' }), outsiderToken), progCtx(orgId))).status).toBe(403);
  });

  it('POST returns 404 for an org the caller does not own', async () => {
    expect((await createProgramRoute(authed(base(), jsonBody({ name: 'X', category: 'fitness' }), adminToken), progCtx('org-missing'))).status).toBe(404);
  });

  it('POST returns 422 for an invalid program', async () => {
    expect((await createProgramRoute(authed(base(), jsonBody({ name: '', category: 'nope' }), adminToken), progCtx(orgId))).status).toBe(422);
  });

  it('POST throws on an invalid JSON body', async () => {
    await expect(createProgramRoute(authed(base(), jsonBody('not-json'), adminToken), progCtx(orgId))).rejects.toThrow();
  });
});

describe('/api/employer/organizations/[id]/programs/[programId]/enrollments', () => {
  it('GET returns the middleware error when blocked', async () => {
    blocked();
    const program = await newProgram();
    expect((await listEnrollmentsRoute(authed(`${base()}/${program.id}/enrollments`, { method: 'GET' }, adminToken), enrollCtx(orgId, program.id))).status).toBe(403);
  });

  it('GET returns 403 for a non-admin', async () => {
    const program = await newProgram();
    expect((await listEnrollmentsRoute(authed(`${base()}/${program.id}/enrollments`, { method: 'GET' }, outsiderToken), enrollCtx(orgId, program.id))).status).toBe(403);
  });

  it('GET returns 404 for an org the caller does not own', async () => {
    const program = await newProgram();
    expect((await listEnrollmentsRoute(authed(`${base()}/${program.id}/enrollments`, { method: 'GET' }, adminToken), enrollCtx('org-missing', program.id))).status).toBe(404);
  });

  it('GET returns 404 for an unknown program', async () => {
    expect((await listEnrollmentsRoute(authed(`${base()}/prog-missing/enrollments`, { method: 'GET' }, adminToken), enrollCtx(orgId, 'prog-missing'))).status).toBe(404);
  });

  it('enrolls a member and reports participation', async () => {
    const program = await newProgram();
    const enrolled = await enrollRoute(authed(`${base()}/${program.id}/enrollments`, jsonBody({ address: MEMBER }), adminToken), enrollCtx(orgId, program.id));
    expect(enrolled.status).toBe(201);
    expect((await enrolled.json()).data.memberAddress).toBe(MEMBER);

    const list = await listEnrollmentsRoute(authed(`${base()}/${program.id}/enrollments`, { method: 'GET' }, adminToken), enrollCtx(orgId, program.id));
    const body = await list.json();
    expect(body.data.enrollments).toHaveLength(1);
    expect(body.data.participation.activeEnrollments).toBe(1);
  });

  it('POST returns the middleware error when blocked', async () => {
    blocked();
    const program = await newProgram();
    expect((await enrollRoute(authed(`${base()}/${program.id}/enrollments`, jsonBody({ address: MEMBER }), adminToken), enrollCtx(orgId, program.id))).status).toBe(403);
  });

  it('POST returns 404 for an unknown program', async () => {
    expect((await enrollRoute(authed(`${base()}/prog-missing/enrollments`, jsonBody({ address: MEMBER }), adminToken), enrollCtx(orgId, 'prog-missing'))).status).toBe(404);
  });

  it('POST returns 422 for an invalid member address', async () => {
    const program = await newProgram();
    expect((await enrollRoute(authed(`${base()}/${program.id}/enrollments`, jsonBody({ address: 'not-an-address' }), adminToken), enrollCtx(orgId, program.id))).status).toBe(422);
  });

  it('POST throws on an invalid JSON body', async () => {
    const program = await newProgram();
    await expect(enrollRoute(authed(`${base()}/${program.id}/enrollments`, jsonBody('not-json'), adminToken), enrollCtx(orgId, program.id))).rejects.toThrow();
  });
});

describe('.../enrollments/[address] (progress & withdraw)', () => {
  async function seed(): Promise<string> {
    const program = await newProgram();
    await enrollMember(program.id, MEMBER);
    return program.id;
  }
  const url = (programId: string) => `${base()}/${programId}/enrollments/${MEMBER}`;

  it('PATCH returns the middleware error when blocked', async () => {
    blocked();
    const programId = await seed();
    expect((await progressRoute(authed(url(programId), jsonPatch({ progress: 50 }), adminToken), memberCtx(orgId, programId, MEMBER))).status).toBe(403);
  });

  it('PATCH returns 403 for a non-admin', async () => {
    const programId = await seed();
    expect((await progressRoute(authed(url(programId), jsonPatch({ progress: 50 }), outsiderToken), memberCtx(orgId, programId, MEMBER))).status).toBe(403);
  });

  it('PATCH returns 400 for an invalid member address', async () => {
    const programId = await seed();
    expect((await progressRoute(authed(url(programId), jsonPatch({ progress: 50 }), adminToken), memberCtx(orgId, programId, 'bad'))).status).toBe(400);
  });

  it('PATCH returns 404 for an org the caller does not own', async () => {
    const programId = await seed();
    expect((await progressRoute(authed(url(programId), jsonPatch({ progress: 50 }), adminToken), memberCtx('org-missing', programId, MEMBER))).status).toBe(404);
  });

  it('PATCH returns 404 for an unknown program', async () => {
    expect((await progressRoute(authed(url('prog-missing'), jsonPatch({ progress: 50 }), adminToken), memberCtx(orgId, 'prog-missing', MEMBER))).status).toBe(404);
  });

  it('PATCH returns 404 for a member not enrolled', async () => {
    const program = await newProgram(); // no enrollment
    expect((await progressRoute(authed(url(program.id), jsonPatch({ progress: 50 }), adminToken), memberCtx(orgId, program.id, MEMBER))).status).toBe(404);
  });

  it('PATCH records progress', async () => {
    const programId = await seed();
    const res = await progressRoute(authed(url(programId), jsonPatch({ progress: 75 }), adminToken), memberCtx(orgId, programId, MEMBER));
    expect(res.status).toBe(200);
    expect((await res.json()).data.progress).toBe(75);
  });

  it('PATCH returns 422 for an out-of-range progress', async () => {
    const programId = await seed();
    expect((await progressRoute(authed(url(programId), jsonPatch({ progress: 150 }), adminToken), memberCtx(orgId, programId, MEMBER))).status).toBe(422);
  });

  it('PATCH throws on an invalid JSON body', async () => {
    const programId = await seed();
    await expect(progressRoute(authed(url(programId), jsonPatch('not-json'), adminToken), memberCtx(orgId, programId, MEMBER))).rejects.toThrow();
  });

  it('DELETE withdraws a member', async () => {
    const programId = await seed();
    const res = await withdrawRoute(authed(url(programId), { method: 'DELETE' }, adminToken), memberCtx(orgId, programId, MEMBER));
    expect(res.status).toBe(200);
    expect((await res.json()).data.status).toBe('withdrawn');
  });

  it('DELETE returns the middleware error when blocked', async () => {
    blocked();
    const programId = await seed();
    expect((await withdrawRoute(authed(url(programId), { method: 'DELETE' }, adminToken), memberCtx(orgId, programId, MEMBER))).status).toBe(403);
  });

  it('DELETE returns 404 for a member not enrolled', async () => {
    const program = await newProgram();
    expect((await withdrawRoute(authed(url(program.id), { method: 'DELETE' }, adminToken), memberCtx(orgId, program.id, MEMBER))).status).toBe(404);
  });

  it('DELETE returns 403 for a non-admin', async () => {
    const programId = await seed();
    expect((await withdrawRoute(authed(url(programId), { method: 'DELETE' }, outsiderToken), memberCtx(orgId, programId, MEMBER))).status).toBe(403);
  });
});

describe('/api/employer/organizations/[id]/wellness-analytics', () => {
  it('returns the middleware error when blocked', async () => {
    blocked();
    expect((await analyticsRoute(authed(`${orgUrl()}/wellness-analytics`, { method: 'GET' }, adminToken), progCtx(orgId))).status).toBe(403);
  });

  it('returns 403 for a non-admin', async () => {
    expect((await analyticsRoute(authed(`${orgUrl()}/wellness-analytics`, { method: 'GET' }, outsiderToken), progCtx(orgId))).status).toBe(403);
  });

  it('returns 404 for an org the caller does not own', async () => {
    expect((await analyticsRoute(authed(`${orgUrl()}/wellness-analytics`, { method: 'GET' }, adminToken), progCtx('org-missing'))).status).toBe(404);
  });

  it('aggregates participation across the org\'s programs', async () => {
    const program = await newProgram();
    await enrollMember(program.id, MEMBER);

    const res = await analyticsRoute(authed(`${orgUrl()}/wellness-analytics`, { method: 'GET' }, adminToken), progCtx(orgId));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.programCount).toBe(1);
    expect(body.data.totalActiveEnrollments).toBe(1);
  });
});
