/** @jest-environment node */

jest.mock('@/lib/api/middleware', () => {
  const actual = jest.requireActual('@/lib/api/middleware');
  return { ...actual, runMiddleware: jest.fn((...args: unknown[]) => actual.runMiddleware(...args)) };
});

import { NextRequest, NextResponse } from 'next/server';
import { runMiddleware } from '@/lib/api/middleware';
import { GET as researchGet, POST as researchPost } from '@/app/api/research/data-requests/route';
import { GET as researchGrants } from '@/app/api/research/data-requests/grants/route';
import { GET as govGet } from '@/app/api/governance/data-requests/route';
import { PATCH as govPatch } from '@/app/api/governance/data-requests/[id]/route';
import { createDataRequest, decideDataRequest, __resetDataRequestsForTests } from '@/lib/api/data-access-service';
import {
  buildMarketplaceListingFromInput,
  createMarketplaceListing,
  __resetMarketplaceForTests,
} from '@/lib/api/marketplace-service';
import { assignRole, __resetRolesForTests } from '@/lib/api/roles-service';
import { createSessionToken } from '@/lib/api/session';
import { seededAddress } from '@/lib/utils';

const mockedRunMiddleware = runMiddleware as jest.MockedFunction<typeof runMiddleware>;
const RESEARCHER = seededAddress(900);
const STEWARD = seededAddress(902);
const OUTSIDER = seededAddress(905); // default 'individual' — lacks both capabilities
const researcherToken = createSessionToken(RESEARCHER).token;
const stewardToken = createSessionToken(STEWARD).token;
const outsiderToken = createSessionToken(OUTSIDER).token;

let listingId: string;

beforeEach(async () => {
  __resetDataRequestsForTests();
  __resetMarketplaceForTests();
  __resetRolesForTests();
  await assignRole(RESEARCHER, 'researcher');
  await assignRole(STEWARD, 'government');
  const listing = await createMarketplaceListing(buildMarketplaceListingFromInput({
    seller: seededAddress(950), category: 'lab_results', title: 'Lab Cohort', description: 'desc',
    price: 50, expirationDays: 30, anonymizationLevel: 'differential-privacy',
  }));
  listingId = listing.id;
});

afterEach(() => {
  mockedRunMiddleware.mockImplementation((...args: unknown[]) => {
    const actual = jest.requireActual('@/lib/api/middleware');
    return actual.runMiddleware(...args);
  });
});

const RESEARCH = 'http://localhost:3000/api/research/data-requests';
const GOV = 'http://localhost:3000/api/governance/data-requests';

function authed(url: string, init: RequestInit, token?: string): NextRequest {
  const headers: Record<string, string> = { ...(init.headers as Record<string, string>) };
  if (token) headers.authorization = `Bearer ${token}`;
  return new NextRequest(url, { ...init, headers });
}

