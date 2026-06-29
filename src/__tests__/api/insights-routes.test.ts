/** @jest-environment node */

import { NextRequest } from 'next/server';
import { GET as overview } from '@/app/api/insights/route';
import { GET as anomalies } from '@/app/api/insights/anomalies/route';
import { GET as inferences } from '@/app/api/insights/inferences/route';
import { ingestSamples, __resetWearablesForTests } from '@/lib/api/wearables-service';
import { __resetAuditLogForTests } from '@/lib/api/audit-log';
import { createSessionToken } from '@/lib/api/session';
import { seededAddress } from '@/lib/utils';

const USER = seededAddress(860);
const token = createSessionToken(USER).token;

function req(withToken = false): NextRequest {
  const headers: Record<string, string> = {};
  if (withToken) headers.authorization = `Bearer ${token}`;
  return new NextRequest('http://localhost:3000/api/insights', { headers });
}

async function seedOutlierSeries(): Promise<void> {
  const values = [70, 70, 70, 70, 70, 70, 200]; // one clear above-baseline anomaly
  await ingestSamples(
    USER,
    values.map((value, i) => ({ metric: 'heart_rate', value, unit: 'bpm', recordedAt: i + 1, source: 't' })),
  );
}

beforeEach(() => {
  __resetWearablesForTests();
  __resetAuditLogForTests();
});

describe('GET /api/insights (overview)', () => {
  it('requires authentication', async () => {
    expect((await overview(req())).status).toBe(401);
  });

  it('returns a real insights report over the caller telemetry', async () => {
    await seedOutlierSeries();
    const res = await overview(req(true));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.metrics).toHaveLength(1);
    expect(body.data.anomalyCount).toBe(1);
  });
});

describe('GET /api/insights/anomalies', () => {
  it('requires authentication', async () => {
    expect((await anomalies(req())).status).toBe(401);
  });

  it('returns z-score anomalies vs the caller baseline', async () => {
    await seedOutlierSeries();
    const res = await anomalies(req(true));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0]).toMatchObject({ value: 200, direction: 'above' });
  });
});

describe('GET /api/insights/inferences', () => {
  it('requires authentication', async () => {
    expect((await inferences(req())).status).toBe(401);
  });

  it('returns per-metric trend inferences', async () => {
    await seedOutlierSeries();
    const res = await inferences(req(true));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data[0]).toMatchObject({ metric: 'heart_rate', sampleCount: 7 });
  });
});
