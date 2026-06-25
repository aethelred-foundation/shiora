/** @jest-environment node */

jest.mock('@/lib/api/middleware', () => {
  const actual = jest.requireActual('@/lib/api/middleware');
  return { ...actual, runMiddleware: jest.fn((...args: unknown[]) => actual.runMiddleware(...args)) };
});

import { NextRequest, NextResponse } from 'next/server';
import { runMiddleware } from '@/lib/api/middleware';
import { GET as getVault } from '@/app/api/vault/route';
import { GET as getSymptoms, POST as postSymptom } from '@/app/api/vault/symptoms/route';
import { GET as getCycle, POST as postCycle } from '@/app/api/vault/cycle/route';
import { GET as getAnalytics } from '@/app/api/vault/analytics/route';
import { __resetVaultForTests } from '@/lib/api/vault-service';
import { createSessionToken } from '@/lib/api/session';
import { seededAddress } from '@/lib/utils';

const mockedRunMiddleware = runMiddleware as jest.MockedFunction<typeof runMiddleware>;
const USER = seededAddress(700);
const token = createSessionToken(USER).token;

function authed(url: string, init: RequestInit = {}): NextRequest {
  return new NextRequest(url, {
    ...init,
    headers: { ...(init.headers as Record<string, string>), authorization: `Bearer ${token}` },
  });
}

function jsonBody(body: unknown): RequestInit {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  };
}

beforeEach(() => __resetVaultForTests());

afterEach(() => {
  mockedRunMiddleware.mockImplementation((...args: unknown[]) => {
    const actual = jest.requireActual('@/lib/api/middleware');
    return actual.runMiddleware(...args);
  });
});

const VAULT = 'http://localhost:3000/api/vault';
const SYM = `${VAULT}/symptoms`;
const CYC = `${VAULT}/cycle`;

describe('/api/vault overview', () => {
  it('returns the middleware error when blocked', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(NextResponse.json({ error: 'blocked' }, { status: 403 }));
    expect((await getVault(authed(VAULT))).status).toBe(403);
  });

  it('returns 401 when unauthenticated', async () => {
    expect((await getVault(new NextRequest(VAULT))).status).toBe(401);
  });

  it('returns 401 when the middleware is bypassed but no session is present', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(null);
    expect((await getVault(new NextRequest(VAULT))).status).toBe(401);
  });

  it('reports an empty overview for a new user', async () => {
    const res = await getVault(authed(VAULT));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.symptomCount).toBe(0);
    expect(body.data.cycleEntryCount).toBe(0);
    expect(body.data.insights.periodStartCount).toBe(0);
  });

  it('reflects logged data', async () => {
    await postSymptom(authed(SYM, jsonBody({ category: 'pain', symptom: 'Cramps', severity: 3 })));
    await postCycle(authed(CYC, jsonBody({ flow: 'heavy', isPeriodStart: true })));
    const body = await (await getVault(authed(VAULT))).json();
    expect(body.data.symptomCount).toBe(1);
    expect(body.data.cycleEntryCount).toBe(1);
    expect(body.data.insights.periodStartCount).toBe(1);
  });
});

describe('/api/vault/symptoms', () => {
  it('returns the middleware error when blocked', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(NextResponse.json({ error: 'blocked' }, { status: 403 }));
    expect((await getSymptoms(authed(SYM))).status).toBe(403);
  });

  it('GET returns 401 when the middleware is bypassed but unauthenticated', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(null);
    expect((await getSymptoms(new NextRequest(SYM))).status).toBe(401);
  });

  it('POST returns the middleware error when blocked', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(NextResponse.json({ error: 'blocked' }, { status: 403 }));
    expect((await postSymptom(authed(SYM, jsonBody({ category: 'pain', symptom: 'X', severity: 1 })))).status).toBe(403);
  });

  it('starts empty, then logs and lists a symptom', async () => {
    expect((await (await getSymptoms(authed(SYM))).json()).data.total).toBe(0);

    const created = await postSymptom(authed(SYM, jsonBody({
      category: 'pain', symptom: 'Headache', severity: 3, notes: 'After lunch', tags: ['recurring'],
    })));
    expect(created.status).toBe(201);
    const createdBody = await created.json();
    expect(createdBody.data.symptom).toBe('Headache');
    expect(createdBody.data.notes).toBe('After lunch');

    const list = await (await getSymptoms(authed(SYM))).json();
    expect(list.data.total).toBe(1);
  });

  it('filters by category', async () => {
    await postSymptom(authed(SYM, jsonBody({ category: 'pain', symptom: 'Cramps', severity: 2 })));
    await postSymptom(authed(SYM, jsonBody({ category: 'mood', symptom: 'Anxiety', severity: 2 })));

    const painOnly = await (await getSymptoms(authed(`${SYM}?category=pain`))).json();
    expect(painOnly.data.total).toBe(1);
    expect(painOnly.data.symptoms[0].category).toBe('pain');
  });

  it('defaults notes and tags when omitted', async () => {
    const body = await (await postSymptom(authed(SYM, jsonBody({ category: 'mood', symptom: 'Anxiety', severity: 2 })))).json();
    expect(body.data.notes).toBe('');
    expect(body.data.tags).toEqual([]);
  });

  it('POST returns 422 for an invalid category', async () => {
    expect((await postSymptom(authed(SYM, jsonBody({ category: 'invalid', symptom: 'X', severity: 1 })))).status).toBe(422);
  });

  it('POST returns 422 for missing fields', async () => {
    expect((await postSymptom(authed(SYM, jsonBody({})))).status).toBe(422);
  });

  it('POST returns 401 when the middleware is bypassed but unauthenticated', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(null);
    expect((await postSymptom(new NextRequest(SYM, jsonBody({ category: 'pain', symptom: 'X', severity: 1 })))).status).toBe(401);
  });

  it('POST throws on an invalid JSON body', async () => {
    await expect(postSymptom(authed(SYM, jsonBody('not-json')))).rejects.toThrow();
  });
});

