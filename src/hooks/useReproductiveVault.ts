'use client';

import { useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
const FERTILITY_KEY = 'vault-fertility';

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

  // ---- Queries ----

  const compartmentsQuery = useQuery({
    queryKey: [VAULT_KEY, COMPARTMENTS_KEY],
    queryFn: () => api.get<VaultCompartment[]>('/api/vault/compartments'),
    staleTime: 30_000,
  });

  const cycleQuery = useQuery({
    queryKey: [VAULT_KEY, CYCLE_KEY],
    queryFn: () => api.get<CycleEntry[]>('/api/vault/cycle'),
    staleTime: 30_000,
  });

  const symptomsQuery = useQuery({
    queryKey: [VAULT_KEY, SYMPTOMS_KEY],
    queryFn: () => api.get<SymptomLog[]>('/api/vault/symptoms'),
    staleTime: 30_000,
  });

  const fertilityQuery = useQuery({
    queryKey: [VAULT_KEY, FERTILITY_KEY],
    queryFn: () => api.get<FertilityMarker[]>('/api/vault', { type: 'fertility' }),
    staleTime: 30_000,
  });

  const vaultOverviewQuery = useQuery({
    queryKey: [VAULT_KEY, 'overview'],
    queryFn: () =>
      api.get<{ privacyScore: VaultPrivacyScore }>('/api/vault', { overview: true }),
    staleTime: 60_000,
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

  const cycleEntries = useMemo(() => cycleQuery.data ?? [], [cycleQuery.data]);

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
    compartmentsQuery.isLoading ||
    cycleQuery.isLoading ||
    symptomsQuery.isLoading ||
    fertilityQuery.isLoading;

  const error =
    (compartmentsQuery.error as Error | null) ??
    (cycleQuery.error as Error | null) ??
    (symptomsQuery.error as Error | null) ??
    (fertilityQuery.error as Error | null);

  return {
    compartments: compartmentsQuery.data ?? [],
    cycleEntries,
    symptoms: symptomsQuery.data ?? [],
    fertilityMarkers: fertilityQuery.data ?? [],
    privacyScore: vaultOverviewQuery.data?.privacyScore ?? DEFAULT_PRIVACY_SCORE,
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
