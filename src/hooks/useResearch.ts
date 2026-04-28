'use client';

import { useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { ResearchStudy, DataContribution, RecordType } from '@/types';

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

const STUDIES_KEY = 'research-studies';
const CONTRIBUTIONS_KEY = 'research-contributions';

// ---------------------------------------------------------------------------
// Return type
// ---------------------------------------------------------------------------

export interface UseResearchReturn {
  /** All research studies. */
  studies: ResearchStudy[];
  /** User's data contributions. */
  contributions: DataContribution[];
  /** Whether studies are loading. */
  isLoading: boolean;
  /** Whether contributions are loading. */
  isLoadingContributions: boolean;
  /** Error from the queries, if any. */
  error: Error | null;
  /** Enroll in a study mutation. */
  enrollMutation: {
    mutate: (id: string) => void;
    mutateAsync: (id: string) => Promise<ResearchStudy>;
    isLoading: boolean;
    error: Error | null;
  };
  /** Contribute data mutation. */
  contributeMutation: {
    mutate: (params: { studyId: string; dataTypes: RecordType[] }) => void;
    mutateAsync: (params: {
      studyId: string;
      dataTypes: RecordType[];
    }) => Promise<DataContribution>;
    isLoading: boolean;
    error: Error | null;
  };
  /** Count of active studies (recruiting + active). */
  activeStudyCount: number;
  /** Force re-fetch. */
  refetch: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useResearch(): UseResearchReturn {
  const queryClient = useQueryClient();

  const studiesQuery = useQuery({
    queryKey: [STUDIES_KEY],
    queryFn: () => api.get<ResearchStudy[]>('/api/research/studies'),
    staleTime: 30_000,
  });

  const contributionsQuery = useQuery({
    queryKey: [CONTRIBUTIONS_KEY],
    queryFn: () =>
      api.get<DataContribution[]>('/api/research/studies', { include: 'contributions' }),
    staleTime: 30_000,
  });

  const enrollMut = useMutation({
    mutationFn: (id: string) =>
      api.post<ResearchStudy>(`/api/research/studies`, { studyId: id, action: 'enroll' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [STUDIES_KEY] });
    },
  });

  const contributeMut = useMutation({
    mutationFn: (params: { studyId: string; dataTypes: RecordType[] }) =>
      api.post<DataContribution>('/api/research/studies', { ...params, action: 'contribute' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CONTRIBUTIONS_KEY] });
    },
  });

  const studies = useMemo(() => studiesQuery.data ?? [], [studiesQuery.data]);
  const contributions = contributionsQuery.data ?? [];

  const activeStudyCount = useMemo(
    () => studies.filter((s) => s.status === 'recruiting' || s.status === 'active').length,
    [studies],
  );

  const refetch = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: [STUDIES_KEY] });
    queryClient.invalidateQueries({ queryKey: [CONTRIBUTIONS_KEY] });
  }, [queryClient]);

  return {
    studies,
    contributions,
    isLoading: studiesQuery.isLoading,
    isLoadingContributions: contributionsQuery.isLoading,
    error: (studiesQuery.error ?? contributionsQuery.error) as Error | null,
    enrollMutation: {
      mutate: enrollMut.mutate,
      mutateAsync: enrollMut.mutateAsync,
      isLoading: enrollMut.isPending,
      error: enrollMut.error as Error | null,
    },
    contributeMutation: {
      mutate: contributeMut.mutate,
      mutateAsync: contributeMut.mutateAsync,
      isLoading: contributeMut.isPending,
      error: contributeMut.error as Error | null,
    },
    activeStudyCount,
    refetch,
  };
}
