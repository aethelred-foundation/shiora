/** @jest-environment node */

import { NextRequest } from 'next/server';
import { GET as listConsents, POST as createConsent } from '@/app/api/consent/route';
import {
  GET as getConsent,
  PATCH as patchConsent,
  DELETE as deleteConsent,
} from '@/app/api/consent/[id]/route';
import { GET as getPolicies } from '@/app/api/consent/policies/route';
import { createSessionToken } from '@/lib/api/session';
import { seededAddress } from '@/lib/utils';

const actualStore = jest.requireActual('@/lib/api/store');
const actualMiddleware = jest.requireActual('@/lib/api/middleware');
const actualValidation = jest.requireActual('@/lib/api/validation');

jest.mock('@/lib/api/store', () => {
  const actual = jest.requireActual('@/lib/api/store');
  return {
    __esModule: true,
    ...actual,
    updateConsent: jest.fn((...args: unknown[]) => actual.updateConsent(...args)),
    listConsents: jest.fn((...args: unknown[]) => actual.listConsents(...args)),
  };
});

jest.mock('@/lib/api/middleware', () => {
  const actual = jest.requireActual('@/lib/api/middleware');
  return {
    __esModule: true,
    ...actual,
    runMiddleware: jest.fn((...args: unknown[]) => actual.runMiddleware(...args)),
  };
});

import { updateConsent, listConsents as storeListConsents } from '@/lib/api/store';
import { runMiddleware } from '@/lib/api/middleware';
const mockedUpdateConsent = updateConsent as jest.MockedFunction<typeof updateConsent>;
const mockedStoreListConsents = storeListConsents as jest.MockedFunction<typeof storeListConsents>;
const mockedRunMiddleware = runMiddleware as jest.MockedFunction<typeof runMiddleware>;

afterEach(() => {
  mockedUpdateConsent.mockImplementation((...args: unknown[]) =>
    actualStore.updateConsent(...args),
  );
  mockedStoreListConsents.mockImplementation((...args: unknown[]) =>
    actualStore.listConsents(...args),
  );
  mockedRunMiddleware.mockImplementation((...args: unknown[]) =>
    actualMiddleware.runMiddleware(...args),
  );
});

const addr = seededAddress(6666);
const { token } = createSessionToken(addr);

function authed(url: string, init?: RequestInit): NextRequest {
  return new NextRequest(url, {
    ...init,
    headers: { ...(init?.headers ?? {}), authorization: `Bearer ${token}` },
  });
}

