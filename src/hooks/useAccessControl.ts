/**
 * useAccessControl — Access grant management and audit log queries.
 *
 * Uses @tanstack/react-query to cache grant lists and audit logs.
 * Provides mutations for creating, revoking, and modifying grants,
 * all backed by the API client which calls server-side routes
 * (fixes SBP-002).
 */

'use client';

import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import type {
  AccessGrant,
  AccessGrantStatus,
  AuditEntry,
  AuditActionType,
  GrantAccessForm,
  RevokeAccessForm,
  ModifyGrantForm,
} from '@/types';
import { useApp } from '@/contexts/AppContext';
import { api } from '@/lib/api/client';

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

const GRANTS_KEY = 'access-grants';
const AUDIT_KEY = 'audit-log';

// ---------------------------------------------------------------------------
// Return type
// ---------------------------------------------------------------------------

export interface UseAccessControlReturn {
  /** Filtered list of access grants. */
  grants: AccessGrant[];
  /** Whether the grants query is loading. */
  isLoadingGrants: boolean;
  /** Grants query error. */
  grantsError: Error | null;

  /** Filtered audit log entries. */
  auditLog: AuditEntry[];
  /** Whether the audit query is loading. */
  isLoadingAudit: boolean;
  /** Audit query error. */
  auditError: Error | null;

  /** Current status filter for grants. */
  statusFilter: AccessGrantStatus | undefined;
  /** Set the status filter. */
  setStatusFilter: (status: AccessGrantStatus | undefined) => void;
  /** Current search string. */
  search: string;
  /** Set the search string. */
  setSearch: (search: string) => void;
  /** Current audit type filter. */
  auditTypeFilter: AuditActionType | undefined;
  /** Set the audit type filter. */
  setAuditTypeFilter: (type: AuditActionType | undefined) => void;

  /** Computed counts by status. */
  counts: {
    total: number;
    active: number;
    pending: number;
    expired: number;
    revoked: number;
  };

  /** Create a new access grant. */
  createGrant: {
    mutate: (form: GrantAccessForm) => void;
    mutateAsync: (form: GrantAccessForm) => Promise<AccessGrant>;
    isLoading: boolean;
    error: Error | null;
  };

  /** Revoke an access grant. */
  revokeGrant: {
    mutate: (form: RevokeAccessForm) => void;
    mutateAsync: (form: RevokeAccessForm) => Promise<void>;
    isLoading: boolean;
    error: Error | null;
  };

  /** Modify an access grant's scope. */
  modifyGrant: {
    mutate: (form: ModifyGrantForm) => void;
    mutateAsync: (form: ModifyGrantForm) => Promise<AccessGrant>;
    isLoading: boolean;
    error: Error | null;
  };

  /** Force re-fetch grants and audit log. */
  refetch: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Comprehensive access control hook providing grant CRUD,
 * audit log queries, and status filtering.
 *
 * @example
 * ```tsx
 * const { grants, auditLog, createGrant, revokeGrant } = useAccessControl();
 * ```
 */
export function useAccessControl(): UseAccessControlReturn {
  const queryClient = useQueryClient();
  const { addNotification } = useApp();

  const [statusFilter, setStatusFilter] = useState<AccessGrantStatus | undefined>(undefined);
  const [search, setSearch] = useState('');
  const [auditTypeFilter, setAuditTypeFilter] = useState<AuditActionType | undefined>(undefined);

  // ---- Grants query ------------------------------------------------------

  const grantsQuery = useQuery({
    queryKey: [GRANTS_KEY, statusFilter, search],
    queryFn: () =>
      api.get<AccessGrant[]>('/api/access', {
        status: statusFilter,
        q: search || undefined,
      }),
    staleTime: 30_000,
  });

  // ---- Audit log query ---------------------------------------------------

  const auditQuery = useQuery({
    queryKey: [AUDIT_KEY, auditTypeFilter],
    queryFn: () =>
      api.get<AuditEntry[]>('/api/access/audit', {
        type: auditTypeFilter,
      }),
    staleTime: 30_000,
  });

  // ---- Computed counts ---------------------------------------------------

  const allGrants = useMemo(() => grantsQuery.data ?? [], [grantsQuery.data]);
  const counts = useMemo(
    () => ({
      total: allGrants.length,
      active: allGrants.filter((g) => g.status === 'Active').length,
      pending: allGrants.filter((g) => g.status === 'Pending').length,
      expired: allGrants.filter((g) => g.status === 'Expired').length,
      revoked: allGrants.filter((g) => g.status === 'Revoked').length,
    }),
    [allGrants],
  );

  // ---- Create mutation ---------------------------------------------------

  const createMutation = useMutation({
    mutationFn: (form: GrantAccessForm) => api.post<AccessGrant>('/api/access', form),
    onSuccess: (grant) => {
      queryClient.invalidateQueries({ queryKey: [GRANTS_KEY] });
      addNotification(
        'success',
        'Access Granted',
        `Granted ${grant.scope} access to ${grant.provider}`,
      );
    },
    onError: (err: Error) => {
      addNotification('error', 'Grant Failed', err.message);
    },
  });

  // ---- Revoke mutation ---------------------------------------------------

  const revokeMutation = useMutation({
    mutationFn: (form: RevokeAccessForm) =>
      api.patch<void>(`/api/access/${form.grantId}`, { action: 'revoke', reason: form.reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [GRANTS_KEY] });
      queryClient.invalidateQueries({ queryKey: [AUDIT_KEY] });
      addNotification('warning', 'Access Revoked', 'Provider access has been revoked');
    },
    onError: (err: Error) => {
      addNotification('error', 'Revoke Failed', err.message);
    },
  });

  // ---- Modify mutation ---------------------------------------------------

  const modifyMutation = useMutation({
    mutationFn: (form: ModifyGrantForm) =>
      api.patch<AccessGrant>(`/api/access/${form.grantId}`, form),
    onSuccess: (grant) => {
      queryClient.invalidateQueries({ queryKey: [GRANTS_KEY] });
      queryClient.invalidateQueries({ queryKey: [AUDIT_KEY] });
      addNotification('success', 'Grant Updated', `Updated scope to ${grant.scope}`);
    },
    onError: (err: Error) => {
      addNotification('error', 'Modify Failed', err.message);
    },
  });

  // ---- Refetch -----------------------------------------------------------

  const refetch = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: [GRANTS_KEY] });
    queryClient.invalidateQueries({ queryKey: [AUDIT_KEY] });
  }, [queryClient]);

  return {
    grants: grantsQuery.data ?? [],
    isLoadingGrants: grantsQuery.isLoading,
    grantsError: grantsQuery.error as Error | null,

    auditLog: auditQuery.data ?? [],
    isLoadingAudit: auditQuery.isLoading,
    auditError: auditQuery.error as Error | null,

    statusFilter,
    setStatusFilter,
    search,
    setSearch,
    auditTypeFilter,
    setAuditTypeFilter,

    counts,

    createGrant: {
      mutate: createMutation.mutate,
      mutateAsync: createMutation.mutateAsync,
      isLoading: createMutation.isPending,
      error: createMutation.error as Error | null,
    },

    revokeGrant: {
      mutate: revokeMutation.mutate,
      mutateAsync: revokeMutation.mutateAsync,
      isLoading: revokeMutation.isPending,
      error: revokeMutation.error as Error | null,
    },

    modifyGrant: {
      mutate: modifyMutation.mutate,
      mutateAsync: modifyMutation.mutateAsync,
      isLoading: modifyMutation.isPending,
      error: modifyMutation.error as Error | null,
    },

    refetch,
  };
}
