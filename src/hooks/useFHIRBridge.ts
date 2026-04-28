/**
 * useFHIRBridge — FHIR resource import/export with mappings.
 *
 * Uses @tanstack/react-query for data fetching and the shared API client
 * for all server communication.
 */

'use client';

import { useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';

import type {
  FHIRResource,
  FHIRMapping,
  FHIRImportJob,
  FHIRExportConfig,
  FHIRResourceType,
} from '@/types';
import { FHIR_RESOURCE_TYPES } from '@/lib/constants';

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

const RESOURCES_KEY = 'fhir-resources';
const MAPPINGS_KEY = 'fhir-mappings';
const IMPORT_JOBS_KEY = 'fhir-import-jobs';
const EXPORT_CONFIGS_KEY = 'fhir-export-configs';

// ---------------------------------------------------------------------------
// Return type
// ---------------------------------------------------------------------------

export interface UseFHIRBridgeReturn {
  resources: FHIRResource[];
  mappings: FHIRMapping[];
  importJobs: FHIRImportJob[];
  exportConfigs: FHIRExportConfig[];
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;

  importMutation: {
    mutate: (source: string) => void;
    mutateAsync: (source: string) => Promise<FHIRImportJob>;
    isLoading: boolean;
    error: Error | null;
  };

  exportMutation: {
    mutate: (config: Omit<FHIRExportConfig, 'id' | 'lastExportAt'>) => void;
    mutateAsync: (
      config: Omit<FHIRExportConfig, 'id' | 'lastExportAt'>,
    ) => Promise<FHIRExportConfig>;
    isLoading: boolean;
    error: Error | null;
  };

  resourcesByType: Record<FHIRResourceType, FHIRResource[]>;
  totalMapped: number;
  totalUnmapped: number;

  refetch: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useFHIRBridge(): UseFHIRBridgeReturn {
  const queryClient = useQueryClient();

  // ---- Queries ----

  const resourcesQuery = useQuery({
    queryKey: [RESOURCES_KEY],
    queryFn: () => api.get<FHIRResource[]>('/api/fhir'),
    staleTime: 30_000,
  });

  const mappingsQuery = useQuery({
    queryKey: [MAPPINGS_KEY],
    queryFn: () => api.get<FHIRMapping[]>('/api/fhir/mapping'),
    staleTime: 30_000,
  });

  const importJobsQuery = useQuery({
    queryKey: [IMPORT_JOBS_KEY],
    queryFn: () => api.get<FHIRImportJob[]>('/api/fhir/import'),
    staleTime: 30_000,
  });

  const exportConfigsQuery = useQuery({
    queryKey: [EXPORT_CONFIGS_KEY],
    queryFn: () => api.get<FHIRExportConfig[]>('/api/fhir/export'),
    staleTime: 30_000,
  });

  // ---- Mutations ----

  const importMut = useMutation({
    mutationFn: (source: string) => api.post<FHIRImportJob>('/api/fhir/import', { source }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [IMPORT_JOBS_KEY] });
      queryClient.invalidateQueries({ queryKey: [RESOURCES_KEY] });
    },
  });

  const exportMut = useMutation({
    mutationFn: (config: Omit<FHIRExportConfig, 'id' | 'lastExportAt'>) =>
      api.post<FHIRExportConfig>('/api/fhir/export', config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [EXPORT_CONFIGS_KEY] });
    },
  });

  // ---- Computed ----

  const resources = useMemo(() => resourcesQuery.data ?? [], [resourcesQuery.data]);

  const resourcesByType = useMemo(() => {
    const grouped = {} as Record<FHIRResourceType, FHIRResource[]>;
    const allTypes = FHIR_RESOURCE_TYPES.map((t) => t.id) as FHIRResourceType[];
    for (const t of allTypes) {
      grouped[t] = resources.filter((r) => r.resourceType === t);
    }
    return grouped;
  }, [resources]);

  const totalMapped = resources.filter((r) => r.mappedRecordId).length;
  const totalUnmapped = resources.filter((r) => !r.mappedRecordId).length;

  const refetch = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: [RESOURCES_KEY] });
    queryClient.invalidateQueries({ queryKey: [MAPPINGS_KEY] });
    queryClient.invalidateQueries({ queryKey: [IMPORT_JOBS_KEY] });
    queryClient.invalidateQueries({ queryKey: [EXPORT_CONFIGS_KEY] });
  }, [queryClient]);

  return {
    resources,
    mappings: mappingsQuery.data ?? [],
    importJobs: importJobsQuery.data ?? [],
    exportConfigs: exportConfigsQuery.data ?? [],
    isLoading: resourcesQuery.isLoading,
    isFetching: resourcesQuery.isFetching,
    error: resourcesQuery.error as Error | null,

    importMutation: {
      mutate: importMut.mutate,
      mutateAsync: importMut.mutateAsync,
      isLoading: importMut.isPending,
      error: importMut.error as Error | null,
    },

    exportMutation: {
      mutate: exportMut.mutate,
      mutateAsync: exportMut.mutateAsync,
      isLoading: exportMut.isPending,
      error: exportMut.error as Error | null,
    },

    resourcesByType,
    totalMapped,
    totalUnmapped,

    refetch,
  };
}
