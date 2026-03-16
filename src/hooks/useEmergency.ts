/**
 * useEmergency — Emergency & care coordination data management.
 *
 * Queries for emergency card, care team, protocols, triage,
 * and handoffs. Uses @tanstack/react-query for data fetching
 * and the shared API client for server communication.
 */

'use client';

import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';

import type {
  EmergencyCard,
  CareTeamMember,
  EmergencyProtocol,
  TriageAssessment,
  CareHandoff,
  TriageAssessmentForm,
} from '@/types';

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

const EMERGENCY_CARD_KEY = 'emergency-card';
const CARE_TEAM_KEY = 'emergency-care-team';
const PROTOCOLS_KEY = 'emergency-protocols';
const TRIAGE_KEY = 'emergency-triage';
const TRIAGE_HISTORY_KEY = 'emergency-triage-history';
const HANDOFFS_KEY = 'emergency-handoffs';

// ---------------------------------------------------------------------------
// Return type
// ---------------------------------------------------------------------------

export interface UseEmergencyReturn {
  /** Emergency card data. */
  emergencyCard: EmergencyCard | null;
  /** Care team members. */
  careTeam: CareTeamMember[];
  /** Emergency protocols. */
  protocols: EmergencyProtocol[];
  /** Most recent triage assessment (from mutation). */
  triageResult: TriageAssessment | null;
  /** Historical triage assessments. */
  triageHistory: TriageAssessment[];
  /** Care handoffs. */
  handoffs: CareHandoff[];

  /** Loading states. */
  isLoading: boolean;
  isCareTeamLoading: boolean;
  isProtocolsLoading: boolean;
  isTriageHistoryLoading: boolean;
  isHandoffsLoading: boolean;
  error: Error | null;

  /** Run a triage assessment. */
  runTriage: {
    mutate: (form: TriageAssessmentForm) => void;
    mutateAsync: (form: TriageAssessmentForm) => Promise<TriageAssessment>;
    isLoading: boolean;
    error: Error | null;
  };

  /** Add a care team member. */
  addCareTeamMember: {
    mutate: (member: Partial<CareTeamMember>) => void;
    isLoading: boolean;
    error: Error | null;
  };

  /** Initiate a handoff. */
  initiateHandoff: {
    mutate: (handoff: { fromProvider: string; toProvider: string; patientSummary: string }) => void;
    isLoading: boolean;
    error: Error | null;
  };

  /** Force re-fetch. */
  refetch: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useEmergency(): UseEmergencyReturn {
  const queryClient = useQueryClient();

  // ---- Queries ----

  const cardQuery = useQuery({
    queryKey: [EMERGENCY_CARD_KEY],
    queryFn: () => api.get<EmergencyCard>('/api/emergency'),
    staleTime: 30_000,
  });

  const careTeamQuery = useQuery({
    queryKey: [CARE_TEAM_KEY],
    queryFn: () => api.get<CareTeamMember[]>('/api/emergency/care-team'),
    staleTime: 30_000,
  });

  const protocolsQuery = useQuery({
    queryKey: [PROTOCOLS_KEY],
    queryFn: () => api.get<EmergencyProtocol[]>('/api/emergency/protocols'),
    staleTime: 30_000,
  });

  const triageHistoryQuery = useQuery({
    queryKey: [TRIAGE_HISTORY_KEY],
    queryFn: () => api.get<TriageAssessment[]>('/api/emergency/triage'),
    staleTime: 30_000,
  });

  const handoffsQuery = useQuery({
    queryKey: [HANDOFFS_KEY],
    queryFn: () => api.get<CareHandoff[]>('/api/emergency/handoffs'),
    staleTime: 30_000,
  });

  // ---- Mutations ----

  const triageMutation = useMutation({
    mutationFn: (form: TriageAssessmentForm) =>
      api.post<TriageAssessment>('/api/emergency/triage', form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TRIAGE_HISTORY_KEY] });
    },
  });

  const addMemberMutation = useMutation({
    mutationFn: (member: Partial<CareTeamMember>) =>
      api.post<CareTeamMember>('/api/emergency/care-team', member),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CARE_TEAM_KEY] });
    },
  });

  const handoffMutation = useMutation({
    mutationFn: (data: { fromProvider: string; toProvider: string; patientSummary: string }) =>
      api.post<CareHandoff>('/api/emergency/handoffs', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [HANDOFFS_KEY] });
    },
  });

  // ---- Refetch ----

  const refetch = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: [EMERGENCY_CARD_KEY] });
    queryClient.invalidateQueries({ queryKey: [CARE_TEAM_KEY] });
    queryClient.invalidateQueries({ queryKey: [PROTOCOLS_KEY] });
    queryClient.invalidateQueries({ queryKey: [TRIAGE_HISTORY_KEY] });
    queryClient.invalidateQueries({ queryKey: [HANDOFFS_KEY] });
  }, [queryClient]);

  return {
    emergencyCard: cardQuery.data ?? null,
    careTeam: careTeamQuery.data ?? [],
    protocols: protocolsQuery.data ?? [],
    triageResult: triageMutation.data ?? null,
    triageHistory: triageHistoryQuery.data ?? [],
    handoffs: handoffsQuery.data ?? [],

    isLoading: cardQuery.isLoading,
    isCareTeamLoading: careTeamQuery.isLoading,
    isProtocolsLoading: protocolsQuery.isLoading,
    isTriageHistoryLoading: triageHistoryQuery.isLoading,
    isHandoffsLoading: handoffsQuery.isLoading,
    error: cardQuery.error as Error | null,

    runTriage: {
      mutate: triageMutation.mutate,
      mutateAsync: triageMutation.mutateAsync,
      isLoading: triageMutation.isPending,
      error: triageMutation.error as Error | null,
    },

    addCareTeamMember: {
      mutate: addMemberMutation.mutate,
      isLoading: addMemberMutation.isPending,
      error: addMemberMutation.error as Error | null,
    },

    initiateHandoff: {
      mutate: handoffMutation.mutate,
      isLoading: handoffMutation.isPending,
      error: handoffMutation.error as Error | null,
    },

    refetch,
  };
}
