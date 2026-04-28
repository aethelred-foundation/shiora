/**
 * useConsentManagement — Consent grant CRUD with caching and pagination.
 *
 * Uses @tanstack/react-query for data fetching, caching, and
 * optimistic updates. Backed by the API client which calls
 * server-side routes (fixes SBP-002).
 */

'use client';

import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import type {
  ConsentGrant,
  ConsentScope,
  ConsentStatus,
  ConsentPolicy,
  ConsentAuditEntry,
  CreateConsentForm,
} from '@/types';
import { api } from '@/lib/api/client';

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

const CONSENTS_KEY = 'consents';
const POLICIES_KEY = 'consent-policies';
const AUDIT_KEY = 'consent-audit';

// ---------------------------------------------------------------------------
// Return type
// ---------------------------------------------------------------------------

export interface UseConsentManagementReturn {
  /** Consent grants for the current filter state. */
  consents: ConsentGrant[];
  /** Total consent count matching current filters. */
  total: number;
  /** Whether the consent list query is loading. */
  isLoading: boolean;
  /** Error from the list query, if any. */
  error: Error | null;
  /** Consent policies. */
  policies: ConsentPolicy[];
  /** Audit log entries. */
  auditLog: ConsentAuditEntry[];
  /** Whether audit log is loading. */
  isLoadingAudit: boolean;

  // Filters
  statusFilter: ConsentStatus | undefined;
  setStatusFilter: (status: ConsentStatus | undefined) => void;
  scopeFilter: ConsentScope | undefined;
  setScopeFilter: (scope: ConsentScope | undefined) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;

  // Mutations
  createConsent: {
    mutate: (form: CreateConsentForm) => void;
    mutateAsync: (form: CreateConsentForm) => Promise<ConsentGrant>;
    isLoading: boolean;
  };
  revokeConsent: { mutate: (id: string) => void; isLoading: boolean };
  modifyConsent: {
    mutate: (params: { id: string; scopes?: ConsentScope[]; durationDays?: number }) => void;
    isLoading: boolean;
  };
  revokeAllFromProvider: { mutate: (address: string) => void; isLoading: boolean };

  // Computed
  activeCount: number;
  expiredCount: number;
  revokedCount: number;
  pendingCount: number;

  /** Force re-fetch consents. */
  refetch: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Full-featured consent management hook with filtering, creation,
 * revocation, modification, and audit — all backed by react-query caching.
 *
 * @example
 * ```tsx
 * const { consents, isLoading, createConsent, revokeConsent } = useConsentManagement();
 * ```
 */
export function useConsentManagement(): UseConsentManagementReturn {
  const queryClient = useQueryClient();

  // ---- Filters -----------------------------------------------------------

  const [statusFilter, setStatusFilterRaw] = useState<ConsentStatus | undefined>(undefined);
  const [scopeFilter, setScopeFilterRaw] = useState<ConsentScope | undefined>(undefined);
  const [searchQuery, setSearchQueryRaw] = useState('');

  const setStatusFilter = useCallback((status: ConsentStatus | undefined) => {
    setStatusFilterRaw(status);
  }, []);

  const setScopeFilter = useCallback((scope: ConsentScope | undefined) => {
    setScopeFilterRaw(scope);
  }, []);

  const setSearchQuery = useCallback((q: string) => {
    setSearchQueryRaw(q);
  }, []);

  // ---- Consents list query -----------------------------------------------

  const listQuery = useQuery({
    queryKey: [CONSENTS_KEY, statusFilter, scopeFilter, searchQuery],
    queryFn: () =>
      api.getPaginated<ConsentGrant>('/api/consent', {
        status: statusFilter,
        scope: scopeFilter,
        q: searchQuery || undefined,
        page: 1,
        limit: 50,
      }),
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });

  // ---- Policies query ----------------------------------------------------

  const policiesQuery = useQuery({
    queryKey: [POLICIES_KEY],
    queryFn: () => api.get<ConsentPolicy[]>('/api/consent/policies'),
    staleTime: 60_000,
  });

  // ---- Audit log query ---------------------------------------------------

  const auditQuery = useQuery({
    queryKey: [AUDIT_KEY],
    queryFn: () =>
      api.getPaginated<ConsentAuditEntry>('/api/consent', {
        audit: true,
        page: 1,
        limit: 20,
      }),
    staleTime: 30_000,
  });

  // ---- Create mutation ---------------------------------------------------

  const createMutation = useMutation({
    mutationFn: (form: CreateConsentForm) => api.post<ConsentGrant>('/api/consent', form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CONSENTS_KEY] });
      queryClient.invalidateQueries({ queryKey: [AUDIT_KEY] });
    },
  });

  // ---- Revoke mutation ---------------------------------------------------

  const revokeMutation = useMutation({
    mutationFn: (id: string) => api.patch<void>(`/api/consent/${id}`, { action: 'revoke' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CONSENTS_KEY] });
      queryClient.invalidateQueries({ queryKey: [AUDIT_KEY] });
    },
  });

  // ---- Modify mutation ---------------------------------------------------

  const modifyMutation = useMutation({
    mutationFn: (params: { id: string; scopes?: ConsentScope[]; durationDays?: number }) =>
      api.patch<ConsentGrant>(`/api/consent/${params.id}`, {
        scopes: params.scopes,
        durationDays: params.durationDays,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CONSENTS_KEY] });
      queryClient.invalidateQueries({ queryKey: [AUDIT_KEY] });
    },
  });

  // ---- Revoke all from provider mutation ---------------------------------

  const revokeAllMutation = useMutation({
    mutationFn: (providerAddress: string) =>
      api.post<void>('/api/consent', { action: 'revokeAll', providerAddress }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CONSENTS_KEY] });
      queryClient.invalidateQueries({ queryKey: [AUDIT_KEY] });
    },
  });

  // ---- Computed counts ---------------------------------------------------

  const allConsents = listQuery.data?.items ?? [];
  const activeCount = allConsents.filter((c) => c.status === 'active').length;
  const expiredCount = allConsents.filter((c) => c.status === 'expired').length;
  const revokedCount = allConsents.filter((c) => c.status === 'revoked').length;
  const pendingCount = allConsents.filter((c) => c.status === 'pending').length;

  // ---- Refetch -----------------------------------------------------------

  const refetch = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: [CONSENTS_KEY] });
    queryClient.invalidateQueries({ queryKey: [AUDIT_KEY] });
  }, [queryClient]);

  return {
    consents: listQuery.data?.items ?? [],
    total: listQuery.data?.meta?.total ?? 0,
    isLoading: listQuery.isLoading,
    error: listQuery.error as Error | null,
    policies: policiesQuery.data ?? [],
    auditLog: auditQuery.data?.items ?? [],
    isLoadingAudit: auditQuery.isLoading,

    statusFilter,
    setStatusFilter,
    scopeFilter,
    setScopeFilter,
    searchQuery,
    setSearchQuery,

    createConsent: {
      mutate: createMutation.mutate,
      mutateAsync: createMutation.mutateAsync,
      isLoading: createMutation.isPending,
    },
    revokeConsent: {
      mutate: revokeMutation.mutate,
      isLoading: revokeMutation.isPending,
    },
    modifyConsent: {
      mutate: modifyMutation.mutate,
      isLoading: modifyMutation.isPending,
    },
    revokeAllFromProvider: {
      mutate: revokeAllMutation.mutate,
      isLoading: revokeAllMutation.isPending,
    },

    activeCount,
    expiredCount,
    revokedCount,
    pendingCount,

    refetch,
  };
}
