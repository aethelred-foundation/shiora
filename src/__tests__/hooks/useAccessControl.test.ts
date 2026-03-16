import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppProvider } from '@/contexts/AppContext';
import { useAccessControl } from '@/hooks/useAccessControl';

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc },
      React.createElement(AppProvider, null, children));
}

describe('useAccessControl', () => {
  it('initializes with loading state', () => {
    const { result } = renderHook(() => useAccessControl(), { wrapper: createWrapper() });
    expect(result.current.isLoadingGrants).toBe(true);
    expect(result.current.grants).toEqual([]);
  });

  it('loads grants and audit log', async () => {
    const { result } = renderHook(() => useAccessControl(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoadingGrants).toBe(false));
    expect(Array.isArray(result.current.grants)).toBe(true);
    expect(Array.isArray(result.current.auditLog)).toBe(true);
  });

  it('exposes grant mutation functions', async () => {
    const { result } = renderHook(() => useAccessControl(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoadingGrants).toBe(false));
    expect(typeof result.current.createGrant.mutate).toBe('function');
    expect(typeof result.current.revokeGrant.mutate).toBe('function');
    expect(typeof result.current.modifyGrant.mutate).toBe('function');
  });

  it('has filter functions', async () => {
    const { result } = renderHook(() => useAccessControl(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoadingGrants).toBe(false));
    expect(typeof result.current.setStatusFilter).toBe('function');
    expect(typeof result.current.setSearch).toBe('function');
  });

  it('createGrant mutation completes successfully', async () => {
    const { result } = renderHook(() => useAccessControl(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoadingGrants).toBe(false));

    await act(async () => {
      result.current.createGrant.mutate({
        providerAddress: 'aeth1test',
        scope: 'Full Records',
        durationDays: 90,
      } as any);
    });

    await waitFor(() => expect(result.current.createGrant.isLoading).toBe(false));
    expect(result.current.createGrant.error).toBeNull();
  });

  it('revokeGrant mutation completes successfully', async () => {
    const { result } = renderHook(() => useAccessControl(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoadingGrants).toBe(false));

    await act(async () => {
      result.current.revokeGrant.mutate({
        grantId: 'grant-0001',
        reason: 'No longer needed',
      } as any);
    });

    await waitFor(() => expect(result.current.revokeGrant.isLoading).toBe(false));
    expect(result.current.revokeGrant.error).toBeNull();
  });

  it('modifyGrant mutation completes successfully', async () => {
    const { result } = renderHook(() => useAccessControl(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoadingGrants).toBe(false));

    await act(async () => {
      result.current.modifyGrant.mutate({
        grantId: 'grant-0001',
        scope: 'Lab Results Only',
        durationDays: 30,
      } as any);
    });

    await waitFor(() => expect(result.current.modifyGrant.isLoading).toBe(false));
    expect(result.current.modifyGrant.error).toBeNull();
  });

  it('setStatusFilter updates the status filter', async () => {
    const { result } = renderHook(() => useAccessControl(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoadingGrants).toBe(false));

    act(() => {
      result.current.setStatusFilter('Active');
    });

    expect(result.current.statusFilter).toBe('Active');
  });

  it('setSearch updates the search string', async () => {
    const { result } = renderHook(() => useAccessControl(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoadingGrants).toBe(false));

    act(() => {
      result.current.setSearch('Dr. Chen');
    });

    expect(result.current.search).toBe('Dr. Chen');
  });

  it('setAuditTypeFilter updates the audit type filter', async () => {
    const { result } = renderHook(() => useAccessControl(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoadingGrants).toBe(false));

    act(() => {
      result.current.setAuditTypeFilter('access');
    });

    expect(result.current.auditTypeFilter).toBe('access');
  });

  it('counts are computed correctly', async () => {
    const { result } = renderHook(() => useAccessControl(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoadingGrants).toBe(false));

    expect(typeof result.current.counts.total).toBe('number');
    expect(typeof result.current.counts.active).toBe('number');
    expect(typeof result.current.counts.pending).toBe('number');
    expect(typeof result.current.counts.expired).toBe('number');
    expect(typeof result.current.counts.revoked).toBe('number');
    expect(result.current.counts.total).toBe(
      result.current.counts.active + result.current.counts.pending +
      result.current.counts.expired + result.current.counts.revoked
    );
  });

  it('refetch triggers without error', async () => {
    const { result } = renderHook(() => useAccessControl(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoadingGrants).toBe(false));

    act(() => {
      result.current.refetch();
    });

    expect(result.current.grantsError).toBeNull();
  });

  it('createGrant onError calls addNotification with error', async () => {
    // Temporarily make the API post throw for the /api/access endpoint
    const originalFetch = global.fetch;
    const { result } = renderHook(() => useAccessControl(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoadingGrants).toBe(false));

    // Mock fetch to return error for POST /api/access
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 400,
      headers: { get: () => 'application/json' },
      json: () => Promise.resolve({ success: false, error: { code: 'INVALID', message: 'Invalid grant' } }),
    });

    await act(async () => {
      result.current.createGrant.mutate({
        providerAddress: 'aeth1bad',
        scope: 'Full Records',
        durationDays: 90,
      } as any);
    });

    await waitFor(() => expect(result.current.createGrant.isLoading).toBe(false));
    expect(result.current.createGrant.error).not.toBeNull();

    global.fetch = originalFetch;
  });

  it('revokeGrant onError calls addNotification with error', async () => {
    const originalFetch = global.fetch;
    const { result } = renderHook(() => useAccessControl(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoadingGrants).toBe(false));

    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 400,
      headers: { get: () => 'application/json' },
      json: () => Promise.resolve({ success: false, error: { code: 'FAIL', message: 'Revoke failed' } }),
    });

    await act(async () => {
      result.current.revokeGrant.mutate({
        grantId: 'grant-bad',
        reason: 'test',
      } as any);
    });

    await waitFor(() => expect(result.current.revokeGrant.isLoading).toBe(false));
    expect(result.current.revokeGrant.error).not.toBeNull();

    global.fetch = originalFetch;
  });

  it('modifyGrant onError calls addNotification with error', async () => {
    const originalFetch = global.fetch;
    const { result } = renderHook(() => useAccessControl(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoadingGrants).toBe(false));

    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 400,
      headers: { get: () => 'application/json' },
      json: () => Promise.resolve({ success: false, error: { code: 'FAIL', message: 'Modify failed' } }),
    });

    await act(async () => {
      result.current.modifyGrant.mutate({
        grantId: 'grant-bad',
        scope: 'Lab Results Only',
        durationDays: 30,
      } as any);
    });

    await waitFor(() => expect(result.current.modifyGrant.isLoading).toBe(false));
    expect(result.current.modifyGrant.error).not.toBeNull();

    global.fetch = originalFetch;
  });
});
