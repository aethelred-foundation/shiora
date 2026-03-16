'use client';

import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type {
  TEEPlatformStats,
  TEEVerificationChain,
  TEEComputeJob,
  TEEEnclaveInfo,
} from '@/types';

const STATS_KEY = 'tee-explorer-stats';
const ATTESTATIONS_KEY = 'tee-explorer-attestations';
const JOBS_KEY = 'tee-explorer-jobs';
const ENCLAVES_KEY = 'tee-explorer-enclaves';

export interface UseTEEExplorerReturn {
  stats: TEEPlatformStats | null;
  attestations: TEEVerificationChain[];
  jobs: TEEComputeJob[];
  enclaves: TEEEnclaveInfo[];
  isLoadingStats: boolean;
  isLoadingAttestations: boolean;
  isLoadingJobs: boolean;
  isLoadingEnclaves: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useTEEExplorer(): UseTEEExplorerReturn {
  const queryClient = useQueryClient();

  const statsQuery = useQuery({
    queryKey: [STATS_KEY],
    queryFn: () => api.get<TEEPlatformStats>('/api/tee/explorer?view=stats'),
    staleTime: 30_000,
  });

  const attestationsQuery = useQuery({
    queryKey: [ATTESTATIONS_KEY],
    queryFn: () => api.get<TEEVerificationChain[]>('/api/tee/explorer?view=attestations'),
    staleTime: 30_000,
  });

  const jobsQuery = useQuery({
    queryKey: [JOBS_KEY],
    queryFn: () => api.get<TEEComputeJob[]>('/api/tee/explorer?view=jobs'),
    staleTime: 30_000,
  });

  const enclavesQuery = useQuery({
    queryKey: [ENCLAVES_KEY],
    queryFn: () => api.get<TEEEnclaveInfo[]>('/api/tee/explorer?view=enclaves'),
    staleTime: 30_000,
  });

  const refetch = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: [STATS_KEY] });
    queryClient.invalidateQueries({ queryKey: [ATTESTATIONS_KEY] });
    queryClient.invalidateQueries({ queryKey: [JOBS_KEY] });
    queryClient.invalidateQueries({ queryKey: [ENCLAVES_KEY] });
  }, [queryClient]);

  return {
    stats: statsQuery.data ?? null,
    attestations: attestationsQuery.data ?? [],
    jobs: jobsQuery.data ?? [],
    enclaves: enclavesQuery.data ?? [],
    isLoadingStats: statsQuery.isLoading,
    isLoadingAttestations: attestationsQuery.isLoading,
    isLoadingJobs: jobsQuery.isLoading,
    isLoadingEnclaves: enclavesQuery.isLoading,
    error: (statsQuery.error ?? attestationsQuery.error ?? jobsQuery.error ?? enclavesQuery.error) as Error | null,
    refetch,
  };
}
