import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useWearables } from '@/hooks/useWearables';

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

describe('useWearables', () => {
  it('initializes with loading', () => {
    const { result } = renderHook(() => useWearables(), { wrapper: createWrapper() });
    expect(result.current.isLoading).toBe(true);
  });

  it('loads devices, data points, and sync batches', async () => {
    const { result } = renderHook(() => useWearables(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.devices.length).toBeGreaterThan(0);
    expect(Array.isArray(result.current.dataPoints)).toBe(true);
    expect(Array.isArray(result.current.syncBatches)).toBe(true);
  });

  it('connect mutation completes successfully', async () => {
    const { result } = renderHook(() => useWearables(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      result.current.connect.mutate('apple_health' as any);
    });

    await waitFor(() => expect(result.current.connect.isLoading).toBe(false));
    expect(result.current.connect.error).toBeNull();
  });

  it('disconnect mutation completes successfully', async () => {
    const { result } = renderHook(() => useWearables(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      result.current.disconnect.mutate('dev-001');
    });

    await waitFor(() => expect(result.current.disconnect.isLoading).toBe(false));
    expect(result.current.disconnect.error).toBeNull();
  });

  it('sync mutation completes successfully', async () => {
    const { result } = renderHook(() => useWearables(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      result.current.sync.mutate('dev-001');
    });

    await waitFor(() => expect(result.current.sync.isLoading).toBe(false));
    expect(result.current.sync.error).toBeNull();
  });

  it('syncAllDevices triggers sync for connected devices', async () => {
    const { result } = renderHook(() => useWearables(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Should not throw
    act(() => {
      result.current.syncAllDevices();
    });
  });

  it('setSelectedDeviceId updates selection', async () => {
    const { result } = renderHook(() => useWearables(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.setSelectedDeviceId('dev-001');
    });

    expect(result.current.selectedDeviceId).toBe('dev-001');
  });

  it('setSelectedMetric updates metric', async () => {
    const { result } = renderHook(() => useWearables(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.selectedMetric).toBe('heart_rate');

    act(() => {
      result.current.setSelectedMetric('spo2' as any);
    });

    expect(result.current.selectedMetric).toBe('spo2');
  });

  it('connectedDeviceCount is computed', async () => {
    const { result } = renderHook(() => useWearables(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(typeof result.current.connectedDeviceCount).toBe('number');
    expect(result.current.connectedDeviceCount).toBeGreaterThan(0);
  });

  it('totalDataPoints is computed', async () => {
    const { result } = renderHook(() => useWearables(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(typeof result.current.totalDataPoints).toBe('number');
    expect(result.current.totalDataPoints).toBeGreaterThan(0);
  });

  it('refetch triggers without error', async () => {
    const { result } = renderHook(() => useWearables(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.refetch();
    });

    expect(result.current.error).toBeNull();
  });
});
