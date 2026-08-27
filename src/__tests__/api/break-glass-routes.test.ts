/** @jest-environment node */

jest.mock('@/lib/api/middleware', () => {
  const actual = jest.requireActual('@/lib/api/middleware');
  return { ...actual, runMiddleware: jest.fn((...args: unknown[]) => actual.runMiddleware(...args)) };
});

import { NextRequest, NextResponse } from 'next/server';
import { runMiddleware, AUTH_RATE_LIMIT } from '@/lib/api/middleware';
import { POST as declare } from '@/app/api/break-glass/route';
import { GET as readRecords } from '@/app/api/break-glass/[id]/records/route';
import { GET as reviewQueue } from '@/app/api/break-glass/review/route';
import { POST as postReview } from '@/app/api/break-glass/[id]/review/route';
import { createSessionToken } from '@/lib/api/session';
import { mintStepUpAssertion, STEP_UP_HEADER } from '@/lib/api/step-up';
import {
  beginMfaEnrollment,
  confirmMfaEnrollment,
  __resetMfaForTests,
} from '@/lib/api/mfa-service';
import { totpCode } from '@/lib/api/totp';
import { assignRole, __resetRolesForTests } from '@/lib/api/roles-service';
import { createRecord, __resetRecordsForTests } from '@/lib/api/records-service';
import { listNotifications, __resetNotificationsForTests } from '@/lib/api/notification-service';
import { __resetBreakGlassForTests } from '@/lib/api/break-glass-service';
import { getAuditLog, __resetAuditLogForTests } from '@/lib/api/audit-log';
import { __resetRateLimiterForTests } from '@/lib/api/rate-limiter';
import type { MockHealthRecord } from '@/lib/api/mock-data';
import { seededAddress } from '@/lib/utils';

const mockedRunMiddleware = runMiddleware as jest.MockedFunction<typeof runMiddleware>;
const BASE = 'http://localhost:3000/api/break-glass';

const PROVIDER = seededAddress(7401);
const OTHER_PROVIDER = seededAddress(7402);
const PATIENT = seededAddress(7403);
const ADMIN = seededAddress(7404);

const PROVIDER_TOKEN = createSessionToken(PROVIDER).token;
const OTHER_PROVIDER_TOKEN = createSessionToken(OTHER_PROVIDER).token;
const PATIENT_TOKEN = createSessionToken(PATIENT).token;
const ADMIN_TOKEN = createSessionToken(ADMIN).token;

const DECLARATION = {
  patientAddress: PATIENT,
  category: 'clinical_emergency',
  reason: 'Patient presented unconscious in the emergency department',
  patientContext: 'ED encounter, City General Hospital',
  recordTypes: ['lab'],
};

const originalAdmins = process.env.SHIORA_ADMIN_ADDRESSES;

beforeEach(async () => {
  process.env.SHIORA_ADMIN_ADDRESSES = ADMIN;
  await assignRole(PROVIDER, 'provider');
  await assignRole(OTHER_PROVIDER, 'provider');
});

afterEach(() => {
  if (originalAdmins === undefined) delete process.env.SHIORA_ADMIN_ADDRESSES;
  else process.env.SHIORA_ADMIN_ADDRESSES = originalAdmins;
  __resetBreakGlassForTests();
  __resetMfaForTests();
  __resetRolesForTests();
  __resetRecordsForTests();
  __resetNotificationsForTests();
  __resetAuditLogForTests();
  __resetRateLimiterForTests();
  jest.restoreAllMocks();
  mockedRunMiddleware.mockImplementation((...args: unknown[]) =>
    jest.requireActual('@/lib/api/middleware').runMiddleware(...args));
});

