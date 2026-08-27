// ============================================================
// Shiora on Aethelred — Health insights engine (non-diagnostic)
//
// Replaces the seeded insight mock with a real statistical reflection of
// the user's OWN data: per-metric baseline (mean ± 2σ), z-score anomaly
// detection, and recent-vs-older trend, computed over the user's encrypted
// wearable telemetry (wearables-service). It is INFORMATIONAL and NON-DIAGNOSTIC
// — it surfaces deviations from the user's own baseline, it does not diagnose,
// predict disease, or recommend treatment (cf. SaMD assessment).
// ============================================================

import { listSamples, type WearableSample } from '@/lib/api/wearables-service';

export interface Anomaly {
  metric: string;
  value: number;
  recordedAt: number;
  /** Standard deviations from the user's own baseline (rounded). */
  zScore: number;
  direction: 'above' | 'below';
}

export interface MetricInsight {
  metric: string;
  sampleCount: number;
  mean: number;
  stdDev: number;
  baselineLow: number;
  baselineHigh: number;
  trend: 'rising' | 'falling' | 'stable';
  anomalies: Anomaly[];
}

export interface InsightsReport {
  generatedAt: number;
  metrics: MetricInsight[];
  anomalyCount: number;
}

const MIN_SAMPLES = 3;
const ANOMALY_Z = 2;
const TREND_THRESHOLD = 0.5; // in std devs

export function mean(values: number[]): number {
  return values.reduce((acc, v) => acc + v, 0) / values.length;
}

export function stdDev(values: number[], m: number): number {
  const variance = values.reduce((acc, v) => acc + (v - m) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function classifyTrend(chronological: number[], sd: number): 'rising' | 'falling' | 'stable' {
  if (sd === 0) {
    return 'stable';
  }
  const mid = Math.floor(chronological.length / 2);
  const delta = mean(chronological.slice(mid)) - mean(chronological.slice(0, mid));
  if (delta > TREND_THRESHOLD * sd) {
    return 'rising';
  }
  if (delta < -TREND_THRESHOLD * sd) {
    return 'falling';
  }
  return 'stable';
}

function detectAnomalies(samples: WearableSample[], m: number, sd: number): Anomaly[] {
  if (sd === 0) {
    return [];
  }
  return samples
    .map((s) => ({ s, z: (s.value - m) / sd }))
    .filter(({ z }) => Math.abs(z) > ANOMALY_Z)
    .map(({ s, z }) => ({
      metric: s.metric,
      value: s.value,
      recordedAt: s.recordedAt,
      zScore: Math.round(z * 100) / 100,
      direction: z > 0 ? ('above' as const) : ('below' as const),
    }));
}

function metricInsight(metric: string, samples: WearableSample[]): MetricInsight | null {
  if (samples.length < MIN_SAMPLES) {
    return null;
  }
  const chronological = [...samples]
    .sort((a, b) => a.recordedAt - b.recordedAt)
    .map((s) => s.value);
  const m = mean(chronological);
  const sd = stdDev(chronological, m);
  return {
    metric,
    sampleCount: samples.length,
    mean: m,
    stdDev: sd,
    baselineLow: m - ANOMALY_Z * sd,
    baselineHigh: m + ANOMALY_Z * sd,
    trend: classifyTrend(chronological, sd),
    anomalies: detectAnomalies(samples, m, sd),
  };
}

/** Pure: build the insights report from a set of samples. */
export function buildInsights(samples: WearableSample[], now: number): InsightsReport {
  const byMetric = new Map<string, WearableSample[]>();
  for (const sample of samples) {
    const group = byMetric.get(sample.metric) ?? [];
    group.push(sample);
    byMetric.set(sample.metric, group);
  }

  const metrics: MetricInsight[] = [];
  for (const [metric, group] of Array.from(byMetric.entries())) {
    const insight = metricInsight(metric, group);
    if (insight) {
      metrics.push(insight);
    }
  }
  metrics.sort((a, b) => a.metric.localeCompare(b.metric));

  return {
    generatedAt: now,
    metrics,
    anomalyCount: metrics.reduce((sum, mi) => sum + mi.anomalies.length, 0),
  };
}

/** The user's insights, computed over their own encrypted telemetry. */
export async function computeInsights(ownerAddress: string): Promise<InsightsReport> {
  return buildInsights(await listSamples(ownerAddress), Date.now());
}

/** Flattened anomalies across all metrics, newest first. */
export async function listAnomalies(ownerAddress: string): Promise<Anomaly[]> {
  const report = await computeInsights(ownerAddress);
  return report.metrics.flatMap((mi) => mi.anomalies).sort((a, b) => b.recordedAt - a.recordedAt);
}

/** Per-metric trend "inferences". */
export async function listInferences(
  ownerAddress: string,
): Promise<Array<{ metric: string; trend: string; mean: number; sampleCount: number }>> {
  const report = await computeInsights(ownerAddress);
  return report.metrics.map((mi) => ({
    metric: mi.metric,
    trend: mi.trend,
    mean: mi.mean,
    sampleCount: mi.sampleCount,
  }));
}
