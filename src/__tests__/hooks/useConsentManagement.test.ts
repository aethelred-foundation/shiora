/**
 * Tests for useConsentManagement hook.
 *
 * Validates initialization, filter updates, computed counts,
 * mutation execution, and data availability.
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useConsentManagement } from '@/hooks/useConsentManagement';

// ---------------------------------------------------------------------------
// Helper — wrap hook in QueryClientProvider
// ---------------------------------------------------------------------------

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useConsentManagement', () => {
  it('initializes with default state', async () => {
    const { result } = renderHook(() => useConsentManagement(), {
      wrapper: createWrapper(),
    });

    // Initially loading
    expect(result.current.isLoading).toBe(true);
    expect(result.current.consents).toEqual([]);
    expect(result.current.error).toBeNull();
    expect(result.current.statusFilter).toBeUndefined();
    expect(result.current.scopeFilter).toBeUndefined();
    expect(result.current.searchQuery).toBe('');

    // Wait for data to load
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.consents.length).toBeGreaterThan(0);
    expect(result.current.total).toBeGreaterThan(0);
  });

  it('provides computed counts from all consents', async () => {
    const { result } = renderHook(() => useConsentManagement(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Computed counts should always reflect all mock data regardless of filters
    const totalComputed =
      result.current.activeCount +
      result.current.expiredCount +
      result.current.revokedCount +
      result.current.pendingCount;

    expect(totalComputed).toBe(15); // TOTAL_CONSENTS = 15
    expect(result.current.activeCount).toBeGreaterThan(0);
  });

  it('updates status filter', async () => {
    const { result } = renderHook(() => useConsentManagement(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const totalBefore = result.current.consents.length;

    act(() => {
      result.current.setStatusFilter('active');
    });

    expect(result.current.statusFilter).toBe('active');

    // Wait for the filtered data to arrive (all returned consents are active)
    await waitFor(() => {
      const allActive = result.current.consents.every((c) => c.status === 'active');
      expect(allActive).toBe(true);
    });

    // Filtered results should be <= total
    expect(result.current.consents.length).toBeLessThanOrEqual(totalBefore);
    expect(result.current.consents.length).toBeGreaterThan(0);
  });

  it('updates scope filter', async () => {
    const { result } = renderHook(() => useConsentManagement(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.setScopeFilter('lab_results');
    });

    expect(result.current.scopeFilter).toBe('lab_results');

    // Wait for filtered data to arrive where all consents include the scope
    await waitFor(() => {
      const allInclude = result.current.consents.every((c) =>
        c.scopes.includes('lab_results'),
      );
      expect(allInclude).toBe(true);
    });
  });

  it('updates search query', async () => {
    const { result } = renderHook(() => useConsentManagement(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.setSearchQuery('Dr.');
    });

    expect(result.current.searchQuery).toBe('Dr.');
  });

  it('clears status filter with undefined', async () => {
    const { result } = renderHook(() => useConsentManagement(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.setStatusFilter('revoked');
    });

    expect(result.current.statusFilter).toBe('revoked');

    act(() => {
      result.current.setStatusFilter(undefined);
    });

    expect(result.current.statusFilter).toBeUndefined();
  });

  it('createConsent mutation completes successfully', async () => {
    const { result } = renderHook(() => useConsentManagement(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      result.current.createConsent.mutate({
        providerAddress: 'aeth1test',
        scopes: ['cycle_data', 'lab_results'],
        durationDays: 90,
        policyId: 'policy-0',
      } as any);
    });

    await waitFor(() => expect(result.current.createConsent.isLoading).toBe(false));
  });

  it('revokeConsent mutation completes successfully', async () => {
    const { result } = renderHook(() => useConsentManagement(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      result.current.revokeConsent.mutate('consent-0001');
    });

    await waitFor(() => expect(result.current.revokeConsent.isLoading).toBe(false));
  });

  it('modifyConsent mutation completes successfully', async () => {
    const { result } = renderHook(() => useConsentManagement(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      result.current.modifyConsent.mutate({
        id: 'consent-0001',
        scopes: ['cycle_data'],
        durationDays: 30,
      });
    });

    await waitFor(() => expect(result.current.modifyConsent.isLoading).toBe(false));
  });

  it('revokeAllFromProvider mutation completes successfully', async () => {
    const { result } = renderHook(() => useConsentManagement(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      result.current.revokeAllFromProvider.mutate('aeth1provider');
    });

    await waitFor(() => expect(result.current.revokeAllFromProvider.isLoading).toBe(false));
  });

  it('exposes policies data', async () => {
    const { result } = renderHook(() => useConsentManagement(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.policies.length).toBeGreaterThan(0);
    });

    expect(result.current.policies.length).toBe(5); // 5 policy definitions
    expect(result.current.policies[0]).toHaveProperty('id');
    expect(result.current.policies[0]).toHaveProperty('name');
    expect(result.current.policies[0]).toHaveProperty('scopes');
  });

  it('exposes audit log data', async () => {
    const { result } = renderHook(() => useConsentManagement(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.auditLog.length).toBeGreaterThan(0);
    });

    expect(result.current.auditLog[0]).toHaveProperty('id');
    expect(result.current.auditLog[0]).toHaveProperty('consentId');
    expect(result.current.auditLog[0]).toHaveProperty('action');
    expect(result.current.auditLog[0]).toHaveProperty('txHash');
  });

  it('refetch invalidates queries without error', async () => {
    const { result } = renderHook(() => useConsentManagement(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.refetch();
    });

    expect(result.current.error).toBeNull();
  });
});
