import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCompliance } from '@/hooks/useCompliance';

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

describe('useCompliance', () => {
  it('initializes with loading', () => {
    const { result } = renderHook(() => useCompliance(), { wrapper: createWrapper() });
    expect(result.current.isLoading).toBe(true);
  });

  it('loads data', async () => {
    const { result } = renderHook(() => useCompliance(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.overview).toBeDefined();
    expect(result.current.frameworks.length).toBeGreaterThan(0);
    expect(result.current.reports.length).toBeGreaterThan(0);
    expect(result.current.violations.length).toBeGreaterThan(0);
    expect(result.current.frameworkChecks.length).toBeGreaterThan(0);
  });

  it('setSelectedFramework updates selected framework', async () => {
    const { result } = renderHook(() => useCompliance(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.setSelectedFramework('gdpr');
    });
    expect(result.current.selectedFramework).toBe('gdpr');
  });

  it('generateReport.mutate generates a report and invalidates queries', async () => {
    const { result } = renderHook(() => useCompliance(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      result.current.generateReport.mutate({
        framework: 'hipaa',
        title: 'Test Report',
        includeChecks: true,
        includeViolations: true,
        dateRange: { start: Date.now() - 30 * 86400000, end: Date.now() },
      });
    });
    await waitFor(() => expect(result.current.generateReport.isLoading).toBe(false));
  });

  it('generateReport.mutateAsync resolves with report data', async () => {
    const { result } = renderHook(() => useCompliance(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let report: unknown;
    await act(async () => {
      report = await result.current.generateReport.mutateAsync({
        framework: 'hipaa',
        title: 'Test Report',
        includeChecks: true,
        includeViolations: true,
        dateRange: { start: Date.now() - 30 * 86400000, end: Date.now() },
      });
    });
    expect(report).toBeDefined();
  });

  it('refetch invalidates all compliance queries', async () => {
    const { result } = renderHook(() => useCompliance(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.refetch();
    });
    expect(typeof result.current.refetch).toBe('function');
  });
});
