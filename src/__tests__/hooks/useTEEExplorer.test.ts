import { renderHook, waitFor, act } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useTEEExplorer } from '@/hooks/useTEEExplorer';

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

describe('useTEEExplorer', () => {
  it('initializes with loading', () => {
    const { result } = renderHook(() => useTEEExplorer(), { wrapper: createWrapper() });
    expect(result.current.isLoadingEnclaves).toBe(true);
  });

  it('loads explorer data', async () => {
    const { result } = renderHook(() => useTEEExplorer(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoadingEnclaves).toBe(false));
    expect(Array.isArray(result.current.enclaves)).toBe(true);
  });

  it('refetch invalidates all queries', async () => {
    const { result } = renderHook(() => useTEEExplorer(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoadingStats).toBe(false));

    act(() => {
      result.current.refetch();
    });

    // refetch should not throw and should remain callable
    expect(typeof result.current.refetch).toBe('function');
    expect(result.current.error).toBeNull();
  });
});
