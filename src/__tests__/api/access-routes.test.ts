/** @jest-environment node */

jest.mock('@/lib/api/middleware', () => {
  const actual = jest.requireActual('@/lib/api/middleware');
  return { ...actual, runMiddleware: jest.fn((...args: unknown[]) => actual.runMiddleware(...args)) };
});

jest.mock('@/lib/api/access-service', () => {
  const actual = jest.requireActual('@/lib/api/access-service');
  return {
    ...actual,
    listAccessGrants: jest.fn((...args: unknown[]) => actual.listAccessGrants(...args)),
    updateAccessGrant: jest.fn((...args: unknown[]) => actual.updateAccessGrant(...args)),
  };
});

jest.mock('@/lib/api/mock-data', () => {
  const actual = jest.requireActual('@/lib/api/mock-data');
  return { ...actual, generateMockAuditLog: jest.fn((...args: unknown[]) => actual.generateMockAuditLog(...args)) };
});

import { NextRequest, NextResponse } from 'next/server';
import { runMiddleware } from '@/lib/api/middleware';
import {
  listAccessGrants as svcList,
  updateAccessGrant as svcUpdate,
  createAccessGrant as svcCreate,
} from '@/lib/api/access-service';

import { GET as listGrants, POST as createGrant } from '@/app/api/access/route';
import { GET as getGrant, PATCH as patchGrant, DELETE as deleteGrant } from '@/app/api/access/[id]/route';
import { GET as listAudit } from '@/app/api/access/audit/route';
import { createSessionToken } from '@/lib/api/session';
import { seededAddress } from '@/lib/utils';
import { generateMockAuditLog } from '@/lib/api/mock-data';
import type { MockAccessGrant } from '@/lib/api/mock-data';

const mockedList = svcList as jest.MockedFunction<typeof svcList>;
const mockedUpdate = svcUpdate as jest.MockedFunction<typeof svcUpdate>;
const mockedAuditLog = generateMockAuditLog as jest.MockedFunction<typeof generateMockAuditLog>;
const actualService = jest.requireActual('@/lib/api/access-service');
const actualMockData = jest.requireActual('@/lib/api/mock-data');
const mockedRunMiddleware = runMiddleware as jest.MockedFunction<typeof runMiddleware>;

afterEach(() => {
  mockedRunMiddleware.mockImplementation((...args: unknown[]) => {
    const actual = jest.requireActual('@/lib/api/middleware');
    return actual.runMiddleware(...args);
  });
  mockedList.mockImplementation((...args: unknown[]) => actualService.listAccessGrants(...args));
  mockedUpdate.mockImplementation((...args: unknown[]) => actualService.updateAccessGrant(...args));
  mockedAuditLog.mockImplementation((...args: unknown[]) => actualMockData.generateMockAuditLog(...args));
});

function authed(url: string, init: RequestInit, token: string): NextRequest {
  return new NextRequest(url, { ...init, headers: { ...(init.headers ?? {}), authorization: `Bearer ${token}` } });
}

interface GrantPayload {
  provider: string;
  specialty: string;
  address: string;
  scope: string;
  durationDays: number;
  canView?: boolean;
  canDownload?: boolean;
  canShare?: boolean;
}

async function postGrant(token: string, payload: GrantPayload): Promise<{ id: string }> {
  const res = await createGrant(
    authed('http://localhost:3001/api/access', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    }, token),
  );
  return (await res.json()).data;
}

