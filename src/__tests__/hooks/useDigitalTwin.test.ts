import { renderHook, waitFor, act } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useDigitalTwin } from '@/hooks/useDigitalTwin';

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

describe('useDigitalTwin', () => {
  it('initializes with loading', () => {
    const { result } = renderHook(() => useDigitalTwin(), { wrapper: createWrapper() });
    expect(result.current.isLoading).toBe(true);
  });

  it('loads twin data', async () => {
    const { result } = renderHook(() => useDigitalTwin(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.twin).toBeDefined();
  });

  it('runSimulation mutation completes and invalidates queries', async () => {
    const { result } = renderHook(() => useDigitalTwin(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      result.current.runSimulation.mutate({
        scenario: 'weight-loss',
        description: 'Test simulation',
        parameters: {},
        durationDays: 30,
      } as any);
    });

    await waitFor(() => expect(result.current.runSimulation.isLoading).toBe(false));
    expect(result.current.runSimulation.error).toBeNull();
  });

  it('setParameterOverride updates overrides', async () => {
    const { result } = renderHook(() => useDigitalTwin(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.setParameterOverride('weight', 75);
    });

    expect(result.current.parameterOverrides).toEqual({ weight: 75 });
  });

  it('resetOverrides clears all overrides', async () => {
    const { result } = renderHook(() => useDigitalTwin(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.setParameterOverride('weight', 75);
    });
    expect(result.current.parameterOverrides).toEqual({ weight: 75 });

    act(() => {
      result.current.resetOverrides();
    });
    expect(result.current.parameterOverrides).toEqual({});
  });

  it('refetch invalidates all queries', async () => {
    const { result } = renderHook(() => useDigitalTwin(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.refetch();
    });

    expect(result.current.error).toBeNull();
  });
});
