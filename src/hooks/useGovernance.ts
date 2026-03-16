/**
 * useGovernance — Governance proposals, voting, and delegation management.
 *
 * Uses @tanstack/react-query for data fetching and the shared API client
 * for all server communication.
 */

'use client';

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';

import type {
  Proposal,
  ProposalStatus,
  Vote,
  Delegation,
  GovernanceStats,
  CreateProposalForm,
} from '@/types';

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

const PROPOSALS_KEY = 'governance-proposals';
const VOTES_KEY = 'governance-votes';
const DELEGATIONS_KEY = 'governance-delegations';
const GOV_STATS_KEY = 'governance-stats';

// ---------------------------------------------------------------------------
// Return type
// ---------------------------------------------------------------------------

export interface UseGovernanceReturn {
  proposals: Proposal[];
  votes: Vote[];
  delegations: Delegation[];
  stats: GovernanceStats;
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  statusFilter: ProposalStatus | undefined;
  setStatusFilter: (status: ProposalStatus | undefined) => void;
  userVotingPower: number;

  createProposal: {
    mutate: (form: CreateProposalForm) => void;
    mutateAsync: (form: CreateProposalForm) => Promise<Proposal>;
    isLoading: boolean;
    error: Error | null;
  };

  vote: {
    mutate: (params: { proposalId: string; support: 'for' | 'against' | 'abstain'; reason?: string }) => void;
    isLoading: boolean;
    error: Error | null;
  };

  delegate: {
    mutate: (address: string) => void;
    isLoading: boolean;
    error: Error | null;
  };

  undelegate: {
    mutate: () => void;
    isLoading: boolean;
    error: Error | null;
  };

  fetchVotes: (proposalId: string) => Promise<Vote[]>;
  refetch: () => void;
}

// ---------------------------------------------------------------------------
// Default stats fallback
// ---------------------------------------------------------------------------

const DEFAULT_STATS: GovernanceStats = {
  totalProposals: 0,
  activeProposals: 0,
  totalVoters: 0,
  totalVotingPower: 0,
  quorumThreshold: 10,
  treasuryBalance: 0,
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useGovernance(): UseGovernanceReturn {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<ProposalStatus | undefined>(undefined);

  // ---- Queries ----

  const proposalsQuery = useQuery({
    queryKey: [PROPOSALS_KEY, statusFilter],
    queryFn: () =>
      api.get<Proposal[]>('/api/governance/proposals', {
        status: statusFilter,
      }),
    placeholderData: (prev) => prev,
    staleTime: 30_000,
  });

  const votesQuery = useQuery({
    queryKey: [VOTES_KEY],
    queryFn: () => api.get<Vote[]>('/api/governance/vote'),
    staleTime: 30_000,
  });

  const delegationsQuery = useQuery({
    queryKey: [DELEGATIONS_KEY],
    queryFn: () => api.get<Delegation[]>('/api/governance/proposals', { view: 'delegations' }),
    staleTime: 30_000,
  });

  const statsQuery = useQuery({
    queryKey: [GOV_STATS_KEY],
    queryFn: () => api.get<GovernanceStats>('/api/governance/proposals', { view: 'stats' }),
    staleTime: 30_000,
  });

  // ---- Mutations ----

  const createMutation = useMutation({
    mutationFn: (form: CreateProposalForm) =>
      api.post<Proposal>('/api/governance/proposals', form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PROPOSALS_KEY] });
    },
  });

  const voteMutation = useMutation({
    mutationFn: (params: { proposalId: string; support: 'for' | 'against' | 'abstain'; reason?: string }) =>
      api.post<Vote>('/api/governance/vote', params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PROPOSALS_KEY] });
      queryClient.invalidateQueries({ queryKey: [VOTES_KEY] });
    },
  });

  const delegateMutation = useMutation({
    mutationFn: (address: string) =>
      api.post<Delegation>('/api/governance/proposals', { action: 'delegate', address }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [DELEGATIONS_KEY] });
    },
  });

  const undelegateMutation = useMutation({
    mutationFn: () =>
      api.post<void>('/api/governance/proposals', { action: 'undelegate' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [DELEGATIONS_KEY] });
    },
  });

  // ---- Helper ----

  const fetchVotesForProposal = useCallback(
    (proposalId: string) =>
      api.get<Vote[]>(`/api/governance/proposals/${proposalId}`, { view: 'votes' }),
    [],
  );

  const refetch = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: [PROPOSALS_KEY] });
    queryClient.invalidateQueries({ queryKey: [VOTES_KEY] });
  }, [queryClient]);

  return {
    proposals: proposalsQuery.data ?? [],
    votes: votesQuery.data ?? [],
    delegations: delegationsQuery.data ?? [],
    stats: statsQuery.data ?? DEFAULT_STATS,
    isLoading: proposalsQuery.isLoading,
    isFetching: proposalsQuery.isFetching,
    error: proposalsQuery.error as Error | null,
    statusFilter,
    setStatusFilter,
    userVotingPower: 5000,

    createProposal: {
      mutate: createMutation.mutate,
      mutateAsync: createMutation.mutateAsync,
      isLoading: createMutation.isPending,
      error: createMutation.error as Error | null,
    },

    vote: {
      mutate: voteMutation.mutate,
      isLoading: voteMutation.isPending,
      error: voteMutation.error as Error | null,
    },

    delegate: {
      mutate: delegateMutation.mutate,
      isLoading: delegateMutation.isPending,
      error: delegateMutation.error as Error | null,
    },

    undelegate: {
      mutate: () => undelegateMutation.mutate(),
      isLoading: undelegateMutation.isPending,
      error: undelegateMutation.error as Error | null,
    },

    fetchVotes: fetchVotesForProposal,
    refetch,
  };
}