function request(
  url: string,
  method: 'GET' | 'POST',
  body?: unknown,
  token: string | null = PROVIDER_TOKEN,
  headers: Record<string, string> = {},
): NextRequest {
  return new NextRequest(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

function ctx(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

/** Enrol + enable MFA for an address and return a fresh step-up header. */
async function stepUpFor(address: string): Promise<Record<string, string>> {
  const { secret } = await beginMfaEnrollment(address);
  await confirmMfaEnrollment(address, totpCode(secret));
  return { [STEP_UP_HEADER]: mintStepUpAssertion(address).assertion };
}

/** Declare break-glass through the route, returning the grant. */
async function declareGrant(): Promise<{ id: string; expiresAt: number }> {
  const headers = await stepUpFor(PROVIDER);
  const res = await declare(request(BASE, 'POST', DECLARATION, PROVIDER_TOKEN, headers));
  expect(res.status).toBe(201);
  return (await res.json()).data.grant;
}

function record(id: string, owner: string): MockHealthRecord {
  return {
    id, type: 'lab', label: `Result ${id}`, description: 'note', date: 1, uploadDate: 1,
    encrypted: false, encryption: 'none', cid: 'c', txHash: 't', attestation: 'a', size: 10,
    provider: 'p', status: 'Processing', ipfsNodes: 0, tags: [], deleted: false,
    ownerAddress: owner, blockHeight: 1,
  };
}

describe('POST /api/break-glass', () => {
  it('declares emergency access: 201 grant, audit entry, patient notified', async () => {
    const headers = await stepUpFor(PROVIDER);
    const res = await declare(request(BASE, 'POST', DECLARATION, PROVIDER_TOKEN, headers));
    expect(res.status).toBe(201);
    const { grant } = (await res.json()).data;
    expect(grant.requester).toBe(PROVIDER);
    expect(grant.patient).toBe(PATIENT);
    expect(grant.expiresAt - grant.createdAt).toBeLessThanOrEqual(60 * 60 * 1000);

    const audit = await getAuditLog().list({ action: 'BREAK_GLASS_ACCESS' });
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ actor: PROVIDER, subject: PATIENT });

    expect(await listNotifications(PATIENT, { unreadOnly: true })).toHaveLength(1);
  });

  it('requires the provider role', async () => {
    const res = await declare(request(BASE, 'POST', DECLARATION, PATIENT_TOKEN));
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe('FORBIDDEN');
  });

  it('refuses a provider without an enrolled second factor', async () => {
    const res = await declare(request(BASE, 'POST', DECLARATION, PROVIDER_TOKEN));
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe('MFA_REQUIRED');
  });

  it('demands a fresh step-up assertion even for MFA-enabled providers', async () => {
    await stepUpFor(PROVIDER); // enrol, but do not present the assertion
    const res = await declare(request(BASE, 'POST', DECLARATION, PROVIDER_TOKEN));
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe('STEP_UP_REQUIRED');
  });

  it('validates the declaration shape', async () => {
    const headers = await stepUpFor(PROVIDER);
    const res = await declare(request(
      BASE, 'POST',
      { patientAddress: 'not-an-address', reason: 'short', patientContext: '' },
      PROVIDER_TOKEN, headers,
    ));
    expect(res.status).toBe(422);
  });

  it('refuses a self-targeted declaration', async () => {
    const headers = await stepUpFor(PROVIDER);
    const res = await declare(request(
      BASE, 'POST', { ...DECLARATION, patientAddress: PROVIDER }, PROVIDER_TOKEN, headers,
    ));
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('BREAK_GLASS_SELF');
  });

  it('requires authentication', async () => {
    expect((await declare(request(BASE, 'POST', DECLARATION, null))).status).toBe(401);
  });

  it('runs under the stricter auth rate-limit class', async () => {
    await declare(request(BASE, 'POST', DECLARATION));
    expect(mockedRunMiddleware).toHaveBeenLastCalledWith(
      expect.anything(),
      { ...AUTH_RATE_LIMIT, requireAuth: true },
    );
  });

  it('returns the middleware block when blocked', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(NextResponse.json({ error: 'blocked' }, { status: 429 }));
    expect((await declare(request(BASE, 'POST', DECLARATION))).status).toBe(429);
  });

  it('re-throws an unexpected (non-validation) error', async () => {
    const headers = await stepUpFor(PROVIDER);
    const bad = new NextRequest(BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        authorization: `Bearer ${PROVIDER_TOKEN}`,
        ...headers,
      },
      body: '{ not json',
    });
    await expect(declare(bad)).rejects.toThrow();
  });
});

