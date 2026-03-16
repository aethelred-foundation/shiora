/**
 * useClinicalDecisionSupport — Clinical Decision Support data fetching and state management.
 *
 * Uses @tanstack/react-query for data fetching and the shared API client
 * for all server communication.
 */

'use client';

import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  ClinicalPathway,
  DrugInteraction,
  DifferentialDiagnosis,
  ClinicalAlert,
  ClinicalDecisionAuditEntry,
  ClinicalStats,
} from '@/types';
import { api } from '@/lib/api/client';

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

const STATS_KEY = 'clinical-stats';
const ALERTS_KEY = 'clinical-alerts';
const PATHWAYS_KEY = 'clinical-pathways';
const INTERACTIONS_KEY = 'clinical-interactions';
const DIFFERENTIALS_KEY = 'clinical-differentials';
const AUDIT_KEY = 'clinical-audit';

// ---------------------------------------------------------------------------
// Tab type
// ---------------------------------------------------------------------------

export type ClinicalTab = 'dashboard' | 'pathways' | 'interactions' | 'differentials' | 'audit';

// ---------------------------------------------------------------------------
// Return type
// ---------------------------------------------------------------------------

export interface UseClinicalDecisionSupportReturn {
  stats: ClinicalStats | undefined;
  alerts: ClinicalAlert[];
  pathways: ClinicalPathway[];
  interactions: DrugInteraction[];
  differentials: DifferentialDiagnosis[];
  auditEntries: ClinicalDecisionAuditEntry[];

  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;

  activeTab: ClinicalTab;
  setActiveTab: (tab: ClinicalTab) => void;

  severityFilter: string;
  setSeverityFilter: (filter: string) => void;

  auditTypeFilter: string;
  setAuditTypeFilter: (filter: string) => void;

  acknowledgeAlert: {
    mutate: (alertId: string) => void;
    mutateAsync: (alertId: string) => Promise<void>;
    isLoading: boolean;
    error: Error | null;
  };

  refetch: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useClinicalDecisionSupport(): UseClinicalDecisionSupportReturn {
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<ClinicalTab>('dashboard');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [auditTypeFilter, setAuditTypeFilter] = useState<string>('all');

  // ---- Queries ----

  const statsQuery = useQuery({
    queryKey: [STATS_KEY],
    queryFn: () => api.get<ClinicalStats>('/api/clinical', { view: 'stats' }),
    staleTime: 30_000,
  });

  const alertsQuery = useQuery({
    queryKey: [ALERTS_KEY],
    queryFn: () => api.get<ClinicalAlert[]>('/api/clinical', { view: 'alerts' }),
    staleTime: 30_000,
  });

  const pathwaysQuery = useQuery({
    queryKey: [PATHWAYS_KEY],
    queryFn: () => api.get<ClinicalPathway[]>('/api/clinical/pathways'),
    staleTime: 30_000,
    enabled: activeTab === 'dashboard' || activeTab === 'pathways',
  });

  const interactionsQuery = useQuery({
    queryKey: [INTERACTIONS_KEY],
    queryFn: () => api.get<DrugInteraction[]>('/api/clinical/interactions'),
    staleTime: 30_000,
    enabled: activeTab === 'dashboard' || activeTab === 'interactions',
  });

  const differentialsQuery = useQuery({
    queryKey: [DIFFERENTIALS_KEY],
    queryFn: () => api.get<DifferentialDiagnosis[]>('/api/clinical/differentials'),
    staleTime: 30_000,
    enabled: activeTab === 'dashboard' || activeTab === 'differentials',
  });

  const auditQuery = useQuery({
    queryKey: [AUDIT_KEY],
    queryFn: () => api.get<ClinicalDecisionAuditEntry[]>('/api/clinical/audit'),
    staleTime: 30_000,
    enabled: activeTab === 'audit',
  });

  // ---- Mutations ----

  const acknowledgeAlertMutation = useMutation({
    mutationFn: (alertId: string) =>
      api.post<void>('/api/clinical', { action: 'acknowledge', alertId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ALERTS_KEY] });
      queryClient.invalidateQueries({ queryKey: [STATS_KEY] });
    },
  });

  // ---- Computed ----

  const alerts = useMemo(
    () => alertsQuery.data ?? [],
    [alertsQuery.data],
  );

  const pathways = useMemo(
    () => pathwaysQuery.data ?? [],
    [pathwaysQuery.data],
  );

  const interactions = useMemo(
    () => interactionsQuery.data ?? [],
    [interactionsQuery.data],
  );

  const differentials = useMemo(
    () => differentialsQuery.data ?? [],
    [differentialsQuery.data],
  );

  const auditEntries = useMemo(
    () => auditQuery.data ?? [],
    [auditQuery.data],
  );

  const refetch = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: [STATS_KEY] });
    queryClient.invalidateQueries({ queryKey: [ALERTS_KEY] });
    queryClient.invalidateQueries({ queryKey: [PATHWAYS_KEY] });
    queryClient.invalidateQueries({ queryKey: [INTERACTIONS_KEY] });
    queryClient.invalidateQueries({ queryKey: [DIFFERENTIALS_KEY] });
    queryClient.invalidateQueries({ queryKey: [AUDIT_KEY] });
  }, [queryClient]);

  return {
    stats: statsQuery.data,
    alerts,
    pathways,
    interactions,
    differentials,
    auditEntries,

    isLoading: statsQuery.isLoading,
    isFetching: statsQuery.isFetching,
    error: statsQuery.error as Error | null,

    activeTab,
    setActiveTab,

    severityFilter,
    setSeverityFilter,

    auditTypeFilter,
    setAuditTypeFilter,

    acknowledgeAlert: {
      mutate: acknowledgeAlertMutation.mutate,
      mutateAsync: acknowledgeAlertMutation.mutateAsync,
      isLoading: acknowledgeAlertMutation.isPending,
      error: acknowledgeAlertMutation.error as Error | null,
    },

    refetch,
  };
}
