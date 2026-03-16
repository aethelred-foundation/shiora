/**
 * useStaking — Staking positions, rewards, and stats management.
 *
 * Uses @tanstack/react-query for data fetching and the shared API client
 * for all server communication.
 */

'use client';

import { useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';

import type {
  StakingPosition,
  StakingReward,
  StakingStats,
} from '@/types';

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

const POSITIONS_KEY = 'staking-positions';
const REWARDS_KEY = 'staking-rewards';
const STAKING_STATS_KEY = 'staking-stats';

// ---------------------------------------------------------------------------
// Default stats fallback
// ---------------------------------------------------------------------------

const DEFAULT_STATS: StakingStats = {
  totalStaked: 0,
  totalStakers: 0,
  currentAPY: 0,
  rewardsDistributed: 0,
  nextRewardEpoch: 0,
  minStakeAmount: 100,
  unstakeCooldownDays: 7,
};

// ---------------------------------------------------------------------------
// Return type
// ---------------------------------------------------------------------------

export interface UseStakingReturn {
  positions: StakingPosition[];
  rewards: StakingReward[];
  stats: StakingStats;
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  totalStaked: number;
  pendingRewards: number;

  stake: {
    mutate: (amount: number) => void;
    mutateAsync: (amount: number) => Promise<StakingPosition>;
    isLoading: boolean;
    error: Error | null;
  };

  unstake: {
    mutate: (positionId: string) => void;
    isLoading: boolean;
    error: Error | null;
  };

  withdraw: {
    mutate: (positionId: string) => void;
    isLoading: boolean;
    error: Error | null;
  };

  claimRewards: {
    mutate: (positionId: string) => void;
    isLoading: boolean;
    error: Error | null;
  };

  refetch: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useStaking(): UseStakingReturn {
  const queryClient = useQueryClient();

  // ---- Queries ----

  const positionsQuery = useQuery({
    queryKey: [POSITIONS_KEY],
    queryFn: () => api.get<StakingPosition[]>('/api/staking'),
    placeholderData: (prev) => prev,
    staleTime: 30_000,
  });

  const rewardsQuery = useQuery({
    queryKey: [REWARDS_KEY],
    queryFn: () => api.get<StakingReward[]>('/api/staking/rewards'),
    staleTime: 30_000,
  });

  const statsQuery = useQuery({
    queryKey: [STAKING_STATS_KEY],
    queryFn: () => api.get<StakingStats>('/api/staking', { view: 'stats' }),
    staleTime: 30_000,
  });

  // ---- Mutations ----

  const stakeMutation = useMutation({
    mutationFn: (amount: number) =>
      api.post<StakingPosition>('/api/staking', { amount }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [POSITIONS_KEY] });
    },
  });

  const unstakeMutation = useMutation({
    mutationFn: (positionId: string) =>
      api.post<StakingPosition>(`/api/staking/${positionId}/unstake`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [POSITIONS_KEY] });
    },
  });

  const withdrawMutation = useMutation({
    mutationFn: (positionId: string) =>
      api.post<void>(`/api/staking/${positionId}/withdraw`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [POSITIONS_KEY] });
    },
  });

  const claimMutation = useMutation({
    mutationFn: (positionId: string) =>
      api.post<void>('/api/staking/rewards', { positionId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [REWARDS_KEY] });
    },
  });

  // ---- Computed ----

  const positions = useMemo(() => positionsQuery.data ?? [], [positionsQuery.data]);
  const rewards = useMemo(() => rewardsQuery.data ?? [], [rewardsQuery.data]);

  const totalStaked = useMemo(
    () => positions.filter((p) => p.status === 'staked').reduce((sum, p) => sum + p.amount, 0),
    [positions],
  );

  const pendingRewards = useMemo(
    () => rewards.filter((r) => !r.claimedAt).reduce((sum, r) => sum + r.amount, 0),
    [rewards],
  );

  const refetch = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: [POSITIONS_KEY] });
    queryClient.invalidateQueries({ queryKey: [REWARDS_KEY] });
  }, [queryClient]);

  return {
    positions,
    rewards,
    stats: statsQuery.data ?? DEFAULT_STATS,
    isLoading: positionsQuery.isLoading,
    isFetching: positionsQuery.isFetching,
    error: positionsQuery.error as Error | null,
    totalStaked,
    pendingRewards,

    stake: {
      mutate: stakeMutation.mutate,
      mutateAsync: stakeMutation.mutateAsync,
      isLoading: stakeMutation.isPending,
      error: stakeMutation.error as Error | null,
    },

    unstake: {
      mutate: unstakeMutation.mutate,
      isLoading: unstakeMutation.isPending,
      error: unstakeMutation.error as Error | null,
    },

    withdraw: {
      mutate: withdrawMutation.mutate,
      isLoading: withdrawMutation.isPending,
      error: withdrawMutation.error as Error | null,
    },

    claimRewards: {
      mutate: claimMutation.mutate,
      isLoading: claimMutation.isPending,
      error: claimMutation.error as Error | null,
    },

    refetch,
  };
}
