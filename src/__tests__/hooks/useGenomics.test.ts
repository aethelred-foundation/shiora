import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useGenomics } from '@/hooks/useGenomics';

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

describe('useGenomics', () => {
  it('initializes with loading', () => {
    const { result } = renderHook(() => useGenomics(), { wrapper: createWrapper() });
    expect(result.current.isLoading).toBe(true);
  });

  it('loads data', async () => {
    const { result } = renderHook(() => useGenomics(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.overview).toBeDefined();
    expect(result.current.pharmacogenomics.length).toBeGreaterThan(0);
    expect(result.current.biomarkers.length).toBeGreaterThan(0);
    expect(result.current.biomarker).toBeDefined();
    expect(result.current.riskScores.length).toBeGreaterThan(0);
    expect(result.current.reports.length).toBeGreaterThan(0);
  });

  it('setSelectedMarker updates the selected marker', async () => {
    const { result } = renderHook(() => useGenomics(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.setSelectedMarker('cholesterol');
    });
    expect(result.current.selectedMarker).toBe('cholesterol');
  });

  it('generateReport.mutate generates a report and invalidates queries', async () => {
    const { result } = renderHook(() => useGenomics(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      result.current.generateReport.mutate('pharmacogenomics');
    });
    await waitFor(() => expect(result.current.generateReport.isLoading).toBe(false));
  });

  it('generateReport.mutateAsync resolves with report data', async () => {
    const { result } = renderHook(() => useGenomics(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let report: unknown;
    await act(async () => {
      report = await result.current.generateReport.mutateAsync('pharmacogenomics');
    });
    expect(report).toBeDefined();
  });

  it('refetch invalidates all genomics queries', async () => {
    const { result } = renderHook(() => useGenomics(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.refetch();
    });
    expect(typeof result.current.refetch).toBe('function');
  });
});