describe('/api/access middleware and auth guards', () => {
  const { token } = createSessionToken(seededAddress(111));

  it('GET returns the middleware error when blocked', async () => {
    mockedRunMiddleware.mockReturnValueOnce(NextResponse.json({ error: 'blocked' }, { status: 403 }));
    expect((await listGrants(authed('http://localhost:3001/api/access', { method: 'GET' }, token))).status).toBe(403);
  });

  it('POST returns the middleware error when blocked', async () => {
    mockedRunMiddleware.mockReturnValueOnce(NextResponse.json({ error: 'blocked' }, { status: 403 }));
    expect((await createGrant(authed('http://localhost:3001/api/access', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }, token))).status).toBe(403);
  });

  it('GET [id] returns the middleware error when blocked', async () => {
    mockedRunMiddleware.mockReturnValueOnce(NextResponse.json({ error: 'blocked' }, { status: 403 }));
    expect((await getGrant(authed('http://localhost:3001/api/access/grant-x', { method: 'GET' }, token), { params: Promise.resolve({ id: 'grant-x' }) })).status).toBe(403);
  });

  it('PATCH returns the middleware error when blocked', async () => {
    mockedRunMiddleware.mockReturnValueOnce(NextResponse.json({ error: 'blocked' }, { status: 403 }));
    expect((await patchGrant(authed('http://localhost:3001/api/access/grant-x', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: '{}' }, token), { params: Promise.resolve({ id: 'grant-x' }) })).status).toBe(403);
  });

  it('DELETE returns the middleware error when blocked', async () => {
    mockedRunMiddleware.mockReturnValueOnce(NextResponse.json({ error: 'blocked' }, { status: 403 }));
    expect((await deleteGrant(authed('http://localhost:3001/api/access/grant-x', { method: 'DELETE' }, token), { params: Promise.resolve({ id: 'grant-x' }) })).status).toBe(403);
  });

  it('GET returns 401 when inner requireAuth runs unauthenticated', async () => {
    mockedRunMiddleware.mockReturnValueOnce(null);
    expect((await listGrants(new NextRequest('http://localhost:3001/api/access'))).status).toBe(401);
  });

  it('POST returns 401 when inner requireAuth runs unauthenticated', async () => {
    mockedRunMiddleware.mockReturnValueOnce(null);
    expect((await createGrant(new NextRequest('http://localhost:3001/api/access', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }))).status).toBe(401);
  });

  it('GET [id] returns 401 when inner requireAuth runs unauthenticated', async () => {
    mockedRunMiddleware.mockReturnValueOnce(null);
    expect((await getGrant(new NextRequest('http://localhost:3001/api/access/grant-x'), { params: Promise.resolve({ id: 'grant-x' }) })).status).toBe(401);
  });

  it('PATCH returns 401 when inner requireAuth runs unauthenticated', async () => {
    mockedRunMiddleware.mockReturnValueOnce(null);
    expect((await patchGrant(new NextRequest('http://localhost:3001/api/access/grant-x', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: '{}' }), { params: Promise.resolve({ id: 'grant-x' }) })).status).toBe(401);
  });

  it('DELETE returns 401 when inner requireAuth runs unauthenticated', async () => {
    mockedRunMiddleware.mockReturnValueOnce(null);
    expect((await deleteGrant(new NextRequest('http://localhost:3001/api/access/grant-x', { method: 'DELETE' }), { params: Promise.resolve({ id: 'grant-x' }) })).status).toBe(401);
  });
});

describe('/api/access list, filter, search', () => {
  const owner = seededAddress(222);
  const { token } = createSessionToken(owner);

  beforeAll(async () => {
    await postGrant(token, { provider: 'Rivera Clinic', specialty: 'Cardiology', address: seededAddress(901), scope: 'Full Records', durationDays: 365 });
    await postGrant(token, { provider: 'North Imaging', specialty: 'Radiology', address: seededAddress(902), scope: 'Lab Results Only', durationDays: 30 });
  });

  it('starts empty for a brand-new wallet', async () => {
    const fresh = createSessionToken(seededAddress(999));
    const res = await listGrants(authed('http://localhost:3001/api/access', { method: 'GET' }, fresh.token));
    expect((await res.json()).data).toEqual([]);
  });

  it('lists grants with a status summary', async () => {
    const res = await listGrants(authed('http://localhost:3001/api/access?limit=100', { method: 'GET' }, token));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.length).toBeGreaterThanOrEqual(2);
    expect(body.meta.summary.pending).toBeGreaterThanOrEqual(2);
  });

  it('filters by status', async () => {
    const res = await listGrants(authed('http://localhost:3001/api/access?status=Pending&limit=100', { method: 'GET' }, token));
    const body = await res.json();
    body.data.forEach((g: { status: string }) => expect(g.status).toBe('Pending'));
  });

  it('searches by provider', async () => {
    const res = await listGrants(authed('http://localhost:3001/api/access?q=rivera&limit=100', { method: 'GET' }, token));
    const body = await res.json();
    expect(body.data.length).toBe(1);
    expect(body.data[0].provider).toBe('Rivera Clinic');
  });

  it('searches by specialty when provider does not match', async () => {
    const res = await listGrants(authed('http://localhost:3001/api/access?q=radiology&limit=100', { method: 'GET' }, token));
    const body = await res.json();
    expect(body.data.length).toBe(1);
    expect(body.data[0].specialty).toBe('Radiology');
  });

  it('searches by scope when provider and specialty do not match', async () => {
    const res = await listGrants(authed('http://localhost:3001/api/access?q=lab&limit=100', { method: 'GET' }, token));
    const body = await res.json();
    expect(body.data.length).toBe(1);
    expect(body.data[0].scope).toBe('Lab Results Only');
  });

  it('returns nothing when the search matches no field', async () => {
    const res = await listGrants(authed('http://localhost:3001/api/access?q=zzznomatch&limit=100', { method: 'GET' }, token));
    expect((await res.json()).data).toEqual([]);
  });

  it('returns 422 for invalid query params', async () => {
    expect((await listGrants(authed('http://localhost:3001/api/access?page=-1', { method: 'GET' }, token))).status).toBe(422);
  });

  it('re-throws a non-Zod error from the datastore', async () => {
    mockedList.mockImplementationOnce(() => { throw new Error('DB down'); });
    await expect(listGrants(authed('http://localhost:3001/api/access', { method: 'GET' }, token))).rejects.toThrow('DB down');
  });
});

