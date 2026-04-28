'use client';

import { useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { ProviderReputation, ProviderReview } from '@/types';

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

const PROVIDERS_KEY = 'provider-reputations';
const REVIEWS_KEY = 'provider-reviews';

// ---------------------------------------------------------------------------
// Return type
// ---------------------------------------------------------------------------

export interface UseProviderReputationReturn {
  /** All providers with reputation data. */
  providers: ProviderReputation[];
  /** Whether providers are loading. */
  isLoading: boolean;
  /** Error from the list query, if any. */
  error: Error | null;
  /** Fetch reviews for a specific provider address. */
  useReviews: (address: string | null) => {
    reviews: ProviderReview[];
    isLoading: boolean;
    error: Error | null;
  };
  /** Submit a review mutation. */
  submitReview: {
    mutate: (params: {
      address: string;
      rating: 1 | 2 | 3 | 4 | 5;
      categories: ProviderReview['categories'];
      comment: string;
    }) => void;
    mutateAsync: (params: {
      address: string;
      rating: 1 | 2 | 3 | 4 | 5;
      categories: ProviderReview['categories'];
      comment: string;
    }) => Promise<ProviderReview>;
    isLoading: boolean;
    error: Error | null;
  };
  /** Top providers by score. */
  topProviders: ProviderReputation[];
  /** Average score across all providers. */
  averageScore: number;
  /** Fetch score history for a provider. */
  getScoreHistory: (address: string) => { month: string; score: number }[];
  /** Force re-fetch. */
  refetch: () => void;
}

// ---------------------------------------------------------------------------
// Score history cache — fetched lazily per provider
// ---------------------------------------------------------------------------

const scoreHistoryCache = new Map<string, { month: string; score: number }[]>();

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useProviderReputation(): UseProviderReputationReturn {
  const queryClient = useQueryClient();

  const providersQuery = useQuery({
    queryKey: [PROVIDERS_KEY],
    queryFn: () => api.get<ProviderReputation[]>('/api/providers/reputation'),
    staleTime: 30_000,
  });

  const providers = useMemo(() => providersQuery.data ?? [], [providersQuery.data]);

  // Nested hook for reviews by provider address
  const useReviews = useCallback((address: string | null) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const query = useQuery({
      queryKey: [REVIEWS_KEY, address],
      queryFn: () => api.get<ProviderReview[]>(`/api/providers/${address}`),
      enabled: address !== null,
      staleTime: 30_000,
    });
    return {
      reviews: query.data ?? [],
      isLoading: query.isLoading,
      error: query.error as Error | null,
    };
  }, []);

  const submitMutation = useMutation({
    mutationFn: (params: {
      address: string;
      rating: 1 | 2 | 3 | 4 | 5;
      categories: ProviderReview['categories'];
      comment: string;
    }) => api.post<ProviderReview>(`/api/providers/${params.address}`, params),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [REVIEWS_KEY, variables.address] });
      queryClient.invalidateQueries({ queryKey: [PROVIDERS_KEY] });
    },
  });

  const topProviders = useMemo(
    () => [...providers].sort((a, b) => b.overallScore - a.overallScore).slice(0, 5),
    [providers],
  );

  const averageScore = useMemo(() => {
    if (providers.length === 0) return 0;
    return Math.round(providers.reduce((sum, p) => sum + p.overallScore, 0) / providers.length);
  }, [providers]);

  const getScoreHistory = useCallback((address: string): { month: string; score: number }[] => {
    // Return cached value if available; the data is fetched lazily on first call
    if (scoreHistoryCache.has(address)) {
      return scoreHistoryCache.get(address)!;
    }
    // Fire-and-forget fetch; return empty until cached
    api
      .get<{ month: string; score: number }[]>(`/api/providers/${address}`, {
        include: 'score-history',
      })
      .then((data) => {
        scoreHistoryCache.set(address, data);
      })
      .catch(() => {
        // Ignore — caller will retry
      });
    return [];
  }, []);

  const refetch = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: [PROVIDERS_KEY] });
  }, [queryClient]);

  return {
    providers,
    isLoading: providersQuery.isLoading,
    error: providersQuery.error as Error | null,
    useReviews,
    submitReview: {
      mutate: submitMutation.mutate,
      mutateAsync: submitMutation.mutateAsync,
      isLoading: submitMutation.isPending,
      error: submitMutation.error as Error | null,
    },
    topProviders,
    averageScore,
    getScoreHistory,
    refetch,
  };
}
