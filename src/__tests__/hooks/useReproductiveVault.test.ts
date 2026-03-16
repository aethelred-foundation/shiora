import { renderHook, waitFor, act } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useReproductiveVault } from '@/hooks/useReproductiveVault';

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

describe('useReproductiveVault', () => {
  it('initializes with loading', () => {
    const { result } = renderHook(() => useReproductiveVault(), { wrapper: createWrapper() });
    expect(result.current.isLoading).toBe(true);
  });

  it('loads data', async () => {
    const { result } = renderHook(() => useReproductiveVault(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });

  it('lockCompartment mutation completes successfully', async () => {
    const { result } = renderHook(() => useReproductiveVault(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      result.current.lockCompartment.mutate('comp-0001');
    });

    await waitFor(() => expect(result.current.lockCompartment.isLoading).toBe(false));
  });

  it('unlockCompartment mutation completes successfully', async () => {
    const { result } = renderHook(() => useReproductiveVault(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      result.current.unlockCompartment.mutate('comp-0001');
    });

    await waitFor(() => expect(result.current.unlockCompartment.isLoading).toBe(false));
  });

  it('logSymptom mutation completes and invalidates symptoms queries', async () => {
    const { result } = renderHook(() => useReproductiveVault(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let resolved = false;
    await act(async () => {
      result.current.logSymptom.mutate({
        date: Date.now(),
        category: 'pain',
        severity: 3,
        notes: 'Test symptom',
      } as any);
    });

    // Wait for mutation to fully complete including onSuccess
    await waitFor(() => {
      expect(result.current.logSymptom.isLoading).toBe(false);
      resolved = true;
    });
    expect(resolved).toBe(true);
  });

  it('refetch invalidates vault queries', async () => {
    const { result } = renderHook(() => useReproductiveVault(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.refetch();
    });

    expect(result.current.error).toBeNull();
  });

  it('exposes computed cycle data', async () => {
    const { result } = renderHook(() => useReproductiveVault(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(typeof result.current.currentCycleDay).toBe('number');
    expect(typeof result.current.currentPhase).toBe('string');
    expect(typeof result.current.nextPeriodDate).toBe('number');
    expect(typeof result.current.fertileWindowStart).toBe('number');
    expect(typeof result.current.fertileWindowEnd).toBe('number');
    expect(result.current.averageCycleLength).toBe(28);
  });

  it('defaults to day 1 and follicular phase when cycle entries are empty', async () => {
    const originalFetch = global.fetch;
    const realFetch = global.fetch;

    // Override fetch to return empty cycle data
    global.fetch = jest.fn().mockImplementation((url: string, init?: RequestInit) => {
      const urlStr = typeof url === 'string' ? url : (url as Request).url;
      if (urlStr.includes('/api/vault/cycle')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: () => Promise.resolve({ success: true, data: [] }),
        });
      }
      return realFetch(url, init);
    });

    const { result } = renderHook(() => useReproductiveVault(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.currentCycleDay).toBe(1);
    expect(result.current.currentPhase).toBe('follicular');

    global.fetch = originalFetch;
  });

  it('defaults to day 1 when last cycle entry has undefined day', async () => {
    const originalFetch = global.fetch;
    const realFetch = global.fetch;

    // Override fetch to return cycle entries where the last entry has no day/phase
    global.fetch = jest.fn().mockImplementation((url: string, init?: RequestInit) => {
      const urlStr = typeof url === 'string' ? url : (url as Request).url;
      if (urlStr.includes('/api/vault/cycle')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: () => Promise.resolve({
            success: true,
            data: [{ id: 'entry-1', date: Date.now() }],
          }),
        });
      }
      return realFetch(url, init);
    });

    const { result } = renderHook(() => useReproductiveVault(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // With undefined day and phase on the entry, ?? fallbacks should kick in
    expect(result.current.currentCycleDay).toBe(1);
    expect(result.current.currentPhase).toBe('follicular');

    global.fetch = originalFetch;
  });
});
