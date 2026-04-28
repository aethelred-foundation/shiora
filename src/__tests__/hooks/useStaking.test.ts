import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useStaking } from '@/hooks/useStaking';

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

describe('useStaking', () => {
  it('initializes with loading', () => {
    const { result } = renderHook(() => useStaking(), { wrapper: createWrapper() });
    expect(result.current.isLoading).toBe(true);
  });

  it('loads positions, rewards, and stats', async () => {
    const { result } = renderHook(() => useStaking(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.positions.length).toBeGreaterThan(0);
    expect(result.current.rewards.length).toBeGreaterThan(0);
    expect(result.current.stats).toBeDefined();
    expect(result.current.stats.totalStaked).toBeGreaterThan(0);
  });

  it('stake mutation completes successfully', async () => {
    const { result } = renderHook(() => useStaking(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      result.current.stake.mutate(1000);
    });

    await waitFor(() => expect(result.current.stake.isLoading).toBe(false));
    expect(result.current.stake.error).toBeNull();
  });

  it('unstake mutation completes successfully', async () => {
    const { result } = renderHook(() => useStaking(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      result.current.unstake.mutate('stake-0001');
    });

    await waitFor(() => expect(result.current.unstake.isLoading).toBe(false));
    expect(result.current.unstake.error).toBeNull();
  });

  it('withdraw mutation completes successfully', async () => {
    const { result } = renderHook(() => useStaking(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      result.current.withdraw.mutate('stake-0002');
    });

    await waitFor(() => expect(result.current.withdraw.isLoading).toBe(false));
    expect(result.current.withdraw.error).toBeNull();
  });

  it('claimRewards mutation completes successfully', async () => {
    const { result } = renderHook(() => useStaking(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      result.current.claimRewards.mutate('stake-0001');
    });

    await waitFor(() => expect(result.current.claimRewards.isLoading).toBe(false));
    expect(result.current.claimRewards.error).toBeNull();
  });

  it('totalStaked is computed correctly', async () => {
    const { result } = renderHook(() => useStaking(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const manualTotal = result.current.positions
      .filter((p) => p.status === 'staked')
      .reduce((sum, p) => sum + p.amount, 0);
    expect(result.current.totalStaked).toBe(manualTotal);
  });

  it('pendingRewards is computed correctly', async () => {
    const { result } = renderHook(() => useStaking(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const manualPending = result.current.rewards
      .filter((r) => !r.claimedAt)
      .reduce((sum, r) => sum + r.amount, 0);
    expect(result.current.pendingRewards).toBe(manualPending);
  });

  it('refetch triggers without error', async () => {
    const { result } = renderHook(() => useStaking(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.refetch();
    });

    expect(result.current.error).toBeNull();
  });
});
