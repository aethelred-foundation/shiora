import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { usePrivacyRights } from '@/hooks/usePrivacyRights';

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

describe('usePrivacyRights', () => {
  it('initializes with loading state', () => {
    const { result } = renderHook(() => usePrivacyRights(), { wrapper: createWrapper() });
    expect(result.current.isLoading).toBe(true);
    expect(result.current.requests).toEqual([]);
  });

  it('loads privacy requests', async () => {
    const { result } = renderHook(() => usePrivacyRights(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.requests.length).toBeGreaterThan(0);
  });

  it('pendingCount is computed correctly', async () => {
    const { result } = renderHook(() => usePrivacyRights(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const manualCount = result.current.requests.filter(
      (r) => r.status === 'pending' || r.status === 'processing',
    ).length;
    expect(result.current.pendingCount).toBe(manualCount);
  });

  it('submitAccess mutation completes successfully', async () => {
    const { result } = renderHook(() => usePrivacyRights(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      result.current.mutations.submitAccess.mutate(['lab_results', 'cycle_data']);
    });

    await waitFor(() => expect(result.current.mutations.submitAccess.isLoading).toBe(false));
  });

  it('submitErasure mutation completes successfully', async () => {
    const { result } = renderHook(() => usePrivacyRights(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      result.current.mutations.submitErasure.mutate(['lab_results']);
    });

    await waitFor(() => expect(result.current.mutations.submitErasure.isLoading).toBe(false));
  });

  it('submitPortability mutation completes successfully', async () => {
    const { result } = renderHook(() => usePrivacyRights(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      result.current.mutations.submitPortability.mutate({
        categories: ['cycle_data', 'lab_results'],
        format: 'json',
      });
    });

    await waitFor(() => expect(result.current.mutations.submitPortability.isLoading).toBe(false));
  });

  it('refetch triggers without error', async () => {
    const { result } = renderHook(() => usePrivacyRights(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.refetch();
    });

    expect(result.current.error).toBeNull();
  });
});
