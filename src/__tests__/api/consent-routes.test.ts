/** @jest-environment node */

jest.mock('@/lib/api/middleware', () => {
  const actual = jest.requireActual('@/lib/api/middleware');
  return { ...actual, runMiddleware: jest.fn((...args: unknown[]) => actual.runMiddleware(...args)) };
});

jest.mock('@/lib/api/consent-service', () => {
  const actual = jest.requireActual('@/lib/api/consent-service');
  return {
    ...actual,
    listConsents: jest.fn((...args: unknown[]) => actual.listConsents(...args)),
    updateConsent: jest.fn((...args: unknown[]) => actual.updateConsent(...args)),
  };
});

import { NextRequest, NextResponse } from 'next/server';
import { runMiddleware } from '@/lib/api/middleware';
import { listConsents as svcList, updateConsent as svcUpdate } from '@/lib/api/consent-service';

import { GET as listConsents, POST as createConsent } from '@/app/api/consent/route';
import { GET as getConsent, PATCH as patchConsent, DELETE as deleteConsent } from '@/app/api/consent/[id]/route';
import { GET as listPolicies } from '@/app/api/consent/policies/route';
import { createConsent as svcCreateConsent, __resetConsentForTests } from '@/lib/api/consent-service';
import { createSessionToken } from '@/lib/api/session';
import { seededAddress } from '@/lib/utils';
import type { ConsentGrant } from '@/types';

const mockedList = svcList as jest.MockedFunction<typeof svcList>;
const mockedUpdate = svcUpdate as jest.MockedFunction<typeof svcUpdate>;
const actualService = jest.requireActual('@/lib/api/consent-service');
const mockedRunMiddleware = runMiddleware as jest.MockedFunction<typeof runMiddleware>;

afterEach(() => {
  mockedRunMiddleware.mockImplementation((...args: unknown[]) => {
    const actual = jest.requireActual('@/lib/api/middleware');
    return actual.runMiddleware(...args);
  });
  mockedList.mockImplementation((...args: unknown[]) => actualService.listConsents(...args));
  mockedUpdate.mockImplementation((...args: unknown[]) => actualService.updateConsent(...args));
});

function authed(url: string, init: RequestInit, token: string): NextRequest {
  return new NextRequest(url, { ...init, headers: { ...(init.headers ?? {}), authorization: `Bearer ${token}` } });
}

interface ConsentPayload {
  providerName: string;
  providerAddress?: string;
  scopes: string[];
  durationDays: number;
  autoRenew?: boolean;
  policyId?: string;
}

async function postConsent(token: string, payload: ConsentPayload): Promise<{ id: string }> {
  const res = await createConsent(
    authed('http://localhost:3001/api/consent', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    }, token),
  );
  return (await res.json()).data;
}

describe('/api/consent middleware and auth guards', () => {
  const { token } = createSessionToken(seededAddress(111));

  it('GET returns the middleware error when blocked', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(NextResponse.json({ error: 'blocked' }, { status: 403 }));
    expect((await listConsents(authed('http://localhost:3001/api/consent', { method: 'GET' }, token))).status).toBe(403);
  });

  it('POST returns the middleware error when blocked', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(NextResponse.json({ error: 'blocked' }, { status: 403 }));
    expect((await createConsent(authed('http://localhost:3001/api/consent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }, token))).status).toBe(403);
  });

  it('GET [id] returns the middleware error when blocked', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(NextResponse.json({ error: 'blocked' }, { status: 403 }));
    expect((await getConsent(authed('http://localhost:3001/api/consent/c-x', { method: 'GET' }, token), { params: Promise.resolve({ id: 'c-x' }) })).status).toBe(403);
  });

  it('PATCH returns the middleware error when blocked', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(NextResponse.json({ error: 'blocked' }, { status: 403 }));
    expect((await patchConsent(authed('http://localhost:3001/api/consent/c-x', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: '{}' }, token), { params: Promise.resolve({ id: 'c-x' }) })).status).toBe(403);
  });

  it('DELETE returns the middleware error when blocked', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(NextResponse.json({ error: 'blocked' }, { status: 403 }));
    expect((await deleteConsent(authed('http://localhost:3001/api/consent/c-x', { method: 'DELETE' }, token), { params: Promise.resolve({ id: 'c-x' }) })).status).toBe(403);
  });

  it('GET returns 401 when inner requireAuth runs unauthenticated', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(null);
    expect((await listConsents(new NextRequest('http://localhost:3001/api/consent'))).status).toBe(401);
  });

  it('POST returns 401 when inner requireAuth runs unauthenticated', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(null);
    expect((await createConsent(new NextRequest('http://localhost:3001/api/consent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }))).status).toBe(401);
  });

  it('GET [id] returns 401 when inner requireAuth runs unauthenticated', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(null);
    expect((await getConsent(new NextRequest('http://localhost:3001/api/consent/c-x'), { params: Promise.resolve({ id: 'c-x' }) })).status).toBe(401);
  });

  it('PATCH returns 401 when inner requireAuth runs unauthenticated', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(null);
    expect((await patchConsent(new NextRequest('http://localhost:3001/api/consent/c-x', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: '{}' }), { params: Promise.resolve({ id: 'c-x' }) })).status).toBe(401);
  });

  it('DELETE returns 401 when inner requireAuth runs unauthenticated', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(null);
    expect((await deleteConsent(new NextRequest('http://localhost:3001/api/consent/c-x', { method: 'DELETE' }), { params: Promise.resolve({ id: 'c-x' }) })).status).toBe(401);
  });
});

