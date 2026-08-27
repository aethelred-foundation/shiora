/** @jest-environment node */

const pgQuery = jest.fn().mockResolvedValue({ rows: [] });

jest.mock('@/lib/persistence/sql-client', () => ({
  getPgClient: jest.fn(() => ({ query: pgQuery })),
}));

import {
  ingestSamples,
  listSamples,
  summarizeMetric,
  cohortMetricAggregate,
  __resetWearablesForTests,
  type NewSample,
} from '@/lib/api/wearables-service';
import { __resetAuditLogForTests } from '@/lib/api/audit-log';

const A = 'aeth1a';
const B = 'aeth1b';

function sample(metric: string, value: number, recordedAt: number): NewSample {
  return { metric, value, unit: 'bpm', recordedAt, source: 'test-device' };
}

beforeEach(() => {
  __resetWearablesForTests();
  __resetAuditLogForTests();
});

describe('ingest + list', () => {
  it('ingests samples and lists them newest-first, filtered by metric', async () => {
    const count = await ingestSamples(A, [
      sample('heart_rate', 60, 100),
      sample('heart_rate', 80, 300),
      sample('steps', 5000, 200),
    ]);
    expect(count).toBe(3);

    const all = await listSamples(A);
    expect(all.map((s) => s.recordedAt)).toEqual([300, 200, 100]); // newest first

    const hr = await listSamples(A, 'heart_rate');
    expect(hr).toHaveLength(2);
    expect(hr.every((s) => s.metric === 'heart_rate')).toBe(true);
    expect(hr[0].id).toMatch(/^ws-/);
  });
});

describe('summarizeMetric', () => {
  it('derives count/sum/mean/min/max/latest from the owner samples', async () => {
    await ingestSamples(A, [
      sample('heart_rate', 60, 100),
      sample('heart_rate', 90, 300), // latest
      sample('heart_rate', 72, 200),
    ]);
    const summary = await summarizeMetric(A, 'heart_rate');
    expect(summary).toEqual({
      metric: 'heart_rate', count: 3, sum: 222, mean: 74, min: 60, max: 90, latest: 90,
    });
  });

  it('returns null when the owner has no samples for the metric', async () => {
    expect(await summarizeMetric(A, 'spo2')).toBeNull();
  });
});

describe('cohortMetricAggregate (real MPC)', () => {
  it('secure-sums a metric across a cohort, revealing only the aggregate', async () => {
    await ingestSamples(A, [sample('steps', 4000, 100), sample('steps', 6000, 200)]); // sum 10000
    await ingestSamples(B, [sample('steps', 8000, 100)]); // sum 8000

    const result = await cohortMetricAggregate([A, B], 'steps');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.aggregate).toEqual({
        metric: 'steps', cohortSize: 2, contributingOwners: 2, sum: 18000, mean: 9000,
      });
    }
  });

  it('refuses a cohort with fewer than 2 contributors (privacy floor)', async () => {
    await ingestSamples(A, [sample('steps', 4000, 100)]);
    // B has no telemetry → only 1 contributor even though the cohort lists 2.
    const result = await cohortMetricAggregate([A, B], 'steps');
    expect(result).toEqual({ ok: false, reason: 'insufficient-cohort' });
  });
});

describe('datastore selection', () => {
  const original = process.env.DATABASE_URL;
  afterEach(() => {
    if (original === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = original;
    __resetWearablesForTests();
  });

  it('selects the Postgres store when DATABASE_URL is configured', async () => {
    process.env.DATABASE_URL = 'postgres://localhost/shiora';
    __resetWearablesForTests();
    expect(await listSamples(A)).toEqual([]);
    expect(pgQuery).toHaveBeenCalled();
  });
});
