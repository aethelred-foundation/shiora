'use client';

import { useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApp } from '@/contexts/AppContext';
import { api } from '@/lib/api/client';

import type {
  VaultCompartment,
  CycleEntry,
  CyclePhase,
  SymptomLog,
  FertilityMarker,
  VaultPrivacyScore,
} from '@/types';

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

const VAULT_KEY = 'reproductive-vault';
const COMPARTMENTS_KEY = 'vault-compartments';
const CYCLE_KEY = 'vault-cycle';
const SYMPTOMS_KEY = 'vault-symptoms';

// ---------------------------------------------------------------------------
// Return type
// ---------------------------------------------------------------------------

export interface UseReproductiveVaultReturn {
  compartments: VaultCompartment[];
  cycleEntries: CycleEntry[];
  symptoms: SymptomLog[];
  fertilityMarkers: FertilityMarker[];
  privacyScore: VaultPrivacyScore;
  isLoading: boolean;
  error: Error | null;
  lockCompartment: { mutate: (id: string) => void; isLoading: boolean };
  unlockCompartment: { mutate: (id: string) => void; isLoading: boolean };
  logSymptom: { mutate: (symptom: Omit<SymptomLog, 'id'>) => void; isLoading: boolean };
  currentCycleDay: number;
  currentPhase: CyclePhase;
  nextPeriodDate: number;
  fertileWindowStart: number;
  fertileWindowEnd: number;
  averageCycleLength: number;
  refetch: () => void;
}

// ---------------------------------------------------------------------------
// Default privacy score (returned from vault overview endpoint)
// ---------------------------------------------------------------------------

const DEFAULT_PRIVACY_SCORE: VaultPrivacyScore = {
  overall: 0,
  encryptionScore: 0,
  accessControlScore: 0,
  jurisdictionScore: 0,
  dataMinimizationScore: 0,
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useReproductiveVault(): UseReproductiveVaultReturn {
  const queryClient = useQueryClient();
  // The vault is empty-until-auth by design: while logged out these queries
  // would only produce 401 noise (and, per client fingerprint, eat into the
  // shared rate-limit budget), so they stay disabled.
  const { wallet } = useApp();
  const authed = wallet.connected;

  // ---- Queries ----

  const compartmentsQuery = useQuery({
    queryKey: [VAULT_KEY, COMPARTMENTS_KEY],
    queryFn: () => api.get<VaultCompartment[]>('/api/vault/compartments'),
    staleTime: 30_000,
    enabled: authed,
  });

  // Real route shape: { entries, total, insights } — NOT a bare array. The
  // hook previously typed this as CycleEntry[], and the object reached
  // consumers' .filter()/.reduce() ("l.filter is not a function" in the
  // field, crashing the dashboard behind the error boundary).
  const cycleQuery = useQuery({
    queryKey: [VAULT_KEY, CYCLE_KEY],
    queryFn: () =>
      api.get<{ entries: CycleEntry[]; total: number; insights: unknown }>(
        '/api/vault/cycle',
      ),
    staleTime: 30_000,
    enabled: authed,
  });

  const symptomsQuery = useQuery({
    queryKey: [VAULT_KEY, SYMPTOMS_KEY],
    queryFn: () =>
      api.get<{ symptoms: SymptomLog[]; total: number }>('/api/vault/symptoms'),
    staleTime: 30_000,
    enabled: authed,
  });

  const vaultOverviewQuery = useQuery({
    queryKey: [VAULT_KEY, 'overview'],
    queryFn: () =>
      api.get<{ symptomCount: number; cycleEntryCount: number; insights: unknown }>(
        '/api/vault',
        { overview: true },
      ),
    staleTime: 60_000,
    enabled: authed,
  });

  // ---- Mutations ----

  const lockMutation = useMutation({
    mutationFn: (id: string) =>
      api.patch<VaultCompartment>(`/api/vault/compartments`, { id, action: 'lock' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [VAULT_KEY, COMPARTMENTS_KEY] });
    },
  });

  const unlockMutation = useMutation({
    mutationFn: (id: string) =>
      api.patch<VaultCompartment>(`/api/vault/compartments`, { id, action: 'unlock' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [VAULT_KEY, COMPARTMENTS_KEY] });
    },
  });

  const symptomMutation = useMutation({
    mutationFn: (symptom: Omit<SymptomLog, 'id'>) =>
      api.post<SymptomLog>('/api/vault/symptoms', symptom),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [VAULT_KEY, SYMPTOMS_KEY] });
    },
  });

  // ---- Derived cycle data ----

  const cycleEntries = useMemo(() => cycleQuery.data?.entries ?? [], [cycleQuery.data]);

  const currentCycleDay = useMemo(() => {
    if (cycleEntries.length === 0) return 1;
    return cycleEntries[cycleEntries.length - 1]?.day ?? 1;
  }, [cycleEntries]);

  const currentPhase = useMemo((): CyclePhase => {
    if (cycleEntries.length === 0) return 'follicular';
    return cycleEntries[cycleEntries.length - 1]?.phase ?? 'follicular';
  }, [cycleEntries]);

  const averageCycleLength = 28;

  const nextPeriodDate = useMemo(() => {
    const daysUntil = averageCycleLength - currentCycleDay;
    return Date.now() + daysUntil * 86400000;
  }, [currentCycleDay, averageCycleLength]);

  const fertileWindowStart = useMemo(() => {
    const daysUntilOvulation = 14 - currentCycleDay;
    const daysUntilFertileStart = daysUntilOvulation - 5;
    return Date.now() + daysUntilFertileStart * 86400000;
  }, [currentCycleDay]);

  const fertileWindowEnd = useMemo(() => {
    const daysUntilOvulation = 14 - currentCycleDay;
    const daysUntilFertileEnd = daysUntilOvulation + 1;
    return Date.now() + daysUntilFertileEnd * 86400000;
  }, [currentCycleDay]);

  // ---- Refetch ----

  const refetch = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: [VAULT_KEY] });
  }, [queryClient]);

  // ---- Loading / error ----

  const isLoading =
    compartmentsQuery.isLoading || cycleQuery.isLoading || symptomsQuery.isLoading;

  const error =
    (compartmentsQuery.error as Error | null) ??
    (cycleQuery.error as Error | null) ??
    (symptomsQuery.error as Error | null);

  return {
    compartments: compartmentsQuery.data ?? [],
    cycleEntries,
    symptoms: symptomsQuery.data?.symptoms ?? [],
    // No vault route stores fertility markers yet ("type=fertility" is
    // ignored server-side) — expose an honest empty list rather than
    // fetching the overview object into an array-typed field.
    fertilityMarkers: [] as FertilityMarker[],
    privacyScore: DEFAULT_PRIVACY_SCORE,
    isLoading,
    error,

    lockCompartment: {
      mutate: lockMutation.mutate,
      isLoading: lockMutation.isPending,
    },

    unlockCompartment: {
      mutate: unlockMutation.mutate,
      isLoading: unlockMutation.isPending,
    },

    logSymptom: {
      mutate: symptomMutation.mutate,
      isLoading: symptomMutation.isPending,
    },

    currentCycleDay,
    currentPhase,
    nextPeriodDate,
    fertileWindowStart,
    fertileWindowEnd,
    averageCycleLength,
    refetch,
  };
}
