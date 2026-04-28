import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useMPC } from '@/hooks/useMPC';

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

describe('useMPC', () => {
  it('initializes with loading', () => {
    const { result } = renderHook(() => useMPC(), { wrapper: createWrapper() });
    expect(result.current.isLoadingSessions).toBe(true);
  });

  it('loads sessions, results, and datasets', async () => {
    const { result } = renderHook(() => useMPC(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoadingSessions).toBe(false));
    expect(result.current.sessions.length).toBeGreaterThan(0);
    await waitFor(() => expect(result.current.isLoadingResults).toBe(false));
    expect(result.current.results.length).toBeGreaterThan(0);
    await waitFor(() => expect(result.current.isLoadingDatasets).toBe(false));
    expect(result.current.datasets.length).toBeGreaterThan(0);
  });

  it('createSession mutation completes successfully', async () => {
    const { result } = renderHook(() => useMPC(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoadingSessions).toBe(false));

    let createdSession: any;
    await act(async () => {
      createdSession = await result.current.createSession({
        name: 'Test Session',
        protocol: 'SPDZ',
        participants: 3,
        datasetIds: ['mpc-dataset-0'],
      } as any);
    });

    expect(createdSession).toBeDefined();
    expect(createdSession.id).toBeDefined();
    expect(result.current.isCreating).toBe(false);
  });

  it('selectSession updates selectedSession', async () => {
    const { result } = renderHook(() => useMPC(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoadingSessions).toBe(false));

    act(() => {
      result.current.selectSession('mpc-session-0');
    });

    // After selecting, the detail query should fire
    await waitFor(() => expect(result.current.isLoadingDetail).toBe(false));
    expect(result.current.selectedSession).not.toBeNull();
    expect(result.current.selectedSession?.convergence).toBeDefined();
  });

  it('selectSession with null clears selection', async () => {
    const { result } = renderHook(() => useMPC(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoadingSessions).toBe(false));

    act(() => {
      result.current.selectSession('mpc-session-0');
    });

    await waitFor(() => expect(result.current.selectedSession).not.toBeNull());

    act(() => {
      result.current.selectSession(null);
    });

    expect(result.current.selectedSession).toBeNull();
  });

  it('refetch triggers without error', async () => {
    const { result } = renderHook(() => useMPC(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoadingSessions).toBe(false));

    act(() => {
      result.current.refetch();
    });

    expect(result.current.error).toBeNull();
  });
});
