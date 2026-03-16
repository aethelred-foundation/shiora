/**
 * useGenomics — Genomics & Biomarker Lab data fetching and state management.
 *
 * Uses @tanstack/react-query for data fetching and the shared API client
 * for all server communication.
 */

'use client';

import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';

import type {
  GenomicsOverview,
  PharmacogenomicResult,
  Biomarker,
  PolygenicRiskScore,
  GenomicReport,
} from '@/types';

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

const OVERVIEW_KEY = 'genomics-overview';
const PHARMACOGENOMICS_KEY = 'genomics-pharmacogenomics';
const BIOMARKERS_KEY = 'genomics-biomarkers';
const BIOMARKER_KEY = 'genomics-biomarker';
const RISK_SCORES_KEY = 'genomics-risk-scores';
const REPORTS_KEY = 'genomics-reports';

// ---------------------------------------------------------------------------
// Return type
// ---------------------------------------------------------------------------

export interface UseGenomicsReturn {
  overview: GenomicsOverview | undefined;
  pharmacogenomics: PharmacogenomicResult[];
  biomarkers: Biomarker[];
  biomarker: Biomarker | undefined;
  riskScores: PolygenicRiskScore[];
  reports: GenomicReport[];

  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;

  selectedMarker: string;
  setSelectedMarker: (marker: string) => void;

  generateReport: {
    mutate: (category: string) => void;
    mutateAsync: (category: string) => Promise<GenomicReport>;
    isLoading: boolean;
    error: Error | null;
  };

  refetch: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useGenomics(): UseGenomicsReturn {
  const queryClient = useQueryClient();

  const [selectedMarker, setSelectedMarker] = useState<string>('hba1c');

  // ---- Queries ----

  const overviewQuery = useQuery({
    queryKey: [OVERVIEW_KEY],
    queryFn: () => api.get<GenomicsOverview>('/api/genomics', { view: 'overview' }),
    staleTime: 30_000,
  });

  const pharmacogenomicsQuery = useQuery({
    queryKey: [PHARMACOGENOMICS_KEY],
    queryFn: () => api.get<PharmacogenomicResult[]>('/api/genomics', { view: 'pharmacogenomics' }),
    staleTime: 30_000,
  });

  // Fetch all 10 biomarkers as an array (for grid display)
  const biomarkersQuery = useQuery({
    queryKey: [BIOMARKERS_KEY],
    queryFn: () => api.get<Biomarker[]>('/api/genomics/biomarkers'),
    staleTime: 30_000,
  });

  // Fetch a single selected biomarker (for detail view)
  const biomarkerQuery = useQuery({
    queryKey: [BIOMARKER_KEY, selectedMarker],
    queryFn: () => api.get<Biomarker>('/api/genomics/biomarkers', { marker: selectedMarker }),
    placeholderData: (prev) => prev,
    staleTime: 30_000,
  });

  const riskScoresQuery = useQuery({
    queryKey: [RISK_SCORES_KEY],
    queryFn: () => api.get<PolygenicRiskScore[]>('/api/genomics', { view: 'risk-scores' }),
    staleTime: 30_000,
  });

  const reportsQuery = useQuery({
    queryKey: [REPORTS_KEY],
    queryFn: () => api.get<GenomicReport[]>('/api/genomics/reports'),
    staleTime: 30_000,
  });

  // ---- Mutations ----

  const generateReportMutation = useMutation({
    mutationFn: (category: string) =>
      api.post<GenomicReport>('/api/genomics/reports', { category }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [REPORTS_KEY] });
    },
  });

  // ---- Computed ----

  const pharmacogenomics = useMemo(
    () => pharmacogenomicsQuery.data ?? [],
    [pharmacogenomicsQuery.data],
  );

  const biomarkers = useMemo(
    () => biomarkersQuery.data ?? [],
    [biomarkersQuery.data],
  );

  const riskScores = useMemo(
    () => riskScoresQuery.data ?? [],
    [riskScoresQuery.data],
  );

  const reports = useMemo(
    () => reportsQuery.data ?? [],
    [reportsQuery.data],
  );

  const refetch = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: [OVERVIEW_KEY] });
    queryClient.invalidateQueries({ queryKey: [PHARMACOGENOMICS_KEY] });
    queryClient.invalidateQueries({ queryKey: [BIOMARKERS_KEY] });
    queryClient.invalidateQueries({ queryKey: [BIOMARKER_KEY] });
    queryClient.invalidateQueries({ queryKey: [RISK_SCORES_KEY] });
    queryClient.invalidateQueries({ queryKey: [REPORTS_KEY] });
  }, [queryClient]);

  return {
    overview: overviewQuery.data,
    pharmacogenomics,
    biomarkers,
    biomarker: biomarkerQuery.data,
    riskScores,
    reports,

    isLoading: overviewQuery.isLoading,
    isFetching: overviewQuery.isFetching,
    error: overviewQuery.error as Error | null,

    selectedMarker,
    setSelectedMarker,

    generateReport: {
      mutate: generateReportMutation.mutate,
      mutateAsync: generateReportMutation.mutateAsync,
      isLoading: generateReportMutation.isPending,
      error: generateReportMutation.error as Error | null,
    },

    refetch,
  };
}