function jsonBody(body: unknown, method = 'POST'): RequestInit {
  return { method, headers: { 'Content-Type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body) };
}

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

const blocked = () => mockedRunMiddleware.mockResolvedValueOnce(NextResponse.json({ error: 'blocked' }, { status: 403 }));

describe('/api/research/data-requests', () => {
  it('GET returns the middleware error when blocked', async () => {
    blocked();
    expect((await researchGet(authed(RESEARCH, { method: 'GET' }, researcherToken))).status).toBe(403);
  });

  it('GET returns 403 for a non-researcher', async () => {
    expect((await researchGet(authed(RESEARCH, { method: 'GET' }, outsiderToken))).status).toBe(403);
  });

  it('GET lists the researcher\'s own requests (empty to start)', async () => {
    const res = await researchGet(authed(RESEARCH, { method: 'GET' }, researcherToken));
    expect(res.status).toBe(200);
    expect((await res.json()).data.total).toBe(0);
  });

  it('POST returns the middleware error when blocked', async () => {
    blocked();
    expect((await researchPost(authed(RESEARCH, jsonBody({ listingId, purpose: 'study' }), researcherToken))).status).toBe(403);
  });

  it('POST returns 403 for a non-researcher', async () => {
    expect((await researchPost(authed(RESEARCH, jsonBody({ listingId, purpose: 'study' }), outsiderToken))).status).toBe(403);
  });

  it('POST returns 404 for an unknown listing', async () => {
    expect((await researchPost(authed(RESEARCH, jsonBody({ listingId: 'listing-missing', purpose: 'study' }), researcherToken))).status).toBe(404);
  });

  it('POST returns 422 for an invalid body', async () => {
    expect((await researchPost(authed(RESEARCH, jsonBody({ listingId: '', purpose: '' }), researcherToken))).status).toBe(422);
  });

  it('POST creates a request that the researcher then lists', async () => {
    const created = await researchPost(authed(RESEARCH, jsonBody({ listingId, purpose: 'cohort study' }), researcherToken));
    expect(created.status).toBe(201);
    expect((await created.json()).data.status).toBe('pending');

    const list = await researchGet(authed(RESEARCH, { method: 'GET' }, researcherToken));
    expect((await list.json()).data.total).toBe(1);
  });

  it('POST throws on an invalid JSON body', async () => {
    await expect(researchPost(authed(RESEARCH, jsonBody('not-json'), researcherToken))).rejects.toThrow();
  });
});

describe('/api/governance/data-requests', () => {
  it('GET returns the middleware error when blocked', async () => {
    blocked();
    expect((await govGet(authed(GOV, { method: 'GET' }, stewardToken))).status).toBe(403);
  });

  it('GET returns 403 for a non-steward', async () => {
    expect((await govGet(authed(GOV, { method: 'GET' }, outsiderToken))).status).toBe(403);
  });

  it('GET lists all requests and supports a status filter', async () => {
    await createDataRequest(RESEARCHER, listingId, 'study');

    const all = await govGet(authed(GOV, { method: 'GET' }, stewardToken));
    const allBody = await all.json();
    expect(allBody.data.total).toBe(1);
    expect(allBody.data.summary.pending).toBe(1); // governance dashboard counts

    const pending = await govGet(authed(`${GOV}?status=pending`, { method: 'GET' }, stewardToken));
    expect((await pending.json()).data.total).toBe(1);

    const approved = await govGet(authed(`${GOV}?status=approved`, { method: 'GET' }, stewardToken));
    expect((await approved.json()).data.total).toBe(0);
  });
});

describe('/api/governance/data-requests/[id]', () => {
  it('PATCH returns the middleware error when blocked', async () => {
    blocked();
    expect((await govPatch(authed(`${GOV}/x`, jsonBody({ decision: 'approve' }, 'PATCH'), stewardToken), ctx('x'))).status).toBe(403);
  });

  it('PATCH returns 403 for a non-steward', async () => {
    expect((await govPatch(authed(`${GOV}/x`, jsonBody({ decision: 'approve' }, 'PATCH'), outsiderToken), ctx('x'))).status).toBe(403);
  });

  it('PATCH returns 404 for an unknown request', async () => {
    expect((await govPatch(authed(`${GOV}/nope`, jsonBody({ decision: 'approve' }, 'PATCH'), stewardToken), ctx('nope'))).status).toBe(404);
  });

  it('PATCH approves a pending request', async () => {
    const req = await createDataRequest(RESEARCHER, listingId, 'study');
    const res = await govPatch(authed(`${GOV}/${req.id}`, jsonBody({ decision: 'approve' }, 'PATCH'), stewardToken), ctx(req.id));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.status).toBe('approved');
    expect(body.data.decidedBy).toBe(STEWARD);
  });

  it('PATCH denies a pending request', async () => {
    const req = await createDataRequest(RESEARCHER, listingId, 'study');
    const res = await govPatch(authed(`${GOV}/${req.id}`, jsonBody({ decision: 'deny' }, 'PATCH'), stewardToken), ctx(req.id));
    expect((await res.json()).data.status).toBe('denied');
  });

  it('PATCH revokes an approved request', async () => {
    const req = await createDataRequest(RESEARCHER, listingId, 'study');
    await decideDataRequest(req.id, STEWARD, 'approved');
    const res = await govPatch(authed(`${GOV}/${req.id}`, jsonBody({ decision: 'revoke' }, 'PATCH'), stewardToken), ctx(req.id));
    expect(res.status).toBe(200);
    expect((await res.json()).data.status).toBe('revoked');
  });

  it('PATCH returns 404 when revoking a request that is not approved', async () => {
    const req = await createDataRequest(RESEARCHER, listingId, 'study'); // still pending
    expect((await govPatch(authed(`${GOV}/${req.id}`, jsonBody({ decision: 'revoke' }, 'PATCH'), stewardToken), ctx(req.id))).status).toBe(404);
  });

  it('PATCH returns 422 for an invalid decision', async () => {
    const req = await createDataRequest(RESEARCHER, listingId, 'study');
    expect((await govPatch(authed(`${GOV}/${req.id}`, jsonBody({ decision: 'maybe' }, 'PATCH'), stewardToken), ctx(req.id))).status).toBe(422);
  });

  it('PATCH throws on an invalid JSON body', async () => {
    const req = await createDataRequest(RESEARCHER, listingId, 'study');
    await expect(govPatch(authed(`${GOV}/${req.id}`, jsonBody('not-json', 'PATCH'), stewardToken), ctx(req.id))).rejects.toThrow();
  });
});

describe('/api/research/data-requests/grants', () => {
  const GRANTS = `${RESEARCH}/grants`;

  it('returns the middleware error when blocked', async () => {
    blocked();
    expect((await researchGrants(authed(GRANTS, { method: 'GET' }, researcherToken))).status).toBe(403);
  });

  it('returns 403 for a non-researcher', async () => {
    expect((await researchGrants(authed(GRANTS, { method: 'GET' }, outsiderToken))).status).toBe(403);
  });

  it('lists the researcher\'s active grants once a request is approved', async () => {
    const req = await createDataRequest(RESEARCHER, listingId, 'study');
    expect((await (await researchGrants(authed(GRANTS, { method: 'GET' }, researcherToken))).json()).data.total).toBe(0);

    await decideDataRequest(req.id, STEWARD, 'approved');
    const res = await researchGrants(authed(GRANTS, { method: 'GET' }, researcherToken));
    expect(res.status).toBe(200);
    expect((await res.json()).data.total).toBe(1);
  });
});
