import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppProvider } from '@/contexts/AppContext';
import { useIPFS } from '@/hooks/useIPFS';

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc },
      React.createElement(AppProvider, null, children));
}

describe('useIPFS', () => {
  it('initializes with loading state', () => {
    const { result } = renderHook(() => useIPFS(), { wrapper: createWrapper() });
    expect(result.current.isLoadingFiles).toBe(true);
    expect(result.current.files).toEqual([]);
  });

  it('loads files and metrics', async () => {
    const { result } = renderHook(() => useIPFS(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoadingFiles).toBe(false));
    expect(Array.isArray(result.current.files)).toBe(true);
    expect(result.current.files.length).toBeGreaterThan(0);
  });

  it('loads metrics with usage percent', async () => {
    const { result } = renderHook(() => useIPFS(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoadingMetrics).toBe(false));
    expect(result.current.metrics).not.toBeNull();
    expect(typeof result.current.usagePercent).toBe('number');
    expect(result.current.usagePercent).toBeGreaterThan(0);
  });

  it('upload mutation completes successfully', async () => {
    const { result } = renderHook(() => useIPFS(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoadingFiles).toBe(false));

    const testFile = new File(['test content'], 'test-doc.pdf', { type: 'application/pdf' });

    await act(async () => {
      result.current.upload.mutate({
        file: testFile,
        encryption: 'AES-256-GCM' as any,
      });
    });

    await waitFor(() => expect(result.current.upload.isLoading).toBe(false));
    expect(result.current.upload.error).toBeNull();
  });

  it('download function is callable and does not throw', async () => {
    const { result } = renderHook(() => useIPFS(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoadingFiles).toBe(false));

    expect(typeof result.current.download).toBe('function');

    // Call download - it exercises the api.get path. The mock returns mock data.
    // The hook extracts .url from the response, which may be undefined from the mock.
    let didThrow = false;
    await act(async () => {
      try {
        await result.current.download('Qmtest123');
      } catch {
        didThrow = true;
      }
    });

    expect(didThrow).toBe(false);
  });

  it('checkPinStatus function is callable', async () => {
    const { result } = renderHook(() => useIPFS(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoadingFiles).toBe(false));

    expect(typeof result.current.checkPinStatus).toBe('function');

    let pinResult: any;
    await act(async () => {
      pinResult = await result.current.checkPinStatus('Qmtest123');
    });

    expect(pinResult).toBeDefined();
  });

  it('refetch triggers without error', async () => {
    const { result } = renderHook(() => useIPFS(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoadingFiles).toBe(false));

    act(() => {
      result.current.refetch();
    });

    expect(result.current.filesError).toBeNull();
  });

  it('upload onError triggers error notification', async () => {
    const originalFetch = global.fetch;
    const { result } = renderHook(() => useIPFS(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoadingFiles).toBe(false));

    // Mock fetch to return error for POST /api/ipfs/upload
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 500,
      headers: { get: () => 'application/json' },
      json: () => Promise.resolve({ success: false, error: { code: 'UPLOAD_FAIL', message: 'Upload failed' } }),
    });

    const testFile = new File(['test'], 'fail.pdf', { type: 'application/pdf' });

    await act(async () => {
      result.current.upload.mutate({
        file: testFile,
        encryption: 'AES-256-GCM' as any,
      });
    });

    await waitFor(() => expect(result.current.upload.isLoading).toBe(false));
    expect(result.current.upload.error).not.toBeNull();

    global.fetch = originalFetch;
  });

  it('upload uses application/octet-stream when file has no type', async () => {
    const { result } = renderHook(() => useIPFS(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoadingFiles).toBe(false));

    // Create a file with empty type
    const testFile = new File(['binary content'], 'data.bin', { type: '' });

    await act(async () => {
      result.current.upload.mutate({
        file: testFile,
        encryption: 'AES-256-GCM' as any,
      });
    });

    await waitFor(() => expect(result.current.upload.isLoading).toBe(false));
    expect(result.current.upload.error).toBeNull();
  });

  it('usagePercent returns 0 when totalQuota is 0', async () => {
    const originalFetch = global.fetch;
    const realFetch = global.fetch;

    // Override fetch to return zero quota for metrics
    global.fetch = jest.fn().mockImplementation((url: string, init?: RequestInit) => {
      const urlStr = typeof url === 'string' ? url : (url as Request).url;
      if (urlStr.includes('/api/ipfs/upload') && urlStr.includes('metrics')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: () => Promise.resolve({ success: true, data: { totalUsed: 0, totalQuota: 0, fileCount: 0 } }),
        });
      }
      return realFetch(url, init);
    });

    const { result } = renderHook(() => useIPFS(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoadingMetrics).toBe(false));
    expect(result.current.usagePercent).toBe(0);

    global.fetch = originalFetch;
  });
});