describe('/api/consent', () => {
  let consentId: string;

  it('GET lists consents (initially empty for new address)', async () => {
    const res = await listConsents(authed('http://localhost:3000/api/consent'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
  });

  it('GET returns 401 for unauthenticated', async () => {
    const res = await listConsents(new NextRequest('http://localhost:3000/api/consent'));
    expect(res.status).toBe(401);
  });

  it('POST creates a new consent', async () => {
    const res = await createConsent(
      authed('http://localhost:3000/api/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerName: 'Dr. Smith',
          scopes: ['lab_results', 'vitals'],
          durationDays: 90,
          autoRenew: false,
        }),
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.providerName).toBe('Dr. Smith');
    expect(body.data.status).toBe('active');
    consentId = body.data.id;
  });

  it('POST returns validation error for empty body', async () => {
    const res = await createConsent(
      authed('http://localhost:3000/api/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }),
    );
    expect(res.status).toBe(422);
  });

  it('GET filters consents by status', async () => {
    // First create a consent so there is data
    await createConsent(
      authed('http://localhost:3000/api/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerName: 'Dr. StatusFilter',
          scopes: ['vitals'],
          durationDays: 30,
          autoRenew: false,
        }),
      }),
    );
    const res = await listConsents(authed('http://localhost:3000/api/consent?status=active'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    body.data.items.forEach((c: { status: string }) => {
      expect(c.status).toBe('active');
    });
  });

  it('GET filters consents by scope', async () => {
    const res = await listConsents(authed('http://localhost:3000/api/consent?scope=vitals'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    body.data.items.forEach((c: { scopes: string[] }) => {
      expect(c.scopes).toContain('vitals');
    });
  });

  it('GET filters consents by search query', async () => {
    const res = await listConsents(authed('http://localhost:3000/api/consent?search=StatusFilter'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('GET returns 422 for invalid query params (ZodError)', async () => {
    const res = await listConsents(authed('http://localhost:3000/api/consent?page=abc'));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('POST returns 500 for non-JSON body (internal error)', async () => {
    const res = await createConsent(
      authed('http://localhost:3000/api/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not-json',
      }),
    );
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe('INTERNAL_ERROR');
  });

  it('GET returns 401 from inner requireAuth when middleware is bypassed', async () => {
    mockedRunMiddleware.mockReturnValueOnce(null);
    const res = await listConsents(new NextRequest('http://localhost:3000/api/consent'));
    expect(res.status).toBe(401);
  });

  it('POST returns middleware error when blocked', async () => {
    const { NextResponse } = require('next/server');
    mockedRunMiddleware.mockReturnValueOnce(
      NextResponse.json({ error: 'blocked' }, { status: 403 }),
    );
    const res = await createConsent(
      new NextRequest('http://localhost:3000/api/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerName: 'Dr. Blocked',
          scopes: ['vitals'],
          durationDays: 30,
          autoRenew: false,
        }),
      }),
    );
    expect(res.status).toBe(403);
  });

  it('POST returns 401 from inner requireAuth when middleware is bypassed', async () => {
    mockedRunMiddleware.mockReturnValueOnce(null);
    const res = await createConsent(
      new NextRequest('http://localhost:3000/api/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerName: 'Dr. Bypass',
          scopes: ['vitals'],
          durationDays: 30,
          autoRenew: false,
        }),
      }),
    );
    expect(res.status).toBe(401);
  });

  it('GET re-throws non-ZodError in catch block', async () => {
    mockedStoreListConsents.mockImplementationOnce(() => {
      throw new Error('Unexpected DB error in list');
    });
    await expect(listConsents(authed('http://localhost:3000/api/consent'))).rejects.toThrow(
      'Unexpected DB error in list',
    );
  });

  it('POST creates consent with providerAddress', async () => {
    const res = await createConsent(
      authed('http://localhost:3000/api/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerName: 'Dr. WithAddress',
          providerAddress: seededAddress(9999),
          scopes: ['vitals'],
          durationDays: 30,
          autoRenew: false,
          policyId: 'policy-custom',
        }),
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.providerAddress).toBe(seededAddress(9999));
    expect(body.data.policyId).toBe('policy-custom');
  });
});

describe('/api/consent/[id]', () => {
  let consentId: string;

  beforeAll(async () => {
    const res = await createConsent(
      authed('http://localhost:3000/api/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerName: 'Dr. Test',
          scopes: ['vitals'],
          durationDays: 30,
          autoRenew: false,
        }),
      }),
    );
    const body = await res.json();
    consentId = body.data.id;
  });

  it('GET returns a specific consent', async () => {
    const res = await getConsent(authed(`http://localhost:3000/api/consent/${consentId}`), {
      params: Promise.resolve({ id: consentId }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(consentId);
  });

  it('PATCH updates a consent', async () => {
    const res = await patchConsent(
      authed(`http://localhost:3000/api/consent/${consentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ durationDays: 60 }),
      }),
      { params: Promise.resolve({ id: consentId }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('DELETE revokes a consent', async () => {
    const res = await deleteConsent(
      authed(`http://localhost:3000/api/consent/${consentId}`, {
        method: 'DELETE',
      }),
      { params: Promise.resolve({ id: consentId }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('GET returns 401 for unauthenticated request', async () => {
    const res = await getConsent(new NextRequest('http://localhost:3000/api/consent/some-id'), {
      params: Promise.resolve({ id: 'some-id' }),
    });
    expect(res.status).toBe(401);
  });

  it('GET returns 404 for nonexistent consent', async () => {
    const res = await getConsent(authed('http://localhost:3000/api/consent/nonexistent'), {
      params: Promise.resolve({ id: 'nonexistent' }),
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('PATCH returns 401 for unauthenticated request', async () => {
    const res = await patchConsent(
      new NextRequest('http://localhost:3000/api/consent/some-id', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ durationDays: 60 }),
      }),
      { params: Promise.resolve({ id: 'some-id' }) },
    );
    expect(res.status).toBe(401);
  });

  it('PATCH returns 404 for nonexistent consent', async () => {
    const res = await patchConsent(
      authed('http://localhost:3000/api/consent/nonexistent', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ durationDays: 60 }),
      }),
      { params: Promise.resolve({ id: 'nonexistent' }) },
    );
    expect(res.status).toBe(404);
  });

  it('PATCH returns 422 for invalid body', async () => {
    // Create a fresh consent for this test
    const createRes = await createConsent(
      authed('http://localhost:3000/api/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerName: 'Dr. Validation',
          scopes: ['vitals'],
          durationDays: 30,
          autoRenew: false,
        }),
      }),
    );
    const createBody = await createRes.json();
    const freshId = createBody.data.id;

    const res = await patchConsent(
      authed(`http://localhost:3000/api/consent/${freshId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scopes: 'not-an-array' }),
      }),
      { params: Promise.resolve({ id: freshId }) },
    );
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('PATCH returns 400 for revoked consent', async () => {
    // Create and revoke a consent
    const createRes = await createConsent(
      authed('http://localhost:3000/api/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerName: 'Dr. Revoked',
          scopes: ['vitals'],
          durationDays: 30,
          autoRenew: false,
        }),
      }),
    );
    const createBody = await createRes.json();
    const revokedId = createBody.data.id;

    // Revoke it
    await deleteConsent(
      authed(`http://localhost:3000/api/consent/${revokedId}`, { method: 'DELETE' }),
      { params: Promise.resolve({ id: revokedId }) },
    );

    // Try to patch it
    const res = await patchConsent(
      authed(`http://localhost:3000/api/consent/${revokedId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ durationDays: 60 }),
      }),
      { params: Promise.resolve({ id: revokedId }) },
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_STATE');
  });

  it('DELETE returns 401 for unauthenticated request', async () => {
    const res = await deleteConsent(
      new NextRequest('http://localhost:3000/api/consent/some-id', { method: 'DELETE' }),
      { params: Promise.resolve({ id: 'some-id' }) },
    );
    expect(res.status).toBe(401);
  });

  it('DELETE returns 404 for nonexistent consent', async () => {
    const res = await deleteConsent(
      authed('http://localhost:3000/api/consent/nonexistent', { method: 'DELETE' }),
      { params: Promise.resolve({ id: 'nonexistent' }) },
    );
    expect(res.status).toBe(404);
  });

  it('PATCH returns 404 when updateConsent returns undefined (race condition)', async () => {
    // Create a consent to get a valid ID
    const createRes = await createConsent(
      authed('http://localhost:3000/api/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerName: 'Dr. RaceCondition',
          scopes: ['vitals'],
          durationDays: 30,
          autoRenew: false,
        }),
      }),
    );
    const createBody = await createRes.json();
    const raceId = createBody.data.id;

    // Mock updateConsent to return undefined (simulating concurrent deletion)
    mockedUpdateConsent.mockReturnValueOnce(undefined);

    const res = await patchConsent(
      authed(`http://localhost:3000/api/consent/${raceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ durationDays: 60 }),
      }),
      { params: Promise.resolve({ id: raceId }) },
    );
    expect(res.status).toBe(404);
    // afterEach handles restoration
  });

  it('PATCH returns 500 for non-JSON body (internal error)', async () => {
    // Create a consent to get a valid ID
    const createRes = await createConsent(
      authed('http://localhost:3000/api/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerName: 'Dr. InternalErr',
          scopes: ['vitals'],
          durationDays: 30,
          autoRenew: false,
        }),
      }),
    );
    const createBody = await createRes.json();
    const errId = createBody.data.id;

    const res = await patchConsent(
      authed(`http://localhost:3000/api/consent/${errId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: 'not-json',
      }),
      { params: Promise.resolve({ id: errId }) },
    );
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe('INTERNAL_ERROR');
  });

  it('DELETE returns 404 when updateConsent returns undefined (race condition)', async () => {
    // Create a consent
    const createRes = await createConsent(
      authed('http://localhost:3000/api/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerName: 'Dr. DeleteRace',
          scopes: ['vitals'],
          durationDays: 30,
          autoRenew: false,
        }),
      }),
    );
    const createBody = await createRes.json();
    const deleteRaceId = createBody.data.id;

    // Mock updateConsent to return undefined
    mockedUpdateConsent.mockReturnValueOnce(undefined);

    const res = await deleteConsent(
      authed(`http://localhost:3000/api/consent/${deleteRaceId}`, { method: 'DELETE' }),
      { params: Promise.resolve({ id: deleteRaceId }) },
    );
    expect(res.status).toBe(404);
    // afterEach handles restoration
  });

  it('GET returns 401 from inner requireAuth when middleware is bypassed', async () => {
    mockedRunMiddleware.mockReturnValueOnce(null);
    const res = await getConsent(new NextRequest('http://localhost:3000/api/consent/some-id'), {
      params: Promise.resolve({ id: 'some-id' }),
    });
    expect(res.status).toBe(401);
  });

  it('PATCH returns 401 from inner requireAuth when middleware is bypassed', async () => {
    mockedRunMiddleware.mockReturnValueOnce(null);
    const res = await patchConsent(
      new NextRequest('http://localhost:3000/api/consent/some-id', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ durationDays: 60 }),
      }),
      { params: Promise.resolve({ id: 'some-id' }) },
    );
    expect(res.status).toBe(401);
  });

  it('DELETE returns 401 from inner requireAuth when middleware is bypassed', async () => {
    mockedRunMiddleware.mockReturnValueOnce(null);
    const res = await deleteConsent(
      new NextRequest('http://localhost:3000/api/consent/some-id', { method: 'DELETE' }),
      { params: Promise.resolve({ id: 'some-id' }) },
    );
    expect(res.status).toBe(401);
  });

  it('PATCH updates scopes on a consent', async () => {
    const createRes = await createConsent(
      authed('http://localhost:3000/api/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerName: 'Dr. ScopePatch',
          scopes: ['vitals'],
          durationDays: 30,
          autoRenew: false,
        }),
      }),
    );
    const createBody = await createRes.json();
    const scopeId = createBody.data.id;

    const res = await patchConsent(
      authed(`http://localhost:3000/api/consent/${scopeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scopes: ['vitals', 'lab_results'] }),
      }),
      { params: Promise.resolve({ id: scopeId }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.scopes).toEqual(['vitals', 'lab_results']);
  });
});

describe('/api/consent/policies', () => {
  it('GET returns consent policies', async () => {
    const res = await getPolicies(authed('http://localhost:3000/api/consent/policies'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});
