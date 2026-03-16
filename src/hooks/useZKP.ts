/**
 * useZKP — Zero-Knowledge Proof management with caching.
 *
 * Uses @tanstack/react-query for data fetching and the shared API client
 * for all server communication.
 */

'use client';

import { useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';

import type {
  ZKClaim,
  ZKClaimType,
  ZKProof,
  ZKVerificationResult,
} from '@/types';

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

const CLAIMS_KEY = 'zk-claims';
const PROOFS_KEY = 'zk-proofs';

// ---------------------------------------------------------------------------
// Return type
// ---------------------------------------------------------------------------

export interface UseZKPReturn {
  /** All ZK claims. */
  claims: ZKClaim[];
  /** All ZK proofs. */
  proofs: ZKProof[];
  /** Whether claims are loading. */
  isLoading: boolean;
  /** Whether proofs are loading. */
  isProofsLoading: boolean;
  /** Error from claims query. */
  error: Error | null;

  /** Count of verified claims. */
  verifiedCount: number;
  /** Count of pending (proving) claims. */
  pendingCount: number;

  /** Mutations for ZKP operations. */
  mutations: {
    submitClaim: {
      mutate: (args: { type: ZKClaimType; description: string }) => void;
      mutateAsync: (args: { type: ZKClaimType; description: string }) => Promise<ZKClaim>;
      isLoading: boolean;
    };
    generateProof: {
      mutate: (claimId: string) => void;
      mutateAsync: (claimId: string) => Promise<ZKProof>;
      isLoading: boolean;
    };
    verifyProof: {
      mutate: (proofId: string) => void;
      mutateAsync: (proofId: string) => Promise<ZKVerificationResult>;
      isLoading: boolean;
    };
  };

  /** Force re-fetch all data. */
  refetch: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useZKP(): UseZKPReturn {
  const queryClient = useQueryClient();

  // ---- Claims query -------------------------------------------------------

  const claimsQuery = useQuery({
    queryKey: [CLAIMS_KEY],
    queryFn: () => api.get<ZKClaim[]>('/api/zkp/claims'),
    staleTime: 30_000,
  });

  // ---- Proofs query -------------------------------------------------------

  const proofsQuery = useQuery({
    queryKey: [PROOFS_KEY],
    queryFn: () => api.get<ZKProof[]>('/api/zkp/claims', { view: 'proofs' }),
    staleTime: 30_000,
  });

  // ---- Computed values ----------------------------------------------------

  const claims = useMemo(() => claimsQuery.data ?? [], [claimsQuery.data]);
  const proofs = proofsQuery.data ?? [];

  const verifiedCount = useMemo(
    () => claims.filter((c) => c.status === 'verified').length,
    [claims],
  );

  const pendingCount = useMemo(
    () => claims.filter((c) => c.status === 'proving').length,
    [claims],
  );

  // ---- Mutations ----------------------------------------------------------

  const submitClaimMutation = useMutation({
    mutationFn: ({ type, description }: { type: ZKClaimType; description: string }) =>
      api.post<ZKClaim>('/api/zkp/claims', { type, description }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CLAIMS_KEY] });
    },
  });

  const generateProofMutation = useMutation({
    mutationFn: (claimId: string) =>
      api.post<ZKProof>('/api/zkp/prove', { claimId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CLAIMS_KEY] });
      queryClient.invalidateQueries({ queryKey: [PROOFS_KEY] });
    },
  });

  const verifyProofMutation = useMutation({
    mutationFn: (proofId: string) =>
      api.post<ZKVerificationResult>('/api/zkp/verify', { proofId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CLAIMS_KEY] });
      queryClient.invalidateQueries({ queryKey: [PROOFS_KEY] });
    },
  });

  // ---- Refetch ------------------------------------------------------------

  const refetch = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: [CLAIMS_KEY] });
    queryClient.invalidateQueries({ queryKey: [PROOFS_KEY] });
  }, [queryClient]);

  return {
    claims,
    proofs,
    isLoading: claimsQuery.isLoading,
    isProofsLoading: proofsQuery.isLoading,
    error: claimsQuery.error as Error | null,

    verifiedCount,
    pendingCount,

    mutations: {
      submitClaim: {
        mutate: submitClaimMutation.mutate,
        mutateAsync: submitClaimMutation.mutateAsync,
        isLoading: submitClaimMutation.isPending,
      },
      generateProof: {
        mutate: generateProofMutation.mutate,
        mutateAsync: generateProofMutation.mutateAsync,
        isLoading: generateProofMutation.isPending,
      },
      verifyProof: {
        mutate: verifyProofMutation.mutate,
        mutateAsync: verifyProofMutation.mutateAsync,
        isLoading: verifyProofMutation.isPending,
      },
    },

    refetch,
  };
}
