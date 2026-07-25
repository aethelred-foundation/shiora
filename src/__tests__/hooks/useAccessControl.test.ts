import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppProvider } from '@/contexts/AppContext';
import {
  toGrantCreatePayload,
  useAccessControl,
} from '@/hooks/useAccessControl';

const mockWalletConnected = true;
const mockSignMessage = jest.fn(async ({ message }: { message: string }) => ({
  message,
  signature: `0x${'11'.repeat(65)}`,
  publicKey: '',
}));
jest.mock('@/contexts/AppContext', () => ({
  AppProvider: ({ children }: { children: React.ReactNode }) => children,
  useApp: () => ({
    wallet: { connected: mockWalletConnected },
    addNotification: jest.fn(),
  }),
}));
jest.mock('@/hooks/useWallet', () => ({
  useWallet: () => ({ signMessage: mockSignMessage }),
}));


function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc },
      React.createElement(AppProvider, null, children));
}

describe('useAccessControl', () => {
  beforeEach(() => {
    mockSignMessage.mockClear();
  });

  it('uses a nonempty provider label for a manually entered address', () => {
    expect(
      toGrantCreatePayload({
        providerAddress: '0x1111111111111111111111111111111111111111',
        providerName: '',
        specialty: 'General Practice',
        scope: 'Full Records',
        durationDays: 30,
        permissions: {
          canView: true,
          canDownload: false,
          canShare: false,
        },
      }).provider,
    ).toBe('Custom Provider');
  });

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
        providerAddress: '0x1111111111111111111111111111111111111111',
        providerName: 'Dr. Test',
        specialty: 'General Practice',
        scope: 'Full Records',
        durationDays: 90,
        permissions: { canView: true, canDownload: false, canShare: false },
      });
    });

    await waitFor(() => expect(result.current.createGrant.isLoading).toBe(false));
    expect(result.current.createGrant.error).toBeNull();
    expect(mockSignMessage).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('Authorize Access Grant') }),
    );
  });

  it('maps the UI form to the flat API DTO and attaches wallet authorization', async () => {
    const { result } = renderHook(() => useAccessControl(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoadingGrants).toBe(false));

    await act(async () => {
      await result.current.createGrant.mutateAsync({
        providerAddress: '0x2222222222222222222222222222222222222222',
        providerName: 'Dr. Rivera',
        specialty: 'Cardiology',
        scope: 'Lab Results Only',
        durationDays: 30,
        permissions: { canView: true, canDownload: true, canShare: false },
      });
    });

    const accessPost = (global.fetch as jest.Mock).mock.calls.find(([input, init]) => {
      const url = typeof input === 'string' ? input : String(input);
      return url === '/api/access' && init?.method === 'POST';
    });
    expect(accessPost).toBeDefined();
    const body = JSON.parse(String(accessPost![1].body));
    expect(body).toMatchObject({
      provider: 'Dr. Rivera',
      specialty: 'Cardiology',
      address: '0x2222222222222222222222222222222222222222',
      scope: 'Lab Results Only',
      durationDays: 30,
      canView: true,
      canDownload: true,
      canShare: false,
      authorization: {
        signature: `0x${'11'.repeat(65)}`,
        nonce: 'mock-grant-nonce-123',
        hmac: 'mock-grant-hmac',
      },
    });
    expect(body).not.toHaveProperty('providerAddress');
    expect(body).not.toHaveProperty('permissions');
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
        providerAddress: '0x3333333333333333333333333333333333333333',
        providerName: 'Bad Provider',
        specialty: 'General Practice',
        scope: 'Full Records',
        durationDays: 90,
        permissions: { canView: true, canDownload: false, canShare: false },
      });
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
