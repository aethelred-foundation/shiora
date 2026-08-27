/** @jest-environment node */

import {
  buildInsights,
  computeInsights,
  listAnomalies,
  listInferences,
  mean,
  stdDev,
} from '@/lib/api/insights-service';
import { ingestSamples, __resetWearablesForTests, type WearableSample } from '@/lib/api/wearables-service';
import { __resetAuditLogForTests } from '@/lib/api/audit-log';

let counter = 0;
function ws(metric: string, value: number, recordedAt: number): WearableSample {
  counter += 1;
  return { id: `ws-${counter}`, metric, value, unit: 'u', recordedAt, source: 't' };
}

/** A series at ascending recordedAt = array index. */
function series(metric: string, values: number[]): WearableSample[] {
  return values.map((v, i) => ws(metric, v, i + 1));
}

beforeEach(() => {
  counter = 0;
  __resetWearablesForTests();
  __resetAuditLogForTests();
});

describe('stat helpers', () => {
  it('computes mean and population stddev', () => {
    expect(mean([2, 4, 6])).toBe(4);
    expect(stdDev([2, 4, 6], 4)).toBeCloseTo(Math.sqrt(8 / 3));
  });
});

describe('buildInsights', () => {
  it('returns an empty report for no samples', () => {
    expect(buildInsights([], 1000)).toEqual({ generatedAt: 1000, metrics: [], anomalyCount: 0 });
  });

  it('skips metrics with fewer than 3 samples', () => {
    const report = buildInsights(series('hr', [70, 72]), 1000);
    expect(report.metrics).toEqual([]);
  });

  it('detects a rising trend with no anomalies', () => {
    const report = buildInsights(series('steps', [10, 20, 30, 40, 50, 60]), 1000);
    const insight = report.metrics[0];
    expect(insight.trend).toBe('rising');
    expect(insight.anomalies).toEqual([]);
    expect(insight.baselineLow).toBeLessThan(insight.mean);
    expect(insight.baselineHigh).toBeGreaterThan(insight.mean);
  });

  it('detects a falling trend', () => {
    expect(buildInsights(series('steps', [60, 50, 40, 30, 20, 10]), 1000).metrics[0].trend).toBe('falling');
  });

  it('reports a stable trend and no anomalies when variance is zero', () => {
    const insight = buildInsights(series('spo2', [98, 98, 98]), 1000).metrics[0];
    expect(insight.trend).toBe('stable');
    expect(insight.stdDev).toBe(0);
    expect(insight.anomalies).toEqual([]);
  });

  it('reports a stable trend when the change is within threshold', () => {
    expect(buildInsights(series('hr', [50, 51, 49, 50, 51, 49]), 1000).metrics[0].trend).toBe('stable');
  });

  it('flags an above-baseline anomaly', () => {
    const report = buildInsights(series('hr', [70, 70, 70, 70, 70, 70, 200]), 1000);
    const anomalies = report.metrics[0].anomalies;
    expect(anomalies).toHaveLength(1);
    expect(anomalies[0]).toMatchObject({ value: 200, direction: 'above' });
    expect(anomalies[0].zScore).toBeGreaterThan(2);
    expect(report.anomalyCount).toBe(1);
  });

  it('flags a below-baseline anomaly', () => {
    const anomalies = buildInsights(series('hr', [70, 70, 70, 70, 70, 70, 5]), 1000).metrics[0].anomalies;
    expect(anomalies).toHaveLength(1);
    expect(anomalies[0].direction).toBe('below');
  });

  it('sorts multiple metrics by name', () => {
    const report = buildInsights([...series('steps', [1, 2, 3]), ...series('hr', [60, 61, 62])], 1000);
    expect(report.metrics.map((m) => m.metric)).toEqual(['hr', 'steps']);
  });
});

describe('computeInsights / listAnomalies / listInferences (over stored telemetry)', () => {
  const OWNER = 'aeth1owner';

  it('computes insights from the owner encrypted samples (two metrics, sorted anomalies)', async () => {
    await ingestSamples(OWNER, series('hr', [70, 70, 70, 70, 70, 70, 200]).map(({ id, ...s }) => s));
    await ingestSamples(OWNER, series('steps', [1000, 1000, 1000, 1000, 1000, 1000, 3000]).map(({ id, ...s }) => s));

    const report = await computeInsights(OWNER);
    expect(report.metrics).toHaveLength(2);
    expect(report.anomalyCount).toBe(2);

    const anomalies = await listAnomalies(OWNER); // ≥2 → exercises the sort comparator
    expect(anomalies).toHaveLength(2);
    expect(anomalies.map((a) => a.recordedAt)).toEqual([7, 7]); // newest-first stable

    const inferences = await listInferences(OWNER);
    expect(inferences.map((i) => i.metric).sort()).toEqual(['hr', 'steps']);
  });
});
