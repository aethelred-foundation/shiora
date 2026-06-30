/**
 * useInsights — the caller's statistical health insights.
 *
 * Backed by GET /api/insights (computeInsights over the user's OWN encrypted
 * wearable telemetry). Non-diagnostic: per-metric baselines (mean ± 2σ),
 * trends, and z-score anomalies — NOT AI/ML predictions or TEE-attested
 * inference. Empty until the user has ingested wearable samples.
 */

'use client';

import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { InsightsReport, MetricInsight, Anomaly } from '@/lib/api/insights-service';

const INSIGHTS_KEY = 'insights-report';

export interface UseInsightsReturn {
  /** Per-metric statistical insights over the user's own wearable data. */
  metrics: MetricInsight[];
  /** All anomalies across metrics, newest first. */
  anomalies: Anomaly[];
  /** Total anomaly count. */
  anomalyCount: number;
  /** When the report was computed (epoch ms), or null before the first load. */
  generatedAt: number | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useInsights(): UseInsightsReturn {
  const reportQuery = useQuery({
    queryKey: [INSIGHTS_KEY],
    queryFn: () => api.get<InsightsReport>('/api/insights'),
    staleTime: 30_000,
  });

  const report = reportQuery.data ?? null;
  const metrics = useMemo(() => report?.metrics ?? [], [report]);
  const anomalies = useMemo(
    () =>
      metrics
        .flatMap((m) => m.anomalies)
        .sort((a, b) => b.recordedAt - a.recordedAt),
    [metrics],
  );

  const refetch = useCallback(() => {
    reportQuery.refetch();
  }, [reportQuery]);

  return {
    metrics,
    anomalies,
    anomalyCount: report?.anomalyCount ?? 0,
    generatedAt: report?.generatedAt ?? null,
    isLoading: reportQuery.isLoading,
    error: reportQuery.error as Error | null,
    refetch,
  };
}