describe('/api/access create', () => {
  const owner = seededAddress(333);
  const { token } = createSessionToken(owner);

  it('creates a grant (201, Pending)', async () => {
    const res = await createGrant(
      authed('http://localhost:3001/api/access', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'Dr. Chen', specialty: 'OB-GYN', address: seededAddress(910), scope: 'Full Records', durationDays: 90, canDownload: true }),
      }, token),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.status).toBe('Pending');
    expect(body.data.canDownload).toBe(true);
  });

  it('returns 422 for an invalid create body', async () => {
    const res = await createGrant(
      authed('http://localhost:3001/api/access', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'x', durationDays: 9999 }),
      }, token),
    );
    expect(res.status).toBe(422);
  });

  it('throws on an invalid JSON body (non-Zod error)', async () => {
    await expect(
      createGrant(authed('http://localhost:3001/api/access', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: 'not-json' }, token)),
    ).rejects.toThrow();
  });
});

describe('/api/access/[id] detail, modify, revoke', () => {
  const owner = seededAddress(444);
  const { token } = createSessionToken(owner);
  let grantId: string;
  let soonId: string;
  let expiredId: string;

  beforeAll(async () => {
    const g = await postGrant(token, { provider: 'Main Provider', specialty: 'OB-GYN', address: seededAddress(920), scope: 'Full Records', durationDays: 365 });
    grantId = g.id;
    const soon = await postGrant(token, { provider: 'Soon Provider', specialty: 'OB-GYN', address: seededAddress(921), scope: 'Full Records', durationDays: 3 });
    soonId = soon.id;

    // An already-expired grant (expiresAt in the past) created directly to cover
    // the daysRemaining=0 branch — no API path produces an expired grant.
    const expired: MockAccessGrant = {
      id: 'grant-expired-fixture', provider: 'Old Provider', specialty: 'OB-GYN',
      address: seededAddress(922), status: 'Pending', scope: 'Full Records',
      grantedAt: Date.now() - 400 * 86400000, expiresAt: Date.now() - 86400000,
      lastAccess: null, accessCount: 0, txHash: '0x', attestation: 'att',
      canView: true, canDownload: false, canShare: false, ownerAddress: owner,
    };
    await (actualService.createAccessGrant as typeof svcCreate)(owner, expired);
    expiredId = expired.id;
  });

  it('GET returns grant detail with permissions and a far-future expiry', async () => {
    const res = await getGrant(authed(`http://localhost:3001/api/access/${grantId}`, { method: 'GET' }, token), { params: Promise.resolve({ id: grantId }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.permissions.view).toBe(true);
    expect(body.data.isExpiringSoon).toBe(false);
    expect(body.data.blockchain.providerAddress).toBe(seededAddress(920));
  });

  it('GET flags a grant expiring within 7 days', async () => {
    const res = await getGrant(authed(`http://localhost:3001/api/access/${soonId}`, { method: 'GET' }, token), { params: Promise.resolve({ id: soonId }) });
    expect((await res.json()).data.isExpiringSoon).toBe(true);
  });

  it('GET reports zero days remaining for an expired grant', async () => {
    const res = await getGrant(authed(`http://localhost:3001/api/access/${expiredId}`, { method: 'GET' }, token), { params: Promise.resolve({ id: expiredId }) });
    const body = await res.json();
    expect(body.data.daysRemaining).toBe(0);
    expect(body.data.isExpiringSoon).toBe(false);
  });

  it('GET returns 404 for a missing grant', async () => {
    const res = await getGrant(authed('http://localhost:3001/api/access/grant-missing', { method: 'GET' }, token), { params: Promise.resolve({ id: 'grant-missing' }) });
    expect(res.status).toBe(404);
  });

  it('PATCH updates the scope', async () => {
    const res = await patchGrant(authed(`http://localhost:3001/api/access/${grantId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scope: 'Lab Results Only' }) }, token), { params: Promise.resolve({ id: grantId }) });
    expect(res.status).toBe(200);
    expect((await res.json()).data.scope).toBe('Lab Results Only');
  });

  it('PATCH updates permissions and duration', async () => {
    const res = await patchGrant(authed(`http://localhost:3001/api/access/${grantId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ canView: false, canDownload: true, canShare: true, durationDays: 30 }) }, token), { params: Promise.resolve({ id: grantId }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.canShare).toBe(true);
  });

  it('PATCH returns 422 for an invalid body', async () => {
    const res = await patchGrant(authed(`http://localhost:3001/api/access/${grantId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ durationDays: 9999 }) }, token), { params: Promise.resolve({ id: grantId }) });
    expect(res.status).toBe(422);
  });

  it('PATCH throws on an invalid JSON body (non-Zod error)', async () => {
    await expect(
      patchGrant(authed(`http://localhost:3001/api/access/${grantId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: 'not-json' }, token), { params: Promise.resolve({ id: grantId }) }),
    ).rejects.toThrow();
  });

  it('PATCH returns 404 for a missing grant', async () => {
    const res = await patchGrant(authed('http://localhost:3001/api/access/grant-missing', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scope: 'Full Records' }) }, token), { params: Promise.resolve({ id: 'grant-missing' }) });
    expect(res.status).toBe(404);
  });

  it('PATCH returns 404 when the datastore update returns nothing', async () => {
    mockedUpdate.mockResolvedValueOnce(undefined);
    const res = await patchGrant(authed(`http://localhost:3001/api/access/${grantId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scope: 'Full Records' }) }, token), { params: Promise.resolve({ id: grantId }) });
    expect(res.status).toBe(404);
  });

  it('DELETE returns 404 for a missing grant', async () => {
    const res = await deleteGrant(authed('http://localhost:3001/api/access/grant-missing', { method: 'DELETE' }, token), { params: Promise.resolve({ id: 'grant-missing' }) });
    expect(res.status).toBe(404);
  });

  it('DELETE returns 404 when the datastore update returns nothing', async () => {
    mockedUpdate.mockResolvedValueOnce(undefined);
    const res = await deleteGrant(authed(`http://localhost:3001/api/access/${grantId}`, { method: 'DELETE' }, token), { params: Promise.resolve({ id: grantId }) });
    expect(res.status).toBe(404);
  });

  it('DELETE revokes an active grant, then rejects a repeat revoke and any modify', async () => {
    const g = await postGrant(token, { provider: 'Revoke Me', specialty: 'OB-GYN', address: seededAddress(930), scope: 'Full Records', durationDays: 90 });

    const revoke = await deleteGrant(authed(`http://localhost:3001/api/access/${g.id}`, { method: 'DELETE' }, token), { params: Promise.resolve({ id: g.id }) });
    expect(revoke.status).toBe(200);
    expect((await revoke.json()).data.status).toBe('Revoked');

    const repeat = await deleteGrant(authed(`http://localhost:3001/api/access/${g.id}`, { method: 'DELETE' }, token), { params: Promise.resolve({ id: g.id }) });
    expect(repeat.status).toBe(409);

    const modify = await patchGrant(authed(`http://localhost:3001/api/access/${g.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scope: 'Full Records' }) }, token), { params: Promise.resolve({ id: g.id }) });
    expect(modify.status).toBe(409);
  });
});

describe('/api/access/audit log view', () => {
  const { token } = createSessionToken(seededAddress(555));

  it('returns the middleware error when blocked', async () => {
    mockedRunMiddleware.mockReturnValueOnce(NextResponse.json({ error: 'blocked' }, { status: 403 }));
    expect((await listAudit(authed('http://localhost:3001/api/access/audit', { method: 'GET' }, token))).status).toBe(403);
  });

  it('lists audit entries with type counts', async () => {
    const res = await listAudit(authed('http://localhost:3001/api/access/audit?limit=100', { method: 'GET' }, token));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.meta.typeCounts).toBeDefined();
  });

  it('filters by type', async () => {
    const res = await listAudit(authed('http://localhost:3001/api/access/audit?type=access&limit=100', { method: 'GET' }, token));
    const body = await res.json();
    body.data.forEach((e: { type: string }) => expect(e.type).toBe('access'));
  });

  it('filters by start and end date', async () => {
    const res = await listAudit(authed('http://localhost:3001/api/access/audit?startDate=2000-01-01&endDate=2100-01-01&limit=100', { method: 'GET' }, token));
    expect(res.status).toBe(200);
    expect((await res.json()).data.length).toBeGreaterThanOrEqual(0);
  });

  it('returns 422 for invalid query params', async () => {
    expect((await listAudit(authed('http://localhost:3001/api/access/audit?page=-1', { method: 'GET' }, token))).status).toBe(422);
  });

  it('re-throws a non-Zod error from the audit source', async () => {
    mockedAuditLog.mockImplementationOnce(() => { throw new Error('audit source down'); });
    await expect(listAudit(authed('http://localhost:3001/api/access/audit', { method: 'GET' }, token))).rejects.toThrow('audit source down');
  });
});
