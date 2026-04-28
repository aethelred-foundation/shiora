/**
 * usePredictiveAlerts — Predictive health alert management with caching.
 *
 * Uses @tanstack/react-query for data fetching and the shared API client
 * for all server communication.
 */

'use client';

import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';

import type { AlertRule, AlertSeverity, PredictiveAlert, AlertHistory } from '@/types';

const ALERTS_KEY = 'predictive-alerts';
const RULES_KEY = 'alert-rules';
const HISTORY_KEY = 'alert-history';

interface AlertFilters {
  severity?: AlertSeverity;
  status?: 'active' | 'acknowledged' | 'resolved';
}

export interface UsePredictiveAlertsReturn {
  alerts: PredictiveAlert[];
  rules: AlertRule[];
  history: AlertHistory[];
  isLoading: boolean;
  isRulesLoading: boolean;
  isHistoryLoading: boolean;
  error: Error | null;
  filters: AlertFilters;
  setFilters: (filters: AlertFilters) => void;
  setSeverityFilter: (severity: AlertSeverity | undefined) => void;
  setStatusFilter: (status: 'active' | 'acknowledged' | 'resolved' | undefined) => void;
  activeAlertCount: number;
  criticalCount: number;
  mutations: {
    createRule: {
      mutate: (rule: Omit<AlertRule, 'id' | 'createdAt'>) => void;
      mutateAsync: (rule: Omit<AlertRule, 'id' | 'createdAt'>) => Promise<AlertRule>;
      isLoading: boolean;
    };
    updateRule: {
      mutate: (args: { id: string; updates: Partial<AlertRule> }) => void;
      isLoading: boolean;
    };
    toggleRule: {
      mutate: (id: string) => void;
      isLoading: boolean;
    };
    acknowledgeAlert: {
      mutate: (id: string) => void;
      isLoading: boolean;
    };
    resolveAlert: {
      mutate: (id: string) => void;
      isLoading: boolean;
    };
  };

  refetch: () => void;
}

export function usePredictiveAlerts(): UsePredictiveAlertsReturn {
  const queryClient = useQueryClient();

  const [filters, setFiltersRaw] = useState<AlertFilters>({});

  const setFilters = useCallback((f: AlertFilters) => {
    setFiltersRaw(f);
  }, []);

  const setSeverityFilter = useCallback((severity: AlertSeverity | undefined) => {
    setFiltersRaw((prev) => ({ ...prev, severity }));
  }, []);

  const setStatusFilter = useCallback(
    (status: 'active' | 'acknowledged' | 'resolved' | undefined) => {
      setFiltersRaw((prev) => ({ ...prev, status }));
    },
    [],
  );

  // ---- Alerts query -------------------------------------------------------

  const alertsQuery = useQuery({
    queryKey: [ALERTS_KEY, filters],
    queryFn: () =>
      api.get<PredictiveAlert[]>('/api/alerts', {
        severity: filters.severity,
        status: filters.status,
      }),
    placeholderData: (prev) => prev,
    staleTime: 30_000,
  });

  // ---- Rules query --------------------------------------------------------

  const rulesQuery = useQuery({
    queryKey: [RULES_KEY],
    queryFn: () => api.get<AlertRule[]>('/api/alerts/rules'),
    staleTime: 30_000,
  });

  // ---- History query ------------------------------------------------------

  const historyQuery = useQuery({
    queryKey: [HISTORY_KEY],
    queryFn: () => api.get<AlertHistory[]>('/api/alerts/history'),
    staleTime: 30_000,
  });

  // ---- Computed values ----------------------------------------------------

  const allAlerts = useMemo(() => alertsQuery.data ?? [], [alertsQuery.data]);

  const activeAlertCount = useMemo(
    () => allAlerts.filter((a) => !a.acknowledgedAt && !a.resolvedAt).length,
    [allAlerts],
  );

  const criticalCount = useMemo(
    () => allAlerts.filter((a) => a.severity === 'critical' && !a.resolvedAt).length,
    [allAlerts],
  );

  // ---- Mutations ----------------------------------------------------------

  const createRuleMutation = useMutation({
    mutationFn: (rule: Omit<AlertRule, 'id' | 'createdAt'>) =>
      api.post<AlertRule>('/api/alerts/rules', rule),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [RULES_KEY] });
    },
  });

  const updateRuleMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<AlertRule> }) =>
      api.patch<AlertRule>(`/api/alerts/rules/${id}`, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [RULES_KEY] });
    },
  });

  const toggleRuleMutation = useMutation({
    mutationFn: (id: string) => api.patch<AlertRule>(`/api/alerts/rules/${id}`, { toggle: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [RULES_KEY] });
    },
  });

  const acknowledgeMutation = useMutation({
    mutationFn: (id: string) => api.post<PredictiveAlert>(`/api/alerts/${id}/acknowledge`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ALERTS_KEY] });
      queryClient.invalidateQueries({ queryKey: [HISTORY_KEY] });
    },
  });

  const resolveMutation = useMutation({
    mutationFn: (id: string) => api.post<PredictiveAlert>(`/api/alerts/${id}/resolve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ALERTS_KEY] });
      queryClient.invalidateQueries({ queryKey: [HISTORY_KEY] });
    },
  });

  // ---- Refetch ------------------------------------------------------------

  const refetch = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: [ALERTS_KEY] });
    queryClient.invalidateQueries({ queryKey: [RULES_KEY] });
    queryClient.invalidateQueries({ queryKey: [HISTORY_KEY] });
  }, [queryClient]);

  return {
    alerts: allAlerts,
    rules: rulesQuery.data ?? [],
    history: historyQuery.data ?? [],
    isLoading: alertsQuery.isLoading,
    isRulesLoading: rulesQuery.isLoading,
    isHistoryLoading: historyQuery.isLoading,
    error: alertsQuery.error as Error | null,

    filters,
    setFilters,
    setSeverityFilter,
    setStatusFilter,

    activeAlertCount,
    criticalCount,

    mutations: {
      createRule: {
        mutate: createRuleMutation.mutate,
        mutateAsync: createRuleMutation.mutateAsync,
        isLoading: createRuleMutation.isPending,
      },
      updateRule: {
        mutate: updateRuleMutation.mutate,
        isLoading: updateRuleMutation.isPending,
      },
      toggleRule: {
        mutate: toggleRuleMutation.mutate,
        isLoading: toggleRuleMutation.isPending,
      },
      acknowledgeAlert: {
        mutate: acknowledgeMutation.mutate,
        isLoading: acknowledgeMutation.isPending,
      },
      resolveAlert: {
        mutate: resolveMutation.mutate,
        isLoading: resolveMutation.isPending,
      },
    },

    refetch,
  };
}
