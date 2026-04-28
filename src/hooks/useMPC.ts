'use client';

import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  MPCSession,
  MPCResult,
  MPCDataset,
  MPCConvergencePoint,
  CreateMPCSessionForm,
} from '@/types';
import { api } from '@/lib/api/client';

// ────────────────────────────────────────────────────────────
// Query keys
// ────────────────────────────────────────────────────────────

const SESSIONS_KEY = 'mpc-sessions';
const SESSION_DETAIL_KEY = 'mpc-session-detail';
const RESULTS_KEY = 'mpc-results';
const DATASETS_KEY = 'mpc-datasets';

// ────────────────────────────────────────────────────────────
// Return type
// ────────────────────────────────────────────────────────────

export interface UseMPCReturn {
  sessions: MPCSession[];
  results: MPCResult[];
  datasets: MPCDataset[];
  selectedSession: (MPCSession & { convergence: MPCConvergencePoint[] }) | null;
  isLoadingSessions: boolean;
  isLoadingResults: boolean;
  isLoadingDatasets: boolean;
  isLoadingDetail: boolean;
  error: Error | null;
  createSession: (form: CreateMPCSessionForm) => Promise<MPCSession>;
  isCreating: boolean;
  selectSession: (id: string | null) => void;
  refetch: () => void;
}

// ────────────────────────────────────────────────────────────
// Hook
// ────────────────────────────────────────────────────────────

export function useMPC(): UseMPCReturn {
  const queryClient = useQueryClient();
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  // ---- Sessions list ----
  const sessionsQuery = useQuery({
    queryKey: [SESSIONS_KEY],
    queryFn: () => api.get<MPCSession[]>('/api/mpc/sessions'),
    staleTime: 30_000,
  });

  // ---- Results list ----
  const resultsQuery = useQuery({
    queryKey: [RESULTS_KEY],
    queryFn: () => api.get<MPCResult[]>('/api/mpc/results'),
    staleTime: 30_000,
  });

  // ---- Datasets list ----
  const datasetsQuery = useQuery({
    queryKey: [DATASETS_KEY],
    queryFn: () => api.get<MPCDataset[]>('/api/mpc/datasets'),
    staleTime: 30_000,
  });

  // ---- Session detail (with convergence) ----
  const detailQuery = useQuery({
    queryKey: [SESSION_DETAIL_KEY, selectedSessionId],
    queryFn: () =>
      api.get<MPCSession & { convergence: MPCConvergencePoint[] }>(
        `/api/mpc/sessions/${selectedSessionId}`,
      ),
    enabled: !!selectedSessionId,
    staleTime: 30_000,
  });

  // ---- Create session mutation ----
  const createMutation = useMutation({
    mutationFn: (form: CreateMPCSessionForm) => api.post<MPCSession>('/api/mpc/sessions', form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SESSIONS_KEY] });
    },
  });

  // ---- Actions ----
  const selectSession = useCallback((id: string | null) => {
    setSelectedSessionId(id);
  }, []);

  const refetch = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: [SESSIONS_KEY] });
    queryClient.invalidateQueries({ queryKey: [RESULTS_KEY] });
    queryClient.invalidateQueries({ queryKey: [DATASETS_KEY] });
  }, [queryClient]);

  return {
    sessions: sessionsQuery.data ?? [],
    results: resultsQuery.data ?? [],
    datasets: datasetsQuery.data ?? [],
    selectedSession: detailQuery.data ?? null,
    isLoadingSessions: sessionsQuery.isLoading,
    isLoadingResults: resultsQuery.isLoading,
    isLoadingDatasets: datasetsQuery.isLoading,
    isLoadingDetail: detailQuery.isLoading,
    error: (sessionsQuery.error ?? resultsQuery.error ?? datasetsQuery.error) as Error | null,
    createSession: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    selectSession,
    refetch,
  };
}
