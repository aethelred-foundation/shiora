/** @jest-environment node */

import { NextRequest } from 'next/server';
import { GET as listSamplesRoute, POST as ingestRoute } from '@/app/api/wearables/samples/route';
import { GET as analyticsRoute } from '@/app/api/wearables/analytics/route';
import { POST as cohortRoute } from '@/app/api/wearables/cohort-aggregate/route';
import { ingestSamples, __resetWearablesForTests } from '@/lib/api/wearables-service';
import { assignRole, __resetRolesForTests } from '@/lib/api/roles-service';
import { __resetAuditLogForTests } from '@/lib/api/audit-log';
import { createSessionToken } from '@/lib/api/session';
import { seededAddress } from '@/lib/utils';

const USER = seededAddress(840);
const RESEARCHER = seededAddress(841);
const PEER = seededAddress(842);
const userToken = createSessionToken(USER).token;
const researcherToken = createSessionToken(RESEARCHER).token;

function req(method: string, body?: unknown, token?: string, query = ''): NextRequest {
  const headers: Record<string, string> = {};
  if (token) headers.authorization = `Bearer ${token}`;
  const init: { method: string; headers: Record<string, string>; body?: string } = { method, headers };
  if (body !== undefined) {
    headers['content-type'] = 'application/json';
    init.body = typeof body === 'string' ? body : JSON.stringify(body);
  }
  return new NextRequest(`http://localhost:3000/api/wearables/x${query}`, init);
}

const SAMPLE = { metric: 'steps', value: 5000, unit: 'count', recordedAt: 1000, source: 'test' };

beforeEach(async () => {
  __resetWearablesForTests();
  __resetRolesForTests();
  __resetAuditLogForTests();
  await assignRole(RESEARCHER, 'researcher');
});

describe('POST /api/wearables/samples', () => {
  it('requires authentication', async () => {
    expect((await ingestRoute(req('POST', { samples: [SAMPLE] }))).status).toBe(401);
  });

  it('ingests a batch of samples', async () => {
    const res = await ingestRoute(req('POST', { samples: [SAMPLE, SAMPLE] }, userToken));
    expect(res.status).toBe(201);
    expect((await res.json()).data.ingested).toBe(2);
  });

  it('rejects an invalid body (422)', async () => {
    expect((await ingestRoute(req('POST', { samples: [] }, userToken))).status).toBe(422);
  });

  it('rethrows on a non-JSON body', async () => {
    await expect(ingestRoute(req('POST', 'not-json', userToken))).rejects.toThrow();
  });
});

describe('GET /api/wearables/samples', () => {
  it('requires authentication', async () => {
    expect((await listSamplesRoute(req('GET'))).status).toBe(401);
  });

  it('lists the caller samples and filters by metric', async () => {
    await ingestSamples(USER, [
      { metric: 'steps', value: 100, unit: 'count', recordedAt: 1, source: 't' },
      { metric: 'heart_rate', value: 70, unit: 'bpm', recordedAt: 2, source: 't' },
    ]);
    const all = await (await listSamplesRoute(req('GET', undefined, userToken))).json();
    expect(all.data).toHaveLength(2);
    const steps = await (await listSamplesRoute(req('GET', undefined, userToken, '?metric=steps'))).json();
    expect(steps.data).toHaveLength(1);
  });
});

describe('GET /api/wearables/analytics', () => {
  it('requires authentication', async () => {
    expect((await analyticsRoute(req('GET'))).status).toBe(401);
  });

  it('requires a metric query parameter', async () => {
    expect((await analyticsRoute(req('GET', undefined, userToken))).status).toBe(400);
  });

  it('returns the derived summary', async () => {
    await ingestSamples(USER, [{ metric: 'steps', value: 5000, unit: 'count', recordedAt: 1, source: 't' }]);
    const res = await analyticsRoute(req('GET', undefined, userToken, '?metric=steps'));
    expect(res.status).toBe(200);
    expect((await res.json()).data.sum).toBe(5000);
  });
});

describe('POST /api/wearables/cohort-aggregate (researcher-gated)', () => {
  it('requires authentication', async () => {
    expect((await cohortRoute(req('POST', { cohort: [USER, PEER], metric: 'steps' }))).status).toBe(401);
  });

  it('returns 403 for a non-researcher', async () => {
    expect((await cohortRoute(req('POST', { cohort: [USER, PEER], metric: 'steps' }, userToken))).status).toBe(403);
  });

  it('secure-sums a metric across a cohort for a researcher', async () => {
    await ingestSamples(USER, [{ metric: 'steps', value: 4000, unit: 'count', recordedAt: 1, source: 't' }]);
    await ingestSamples(PEER, [{ metric: 'steps', value: 6000, unit: 'count', recordedAt: 1, source: 't' }]);
    const res = await cohortRoute(req('POST', { cohort: [USER, PEER], metric: 'steps' }, researcherToken));
    expect(res.status).toBe(200);
    expect((await res.json()).data).toMatchObject({ sum: 10000, mean: 5000, contributingOwners: 2 });
  });

  it('returns 422 when fewer than 2 cohort members have telemetry', async () => {
    await ingestSamples(USER, [{ metric: 'steps', value: 4000, unit: 'count', recordedAt: 1, source: 't' }]);
    const res = await cohortRoute(req('POST', { cohort: [USER, PEER], metric: 'steps' }, researcherToken));
    expect(res.status).toBe(422);
    expect((await res.json()).error.code).toBe('INSUFFICIENT_COHORT');
  });

  it('rejects an invalid cohort body (422)', async () => {
    expect((await cohortRoute(req('POST', { cohort: [USER], metric: 'steps' }, researcherToken))).status).toBe(422);
  });

  it('rethrows on a non-JSON body', async () => {
    await expect(cohortRoute(req('POST', 'not-json', researcherToken))).rejects.toThrow();
  });
});