describe('GET /api/break-glass/{id}/records', () => {
  it('serves the patient records to the declaring requester', async () => {
    await createRecord(PATIENT, record('rec-1', PATIENT));
    const grant = await declareGrant();

    const res = await readRecords(request(`${BASE}/${grant.id}/records`, 'GET'), ctx(grant.id));
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data.grant.id).toBe(grant.id);
    expect(data.records).toHaveLength(1);
    expect(data.records[0].id).toBe('rec-1');
    expect(data.sensitiveWithheld).toBe(0);
  });

  it('applies minimum-necessary scoping: an undeclared record type is not returned', async () => {
    await createRecord(PATIENT, record('rec-1', PATIENT)); // type 'lab' — declared
    await createRecord(PATIENT, { ...record('rec-img', PATIENT), type: 'imaging' }); // not declared
    const grant = await declareGrant();

    const res = await readRecords(request(`${BASE}/${grant.id}/records`, 'GET'), ctx(grant.id));
    const { data } = await res.json();
    expect(data.records.map((r: MockHealthRecord) => r.id)).toEqual(['rec-1']);
  });

  it('denies a provider who did not declare the grant', async () => {
    const grant = await declareGrant();
    const res = await readRecords(
      request(`${BASE}/${grant.id}/records`, 'GET', undefined, OTHER_PROVIDER_TOKEN),
      ctx(grant.id),
    );
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe('FORBIDDEN');
  });

  it('denies reads after expiry', async () => {
    const grant = await declareGrant();
    jest.spyOn(Date, 'now').mockReturnValue(grant.expiresAt + 1);
    const res = await readRecords(request(`${BASE}/${grant.id}/records`, 'GET'), ctx(grant.id));
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe('BREAK_GLASS_EXPIRED');
  });

  it('denies reads once the use has been reviewed (closed)', async () => {
    const grant = await declareGrant();
    await postReview(
      request(`${BASE}/${grant.id}/review`, 'POST', { outcome: 'unjustified', notes: 'Closed.' }, ADMIN_TOKEN),
      ctx(grant.id),
    );
    const res = await readRecords(request(`${BASE}/${grant.id}/records`, 'GET'), ctx(grant.id));
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe('BREAK_GLASS_CLOSED');
  });

  it('404s an unknown grant', async () => {
    const res = await readRecords(request(`${BASE}/bg-missing/records`, 'GET'), ctx('bg-missing'));
    expect(res.status).toBe(404);
  });

  it('requires the provider role', async () => {
    const grant = await declareGrant();
    const res = await readRecords(
      request(`${BASE}/${grant.id}/records`, 'GET', undefined, PATIENT_TOKEN),
      ctx(grant.id),
    );
    expect(res.status).toBe(403);
  });

  it('requires authentication', async () => {
    const res = await readRecords(request(`${BASE}/x/records`, 'GET', undefined, null), ctx('x'));
    expect(res.status).toBe(401);
  });

  it('returns the middleware block when blocked', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(NextResponse.json({ error: 'blocked' }, { status: 429 }));
    const res = await readRecords(request(`${BASE}/x/records`, 'GET'), ctx('x'));
    expect(res.status).toBe(429);
  });
});