describe('/api/vault/cycle', () => {
  it('returns the middleware error when blocked', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(NextResponse.json({ error: 'blocked' }, { status: 403 }));
    expect((await getCycle(authed(CYC))).status).toBe(403);
  });

  it('GET returns 401 when the middleware is bypassed but unauthenticated', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(null);
    expect((await getCycle(new NextRequest(CYC))).status).toBe(401);
  });

  it('POST returns the middleware error when blocked', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(NextResponse.json({ error: 'blocked' }, { status: 403 }));
    expect((await postCycle(authed(CYC, jsonBody({ flow: 'light', isPeriodStart: false })))).status).toBe(403);
  });

  it('starts empty with null insights', async () => {
    const body = await (await getCycle(authed(CYC))).json();
    expect(body.data.total).toBe(0);
    expect(body.data.insights.periodStartCount).toBe(0);
    expect(body.data.insights.averageCycleLength).toBeNull();
  });

  it('logs a cycle entry and derives insights', async () => {
    const created = await postCycle(authed(CYC, jsonBody({ flow: 'heavy', isPeriodStart: true, temperature: 97.6 })));
    expect(created.status).toBe(201);

    const body = await (await getCycle(authed(CYC))).json();
    expect(body.data.total).toBe(1);
    expect(body.data.insights.periodStartCount).toBe(1);
    expect(body.data.insights.currentCycleDay).toBe(1);
    expect(body.data.insights.predictedNextPeriod).toBeGreaterThan(Date.now());
  });

  it('POST returns 422 for an invalid flow', async () => {
    expect((await postCycle(authed(CYC, jsonBody({ flow: 'torrential', isPeriodStart: true })))).status).toBe(422);
  });

  it('POST returns 401 when the middleware is bypassed but unauthenticated', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(null);
    expect((await postCycle(new NextRequest(CYC, jsonBody({ flow: 'light', isPeriodStart: false })))).status).toBe(401);
  });

  it('POST throws on an invalid JSON body', async () => {
    await expect(postCycle(authed(CYC, jsonBody('not-json')))).rejects.toThrow();
  });
});

describe('/api/vault/analytics', () => {
  const ANALYTICS = `${VAULT}/analytics`;

  it('returns the middleware error when blocked', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(NextResponse.json({ error: 'blocked' }, { status: 403 }));
    expect((await getAnalytics(authed(ANALYTICS))).status).toBe(403);
  });

  it('returns 401 when the middleware is bypassed but unauthenticated', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(null);
    expect((await getAnalytics(new NextRequest(ANALYTICS))).status).toBe(401);
  });

  it('returns derived cycle and symptom analytics', async () => {
    await postSymptom(authed(SYM, jsonBody({ category: 'pain', symptom: 'Cramps', severity: 3 })));
    await postCycle(authed(CYC, jsonBody({ flow: 'heavy', isPeriodStart: true })));

    const res = await getAnalytics(authed(ANALYTICS));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.symptoms.totalLogged).toBe(1);
    expect(body.data.cycle.predictedPeriods).toHaveLength(3);
    expect(body.data.symptoms.byCyclePhase).toBeDefined();
  });
});
