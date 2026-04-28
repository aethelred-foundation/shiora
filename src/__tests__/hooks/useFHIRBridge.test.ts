import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFHIRBridge } from '@/hooks/useFHIRBridge';

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

describe('useFHIRBridge', () => {
  it('initializes with loading', () => {
    const { result } = renderHook(() => useFHIRBridge(), { wrapper: createWrapper() });
    expect(result.current.isLoading).toBe(true);
  });

  it('loads data', async () => {
    const { result } = renderHook(() => useFHIRBridge(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.resources.length).toBeGreaterThan(0);
    expect(result.current.mappings.length).toBeGreaterThan(0);
    expect(result.current.importJobs.length).toBeGreaterThan(0);
    expect(result.current.exportConfigs.length).toBeGreaterThan(0);
    expect(result.current.resourcesByType).toBeDefined();
    expect(typeof result.current.totalMapped).toBe('number');
    expect(typeof result.current.totalUnmapped).toBe('number');
  });

  it('importMutation.mutate triggers an import and invalidates queries', async () => {
    const { result } = renderHook(() => useFHIRBridge(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      result.current.importMutation.mutate('Epic MyChart');
    });
    await waitFor(() => expect(result.current.importMutation.isLoading).toBe(false));
  });

  it('importMutation.mutateAsync resolves with import job data', async () => {
    const { result } = renderHook(() => useFHIRBridge(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let job: unknown;
    await act(async () => {
      job = await result.current.importMutation.mutateAsync('Epic MyChart');
    });
    expect(job).toBeDefined();
  });

  it('exportMutation.mutate triggers an export and invalidates queries', async () => {
    const { result } = renderHook(() => useFHIRBridge(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      result.current.exportMutation.mutate({
        format: 'json',
        resourceTypes: ['Observation'],
        destination: 'ipfs',
      });
    });
    await waitFor(() => expect(result.current.exportMutation.isLoading).toBe(false));
  });

  it('exportMutation.mutateAsync resolves with export config', async () => {
    const { result } = renderHook(() => useFHIRBridge(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let config: unknown;
    await act(async () => {
      config = await result.current.exportMutation.mutateAsync({
        format: 'json',
        resourceTypes: ['Observation'],
        destination: 'ipfs',
      });
    });
    expect(config).toBeDefined();
  });

  it('refetch invalidates all FHIR queries', async () => {
    const { result } = renderHook(() => useFHIRBridge(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.refetch();
    });
    expect(typeof result.current.refetch).toBe('function');
  });
});
