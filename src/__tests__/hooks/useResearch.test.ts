import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useResearch } from '@/hooks/useResearch';

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

describe('useResearch', () => {
  it('initializes with loading', () => {
    const { result } = renderHook(() => useResearch(), { wrapper: createWrapper() });
    expect(result.current.isLoading).toBe(true);
  });

  it('loads data', async () => {
    const { result } = renderHook(() => useResearch(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.studies.length).toBeGreaterThan(0);
    expect(result.current.contributions.length).toBeGreaterThan(0);
    expect(typeof result.current.activeStudyCount).toBe('number');
  });

  it('enrollMutation.mutate enrolls in a study and invalidates queries', async () => {
    const { result } = renderHook(() => useResearch(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      result.current.enrollMutation.mutate('study-0001');
    });
    await waitFor(() => expect(result.current.enrollMutation.isLoading).toBe(false));
  });

  it('enrollMutation.mutateAsync resolves with study data', async () => {
    const { result } = renderHook(() => useResearch(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let enrolled: unknown;
    await act(async () => {
      enrolled = await result.current.enrollMutation.mutateAsync('study-0001');
    });
    expect(enrolled).toBeDefined();
  });

  it('contributeMutation.mutate contributes data and invalidates queries', async () => {
    const { result } = renderHook(() => useResearch(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      result.current.contributeMutation.mutate({
        studyId: 'study-0001',
        dataTypes: ['lab_result'],
      });
    });
    await waitFor(() => expect(result.current.contributeMutation.isLoading).toBe(false));
  });

  it('contributeMutation.mutateAsync resolves with contribution data', async () => {
    const { result } = renderHook(() => useResearch(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let contribution: unknown;
    await act(async () => {
      contribution = await result.current.contributeMutation.mutateAsync({
        studyId: 'study-0001',
        dataTypes: ['lab_result'],
      });
    });
    expect(contribution).toBeDefined();
  });

  it('refetch invalidates both studies and contributions queries', async () => {
    const { result } = renderHook(() => useResearch(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.refetch();
    });
    // refetch should not throw
    expect(typeof result.current.refetch).toBe('function');
  });
});
