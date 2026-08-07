'use client';

import { useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api/client';
import type {
  TEEState,
  TEEAttestation,
  TEEPlatform,
  TEEStatus,
  InferenceWorkload,
  Inference,
  InferenceResult,
} from '@/types';
import { timeAgo } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Server response types
// ---------------------------------------------------------------------------

interface TEEStatusResponse {
  status: TEEStatus;
  platform: string;
  attestationsToday: number;
  lastAttestation: number;
  enclaveUptime: number;
  inferencesCompleted: number;
}

interface VerifyAttestationResponse {
  verified: boolean;
  platform: TEEPlatform;
}

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

const ATTESTATIONS_KEY = 'tee-attestations';
const INFERENCES_KEY = 'tee-inferences';
const MODELS_KEY = 'tee-models';
const STATUS_KEY = 'tee-status';

// ---------------------------------------------------------------------------
// Return type
// ---------------------------------------------------------------------------

export interface UseTEEReturn {
  /** Live TEE enclave state from the configured attestation service. */
  state: TEEState;
  /** Whether the enclave is fully operational. */
  isOperational: boolean;
  /** Human-readable time since last attestation. */
  lastAttestationAgo: string;

  /** Cached attestation history. */
  attestations: TEEAttestation[];
  /** Whether attestations are loading. */
  isLoadingAttestations: boolean;
  /** Attestation query error. */
  attestationsError: Error | null;

  /** Cached inference history. */
  inferences: Inference[];
  /** Whether inferences are loading. */
  isLoadingInferences: boolean;
  /** Inference query error. */
  inferencesError: Error | null;

  /** Cached inference workload registry. */
  models: InferenceWorkload[];
  /** Whether models are loading. */
  isLoadingModels: boolean;
  /** Models query error. */
  modelsError: Error | null;

  /** Verify a specific attestation hash on-chain. */
  verifyAttestation: (hash: string) => Promise<{ verified: boolean; platform: TEEPlatform }>;

  /** Computed inference stats. */
  inferenceStats: {
    total: number;
    anomalies: number;
    normal: number;
    averageConfidence: number;
  };

  /** Force re-fetch all TEE-related queries. */
  refetch: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Comprehensive TEE monitoring hook combining live enclave status
 * with cached queries for attestation history, inference runs, and
 * the model registry.
 *
 * @example
 * ```tsx
 * const { state, attestations, inferences, models, isOperational } = useTEE();
 * ```
 */
export function useTEE(): UseTEEReturn {
  const queryClient = useQueryClient();

  // ---- Live state --------------------------------------------------------

  const statusQuery = useQuery({
    queryKey: [STATUS_KEY],
    queryFn: () => api.get<TEEStatusResponse>('/api/tee/status'),
    staleTime: 15_000,
  });

  const state: TEEState = useMemo(
    () =>
      statusQuery.data ?? {
        status: 'offline',
        platform: 'Unavailable',
        attestationsToday: 0,
        lastAttestation: 0,
        enclaveUptime: 0,
        inferencesCompleted: 0,
      },
    [statusQuery.data],
  );
  const isOperational = statusQuery.isSuccess && state.status === 'operational';
  const lastAttestationAgo = useMemo(
    () => (state.lastAttestation > 0 ? timeAgo(state.lastAttestation) : 'Unavailable'),
    [state.lastAttestation],
  );

  // ---- Attestation query -------------------------------------------------

  const attestationQuery = useQuery({
    queryKey: [ATTESTATIONS_KEY],
    queryFn: () => api.get<TEEAttestation[]>('/api/tee/attestations'),
    staleTime: 30_000,
  });

  // ---- Inference query ---------------------------------------------------

  const inferenceQuery = useQuery({
    queryKey: [INFERENCES_KEY],
    queryFn: () => api.get<Inference[]>('/api/tee/status', { include: 'inferences' }),
    staleTime: 15_000,
  });

  // ---- Model registry query ----------------------------------------------

  const modelsQuery = useQuery({
    queryKey: [MODELS_KEY],
    queryFn: () => api.get<InferenceWorkload[]>('/api/tee/status', { include: 'models' }),
    staleTime: 60_000,
  });

  // ---- Verify attestation (on-demand call) --------------------------------

  const verifyAttestationFn = useCallback(
    async (hash: string): Promise<VerifyAttestationResponse> => {
      return api.post<VerifyAttestationResponse>('/api/tee/attestations', {
        hash,
        action: 'verify',
      });
    },
    [],
  );

  // ---- Computed inference stats ------------------------------------------

  const inferenceStats = useMemo(() => {
    const list = inferenceQuery.data ?? [];
    const anomalies = list.filter((i) => i.result === 'Anomaly Detected').length;
    const normal = list.filter((i) => i.result === 'Normal').length;
    const avgConf =
      list.length > 0 ? list.reduce((sum, i) => sum + i.confidence, 0) / list.length : 0;
    return {
      total: list.length,
      anomalies,
      normal,
      averageConfidence: parseFloat(avgConf.toFixed(1)),
    };
  }, [inferenceQuery.data]);

  // ---- Refetch -----------------------------------------------------------

  const refetch = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: [STATUS_KEY] });
    queryClient.invalidateQueries({ queryKey: [ATTESTATIONS_KEY] });
    queryClient.invalidateQueries({ queryKey: [INFERENCES_KEY] });
    queryClient.invalidateQueries({ queryKey: [MODELS_KEY] });
  }, [queryClient]);

  return {
    state,
    isOperational,
    lastAttestationAgo,

    attestations: attestationQuery.data ?? [],
    isLoadingAttestations: attestationQuery.isLoading,
    attestationsError: attestationQuery.error as Error | null,

    inferences: inferenceQuery.data ?? [],
    isLoadingInferences: inferenceQuery.isLoading,
    inferencesError: inferenceQuery.error as Error | null,

    models: modelsQuery.data ?? [],
    isLoadingModels: modelsQuery.isLoading,
    modelsError: modelsQuery.error as Error | null,

    verifyAttestation: verifyAttestationFn,

    inferenceStats,

    refetch,
  };
}