describe('/api/consent list, filter, search', () => {
  const owner = seededAddress(222);
  const { token } = createSessionToken(owner);
  const provider2Addr = seededAddress(950);

  beforeAll(async () => {
    await postConsent(token, { providerName: 'Rivera Clinic', scopes: ['cycle_data', 'lab_results'], durationDays: 365 });
    await postConsent(token, { providerName: 'North Health', providerAddress: provider2Addr, scopes: ['imaging'], durationDays: 30 });
  });

  it('starts empty for a brand-new wallet', async () => {
    const fresh = createSessionToken(seededAddress(998));
    const res = await listConsents(authed('http://localhost:3001/api/consent', { method: 'GET' }, fresh.token));
    expect((await res.json()).data.items).toEqual([]);
  });

  it('lists consents with pagination metadata', async () => {
    const res = await listConsents(authed('http://localhost:3001/api/consent?limit=100', { method: 'GET' }, token));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.items.length).toBeGreaterThanOrEqual(2);
    expect(body.data.total).toBeGreaterThanOrEqual(2);
  });

  it('clamps an out-of-range page to the last page', async () => {
    const res = await listConsents(authed('http://localhost:3001/api/consent?page=99&limit=1', { method: 'GET' }, token));
    const body = await res.json();
    expect(body.data.page).toBe(body.data.totalPages);
  });

  it('filters by status', async () => {
    const res = await listConsents(authed('http://localhost:3001/api/consent?status=active&limit=100', { method: 'GET' }, token));
    const body = await res.json();
    body.data.items.forEach((c: { status: string }) => expect(c.status).toBe('active'));
  });

  it('filters by scope', async () => {
    const res = await listConsents(authed('http://localhost:3001/api/consent?scope=cycle_data&limit=100', { method: 'GET' }, token));
    const body = await res.json();
    expect(body.data.items.length).toBe(1);
    body.data.items.forEach((c: { scopes: string[] }) => expect(c.scopes).toContain('cycle_data'));
  });

  it('searches by provider name', async () => {
    const res = await listConsents(authed('http://localhost:3001/api/consent?search=rivera&limit=100', { method: 'GET' }, token));
    const body = await res.json();
    expect(body.data.items.length).toBe(1);
    expect(body.data.items[0].providerName).toBe('Rivera Clinic');
  });

  it('searches by provider address when the name does not match', async () => {
    const res = await listConsents(authed(`http://localhost:3001/api/consent?search=${provider2Addr.slice(0, 12)}&limit=100`, { method: 'GET' }, token));
    const body = await res.json();
    expect(body.data.items.length).toBe(1);
    expect(body.data.items[0].providerName).toBe('North Health');
  });

  it('returns nothing when the search matches no field', async () => {
    const res = await listConsents(authed('http://localhost:3001/api/consent?search=zzznomatch&limit=100', { method: 'GET' }, token));
    expect((await res.json()).data.items).toEqual([]);
  });

  it('returns 422 for invalid query params', async () => {
    expect((await listConsents(authed('http://localhost:3001/api/consent?page=-1', { method: 'GET' }, token))).status).toBe(422);
  });

  it('re-throws a non-Zod error from the datastore', async () => {
    mockedList.mockImplementationOnce(() => { throw new Error('DB down'); });
    await expect(listConsents(authed('http://localhost:3001/api/consent', { method: 'GET' }, token))).rejects.toThrow('DB down');
  });
});

