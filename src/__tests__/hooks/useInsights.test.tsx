// ============================================================
// Tests for src/hooks/useInsights.ts
// ============================================================

jest.mock('@/lib/api/client', () => ({ api: { get: jest.fn() } }));

import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { useInsights } from '@/hooks/useInsights';

const mockGet = api.get as jest.Mock;

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => jest.clearAllMocks());

describe('useInsights', () => {
  it('exposes metrics + derived (newest-first) anomalies from the report', async () => {
    mockGet.mockResolvedValue({
      generatedAt: 123,
      anomalyCount: 2,
      metrics: [
        { metric: 'hr', sampleCount: 5, mean: 60, stdDev: 2, baselineLow: 56, baselineHigh: 64, trend: 'stable',
          anomalies: [{ metric: 'hr', value: 90, recordedAt: 200, zScore: 3, direction: 'above' }] },
        { metric: 'steps', sampleCount: 6, mean: 8000, stdDev: 1000, baselineLow: 6000, baselineHigh: 10000, trend: 'rising',
          anomalies: [{ metric: 'steps', value: 1, recordedAt: 300, zScore: 2, direction: 'below' }] },
      ],
    });

    const { result } = renderHook(() => useInsights(), { wrapper });
    // Before the query resolves, safe defaults.
    expect(result.current.metrics).toEqual([]);
    expect(result.current.generatedAt).toBeNull();

    await waitFor(() => expect(result.current.metrics.length).toBe(2));
    expect(result.current.anomalies.map((a) => a.recordedAt)).toEqual([300, 200]); // newest first
    expect(result.current.anomalyCount).toBe(2);
    expect(result.current.generatedAt).toBe(123);
    expect(result.current.error).toBeNull();
    result.current.refetch();
    expect(mockGet).toHaveBeenCalledWith('/api/insights');
  });

  it('returns empty insights when the report has no metrics', async () => {
    mockGet.mockResolvedValue({ generatedAt: 0, anomalyCount: 0, metrics: [] });
    const { result } = renderHook(() => useInsights(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.metrics).toEqual([]);
    expect(result.current.anomalies).toEqual([]);
    expect(result.current.anomalyCount).toBe(0);
  });
});
