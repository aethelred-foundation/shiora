'use client';

import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { PrivacyRequest } from '@/types';

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

const PRIVACY_REQUESTS_KEY = 'privacy-requests';

// ---------------------------------------------------------------------------
// Return type
// ---------------------------------------------------------------------------

export interface UsePrivacyRightsReturn {
  /** All privacy requests sorted by date (newest first). */
  requests: PrivacyRequest[];
  /** Whether the requests query is loading. */
  isLoading: boolean;
  /** Error from the query, if any. */
  error: Error | null;

  /** Mutation handlers for submitting requests. */
  mutations: {
    submitAccess: {
      mutate: (categories: string[]) => void;
      mutateAsync: (categories: string[]) => Promise<PrivacyRequest>;
      isLoading: boolean;
    };
    submitErasure: {
      mutate: (categories: string[]) => void;
      mutateAsync: (categories: string[]) => Promise<PrivacyRequest>;
      isLoading: boolean;
    };
    submitPortability: {
      mutate: (params: { categories: string[]; format: string }) => void;
      mutateAsync: (params: { categories: string[]; format: string }) => Promise<PrivacyRequest>;
      isLoading: boolean;
    };
  };

  /** Count of requests currently in pending or processing status. */
  pendingCount: number;

  /** Force re-fetch requests. */
  refetch: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function usePrivacyRights(): UsePrivacyRightsReturn {
  const queryClient = useQueryClient();

  // ---- Requests query ----------------------------------------------------

  const listQuery = useQuery({
    queryKey: [PRIVACY_REQUESTS_KEY],
    queryFn: () => api.get<PrivacyRequest[]>('/api/privacy/access-request'),
    staleTime: 30_000,
  });

  // ---- Access request mutation -------------------------------------------

  const accessMutation = useMutation({
    mutationFn: (categories: string[]) =>
      api.post<PrivacyRequest>('/api/privacy/access-request', { categories }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PRIVACY_REQUESTS_KEY] });
    },
  });

  // ---- Erasure request mutation ------------------------------------------

  const erasureMutation = useMutation({
    mutationFn: (categories: string[]) =>
      api.post<PrivacyRequest>('/api/privacy/erasure', { categories }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PRIVACY_REQUESTS_KEY] });
    },
  });

  // ---- Portability request mutation --------------------------------------

  const portabilityMutation = useMutation({
    mutationFn: (params: { categories: string[]; format: string }) =>
      api.post<PrivacyRequest>('/api/privacy/portability', params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PRIVACY_REQUESTS_KEY] });
    },
  });

  // ---- Computed ----------------------------------------------------------

  const requests = listQuery.data ?? [];
  const pendingCount = requests.filter(
    (r) => r.status === 'pending' || r.status === 'processing',
  ).length;

  // ---- Refetch -----------------------------------------------------------

  const refetch = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: [PRIVACY_REQUESTS_KEY] });
  }, [queryClient]);

  return {
    requests,
    isLoading: listQuery.isLoading,
    error: listQuery.error as Error | null,

    mutations: {
      submitAccess: {
        mutate: accessMutation.mutate,
        mutateAsync: accessMutation.mutateAsync,
        isLoading: accessMutation.isPending,
      },
      submitErasure: {
        mutate: erasureMutation.mutate,
        mutateAsync: erasureMutation.mutateAsync,
        isLoading: erasureMutation.isPending,
      },
      submitPortability: {
        mutate: portabilityMutation.mutate,
        mutateAsync: portabilityMutation.mutateAsync,
        isLoading: portabilityMutation.isPending,
      },
    },

    pendingCount,
    refetch,
  };
}
