'use client';

import { useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type {
  RewardEntry,
  RewardStreak,
  RewardStats,
} from '@/types';

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

const REWARDS_KEY = 'rewards';
const STREAKS_KEY = 'reward-streaks';
const STATS_KEY = 'reward-stats';
const DAILY_EARNINGS_KEY = 'reward-daily-earnings';

// ---------------------------------------------------------------------------
// Return type
// ---------------------------------------------------------------------------

export interface UseRewardsReturn {
  /** All reward entries. */
  rewards: RewardEntry[];
  /** Reward streaks for each action type. */
  streaks: RewardStreak[];
  /** Aggregate reward stats. */
  stats: RewardStats | null;
  /** Whether rewards are loading. */
  isLoading: boolean;
  /** Error from the list query, if any. */
  error: Error | null;
  /** Claim a reward mutation. */
  claimReward: {
    mutate: (id: string) => void;
    mutateAsync: (id: string) => Promise<RewardEntry>;
    isLoading: boolean;
    error: Error | null;
  };
  /** Recent (unclaimed) rewards. */
  recentRewards: RewardEntry[];
  /** Daily earnings for 30-day chart. */
  dailyEarnings: { day: string; earned: number }[];
  /** Force re-fetch. */
  refetch: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useRewards(): UseRewardsReturn {
  const queryClient = useQueryClient();

  const rewardsQuery = useQuery({
    queryKey: [REWARDS_KEY],
    queryFn: () => api.get<RewardEntry[]>('/api/rewards'),
    staleTime: 30_000,
  });

  const streaksQuery = useQuery({
    queryKey: [STREAKS_KEY],
    queryFn: () => api.get<RewardStreak[]>('/api/rewards', { include: 'streaks' }),
    staleTime: 30_000,
  });

  const statsQuery = useQuery({
    queryKey: [STATS_KEY],
    queryFn: () => api.get<RewardStats>('/api/rewards', { include: 'stats' }),
    staleTime: 30_000,
  });

  const dailyEarningsQuery = useQuery({
    queryKey: [DAILY_EARNINGS_KEY],
    queryFn: () =>
      api.get<{ day: string; earned: number }[]>('/api/rewards/history'),
    staleTime: 30_000,
  });

  const claimMutation = useMutation({
    mutationFn: (id: string) => api.post<RewardEntry>(`/api/rewards`, { id, action: 'claim' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [REWARDS_KEY] });
      queryClient.invalidateQueries({ queryKey: [STATS_KEY] });
    },
  });

  const rewards = useMemo(() => rewardsQuery.data ?? [], [rewardsQuery.data]);
  const streaks = streaksQuery.data ?? [];

  const recentRewards = useMemo(
    () => rewards.filter((r) => !r.claimedAt).slice(0, 5),
    [rewards],
  );

  const dailyEarnings = dailyEarningsQuery.data ?? [];

  const refetch = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: [REWARDS_KEY] });
    queryClient.invalidateQueries({ queryKey: [STREAKS_KEY] });
    queryClient.invalidateQueries({ queryKey: [STATS_KEY] });
    queryClient.invalidateQueries({ queryKey: [DAILY_EARNINGS_KEY] });
  }, [queryClient]);

  return {
    rewards,
    streaks,
    stats: statsQuery.data ?? null,
    isLoading: rewardsQuery.isLoading || streaksQuery.isLoading,
    error: (rewardsQuery.error ?? streaksQuery.error) as Error | null,
    claimReward: {
      mutate: claimMutation.mutate,
      mutateAsync: claimMutation.mutateAsync,
      isLoading: claimMutation.isPending,
      error: claimMutation.error as Error | null,
    },
    recentRewards,
    dailyEarnings,
    refetch,
  };
}