describe('/api/consent create', () => {
  const { token } = createSessionToken(seededAddress(333));

  it('creates a consent (201, active)', async () => {
    const res = await createConsent(
      authed('http://localhost:3001/api/consent', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerName: 'Dr. Chen', scopes: ['full_access'], durationDays: 90, autoRenew: true }),
      }, token),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.status).toBe('active');
    expect(body.data.autoRenew).toBe(true);
  });

  it('returns 422 for an invalid create body', async () => {
    const res = await createConsent(
      authed('http://localhost:3001/api/consent', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerName: '', scopes: [] }),
      }, token),
    );
    expect(res.status).toBe(422);
  });

  it('returns 500 on an invalid JSON body (non-Zod error)', async () => {
    const res = await createConsent(
      authed('http://localhost:3001/api/consent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: 'not-json' }, token),
    );
    expect(res.status).toBe(500);
  });
});

describe('/api/consent/[id] detail, modify, revoke', () => {
  const owner = seededAddress(444);
  const { token } = createSessionToken(owner);
  let consentId: string;

  beforeAll(async () => {
    const c = await postConsent(token, { providerName: 'Main Provider', scopes: ['cycle_data'], durationDays: 365 });
    consentId = c.id;
  });

  it('GET returns the consent detail', async () => {
    const res = await getConsent(authed(`http://localhost:3001/api/consent/${consentId}`, { method: 'GET' }, token), { params: Promise.resolve({ id: consentId }) });
    expect(res.status).toBe(200);
    expect((await res.json()).data.id).toBe(consentId);
  });

  it('GET returns 404 for a missing consent', async () => {
    const res = await getConsent(authed('http://localhost:3001/api/consent/c-missing', { method: 'GET' }, token), { params: Promise.resolve({ id: 'c-missing' }) });
    expect(res.status).toBe(404);
  });

  it('PATCH updates the scopes', async () => {
    const res = await patchConsent(authed(`http://localhost:3001/api/consent/${consentId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scopes: ['cycle_data', 'vitals'] }) }, token), { params: Promise.resolve({ id: consentId }) });
    expect(res.status).toBe(200);
    expect((await res.json()).data.scopes).toEqual(['cycle_data', 'vitals']);
  });

  it('PATCH updates the duration', async () => {
    const res = await patchConsent(authed(`http://localhost:3001/api/consent/${consentId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ durationDays: 30 }) }, token), { params: Promise.resolve({ id: consentId }) });
    expect(res.status).toBe(200);
  });

  it('PATCH returns 422 for an invalid body', async () => {
    const res = await patchConsent(authed(`http://localhost:3001/api/consent/${consentId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scopes: ['invalid_scope'] }) }, token), { params: Promise.resolve({ id: consentId }) });
    expect(res.status).toBe(422);
  });

  it('PATCH returns 500 on an invalid JSON body (non-Zod error)', async () => {
    const res = await patchConsent(authed(`http://localhost:3001/api/consent/${consentId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: 'not-json' }, token), { params: Promise.resolve({ id: consentId }) });
    expect(res.status).toBe(500);
  });

  it('PATCH returns 404 for a missing consent', async () => {
    const res = await patchConsent(authed('http://localhost:3001/api/consent/c-missing', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scopes: ['vitals'] }) }, token), { params: Promise.resolve({ id: 'c-missing' }) });
    expect(res.status).toBe(404);
  });

  it('PATCH returns 404 when the datastore update returns nothing', async () => {
    mockedUpdate.mockResolvedValueOnce(undefined);
    const res = await patchConsent(authed(`http://localhost:3001/api/consent/${consentId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scopes: ['vitals'] }) }, token), { params: Promise.resolve({ id: consentId }) });
    expect(res.status).toBe(404);
  });

  it('DELETE returns 404 for a missing consent', async () => {
    const res = await deleteConsent(authed('http://localhost:3001/api/consent/c-missing', { method: 'DELETE' }, token), { params: Promise.resolve({ id: 'c-missing' }) });
    expect(res.status).toBe(404);
  });

  it('DELETE returns 404 when the datastore update returns nothing', async () => {
    mockedUpdate.mockResolvedValueOnce(undefined);
    const res = await deleteConsent(authed(`http://localhost:3001/api/consent/${consentId}`, { method: 'DELETE' }, token), { params: Promise.resolve({ id: consentId }) });
    expect(res.status).toBe(404);
  });

  it('DELETE revokes a consent, after which modify is rejected', async () => {
    const c = await postConsent(token, { providerName: 'Revoke Me', scopes: ['vitals'], durationDays: 90 });

    const revoke = await deleteConsent(authed(`http://localhost:3001/api/consent/${c.id}`, { method: 'DELETE' }, token), { params: Promise.resolve({ id: c.id }) });
    expect(revoke.status).toBe(200);
    expect((await revoke.json()).data.status).toBe('revoked');

    const modify = await patchConsent(authed(`http://localhost:3001/api/consent/${c.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scopes: ['vitals'] }) }, token), { params: Promise.resolve({ id: c.id }) });
    expect(modify.status).toBe(400);
  });
});

describe('/api/consent/policies', () => {
  it('lists the consent policy templates', async () => {
    const res = await listPolicies();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(5);
    expect(body.data[0]).toHaveProperty('maxDurationDays');
  });
});

describe('/api/consent expiry reconciliation', () => {
  const owner = seededAddress(777);
  const { token } = createSessionToken(owner);

  beforeEach(() => __resetConsentForTests());
  afterEach(() => __resetConsentForTests());

  function seedLapsed(id: string, overrides: Partial<ConsentGrant> = {}): Promise<ConsentGrant> {
    return svcCreateConsent(owner, {
      id, patientAddress: owner, providerAddress: seededAddress(778), providerName: 'Lapsed Clinic',
      scopes: ['cycle_data'], status: 'active', grantedAt: Date.now() - 100_000,
      expiresAt: Date.now() - 1000, txHash: '0x', attestation: 'att', policyId: 'policy-0',
      autoRenew: false, ...overrides,
    });
  }

  it('list GET reflects expiry: a lapsed active consent shows as expired', async () => {
    await seedLapsed('exp-1');
    const res = await listConsents(authed('http://localhost:3001/api/consent', { method: 'GET' }, token));
    expect(res.status).toBe(200);
    const items = (await res.json()).data.items as ConsentGrant[];
    expect(items.find((c) => c.id === 'exp-1')?.status).toBe('expired');
  });

  it('detail GET reflects expiry', async () => {
    await seedLapsed('exp-2');
    const res = await getConsent(
      authed('http://localhost:3001/api/consent/exp-2', { method: 'GET' }, token),
      { params: Promise.resolve({ id: 'exp-2' }) },
    );
    expect(res.status).toBe(200);
    expect((await res.json()).data.status).toBe('expired');
  });

  it('PATCH rejects a time-expired consent as non-modifiable', async () => {
    await seedLapsed('exp-3');
    const res = await patchConsent(
      authed('http://localhost:3001/api/consent/exp-3', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ durationDays: 30 }),
      }, token),
      { params: Promise.resolve({ id: 'exp-3' }) },
    );
    expect(res.status).toBe(400);
  });

  it('list GET auto-renews a lapsed consent when autoRenew is set', async () => {
    await seedLapsed('exp-4', { autoRenew: true });
    const res = await listConsents(authed('http://localhost:3001/api/consent', { method: 'GET' }, token));
    const item = ((await res.json()).data.items as ConsentGrant[]).find((c) => c.id === 'exp-4');
    expect(item?.status).toBe('active');
    expect(item?.expiresAt).toBeGreaterThan(Date.now());
  });
});
