import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRewards } from '@/hooks/useRewards';

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

describe('useRewards', () => {
  it('initializes with loading state', () => {
    const { result } = renderHook(() => useRewards(), { wrapper: createWrapper() });
    expect(result.current.isLoading).toBe(true);
    expect(result.current.rewards).toEqual([]);
  });

  it('loads rewards data', async () => {
    const { result } = renderHook(() => useRewards(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(Array.isArray(result.current.rewards)).toBe(true);
    expect(Array.isArray(result.current.streaks)).toBe(true);
    expect(Array.isArray(result.current.recentRewards)).toBe(true);
    expect(Array.isArray(result.current.dailyEarnings)).toBe(true);
    expect(result.current.stats).toBeDefined();
  });

  it('exposes claimReward mutation', async () => {
    const { result } = renderHook(() => useRewards(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(typeof result.current.claimReward.mutate).toBe('function');
  });

  it('claimReward.mutate claims a reward and invalidates queries', async () => {
    const { result } = renderHook(() => useRewards(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      result.current.claimReward.mutate('reward-0003');
    });
    await waitFor(() => expect(result.current.claimReward.isLoading).toBe(false));
  });

  it('claimReward.mutateAsync resolves with reward data', async () => {
    const { result } = renderHook(() => useRewards(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let claimed: unknown;
    await act(async () => {
      claimed = await result.current.claimReward.mutateAsync('reward-0003');
    });
    expect(claimed).toBeDefined();
  });

  it('refetch invalidates all reward queries', async () => {
    const { result } = renderHook(() => useRewards(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.refetch();
    });
    expect(typeof result.current.refetch).toBe('function');
  });
});