describe('GET /api/break-glass/review', () => {
  it('lists every use for the admin, newest first, with derived status', async () => {
    const grant = await declareGrant();
    const res = await reviewQueue(request(`${BASE}/review`, 'GET', undefined, ADMIN_TOKEN));
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data.uses).toHaveLength(1);
    expect(data.uses[0].grant.id).toBe(grant.id);
    expect(data.uses[0].status).toBe('active');
    // The queue is precisely the surface that shows the declared justification.
    expect(data.uses[0].grant.reason).toBe(DECLARATION.reason);
  });

  it('filters to pending uses', async () => {
    const grant = await declareGrant();
    await postReview(
      request(`${BASE}/${grant.id}/review`, 'POST', { outcome: 'justified', notes: '' }, ADMIN_TOKEN),
      ctx(grant.id),
    );
    const res = await reviewQueue(request(`${BASE}/review?pending=true`, 'GET', undefined, ADMIN_TOKEN));
    expect((await res.json()).data.uses).toEqual([]);
  });

  it('is admin-only', async () => {
    const res = await reviewQueue(request(`${BASE}/review`, 'GET', undefined, PROVIDER_TOKEN));
    expect(res.status).toBe(403);
  });

  it('requires authentication', async () => {
    expect((await reviewQueue(request(`${BASE}/review`, 'GET', undefined, null))).status).toBe(401);
  });

  it('returns the middleware block when blocked', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(NextResponse.json({ error: 'blocked' }, { status: 429 }));
    expect((await reviewQueue(request(`${BASE}/review`, 'GET', undefined, ADMIN_TOKEN))).status).toBe(429);
  });
});

describe('POST /api/break-glass/{id}/review', () => {
  it('records the retrospective verdict', async () => {
    const grant = await declareGrant();
    const res = await postReview(
      request(
        `${BASE}/${grant.id}/review`, 'POST',
        { outcome: 'justified', notes: 'Confirmed with the ED attending.' }, ADMIN_TOKEN,
      ),
      ctx(grant.id),
    );
    expect(res.status).toBe(200);
    const { grant: reviewed } = (await res.json()).data;
    expect(reviewed.review).toMatchObject({
      reviewer: ADMIN,
      outcome: 'justified',
      notes: 'Confirmed with the ED attending.',
    });

    const audit = await getAuditLog().list({ action: 'BREAK_GLASS_REVIEW' });
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ actor: ADMIN, subject: PATIENT });
  });

  it('409s a second review of the same use', async () => {
    const grant = await declareGrant();
    const review = request(
      `${BASE}/${grant.id}/review`, 'POST', { outcome: 'justified', notes: '' }, ADMIN_TOKEN,
    );
    await postReview(review, ctx(grant.id));
    const res = await postReview(
      request(`${BASE}/${grant.id}/review`, 'POST', { outcome: 'justified', notes: '' }, ADMIN_TOKEN),
      ctx(grant.id),
    );
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe('ALREADY_REVIEWED');
  });

  it('404s an unknown grant', async () => {
    const res = await postReview(
      request(`${BASE}/bg-missing/review`, 'POST', { outcome: 'justified', notes: '' }, ADMIN_TOKEN),
      ctx('bg-missing'),
    );
    expect(res.status).toBe(404);
  });

  it('validates the verdict shape', async () => {
    const grant = await declareGrant();
    const res = await postReview(
      request(`${BASE}/${grant.id}/review`, 'POST', { outcome: 'fine' }, ADMIN_TOKEN),
      ctx(grant.id),
    );
    expect(res.status).toBe(422);
  });

  it('is admin-only', async () => {
    const res = await postReview(
      request(`${BASE}/x/review`, 'POST', { outcome: 'justified', notes: '' }, PROVIDER_TOKEN),
      ctx('x'),
    );
    expect(res.status).toBe(403);
  });

  it('requires authentication', async () => {
    const res = await postReview(
      request(`${BASE}/x/review`, 'POST', { outcome: 'justified', notes: '' }, null),
      ctx('x'),
    );
    expect(res.status).toBe(401);
  });

  it('returns the middleware block when blocked', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(NextResponse.json({ error: 'blocked' }, { status: 429 }));
    const res = await postReview(
      request(`${BASE}/x/review`, 'POST', { outcome: 'justified', notes: '' }, ADMIN_TOKEN),
      ctx('x'),
    );
    expect(res.status).toBe(429);
  });

  it('re-throws an unexpected (non-validation) error', async () => {
    const bad = new NextRequest(`${BASE}/x/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', authorization: `Bearer ${ADMIN_TOKEN}` },
      body: '{ not json',
    });
    await expect(postReview(bad, ctx('x'))).rejects.toThrow();
  });
});
