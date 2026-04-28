import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppProvider } from '@/contexts/AppContext';
import { api } from '@/lib/api/client';
import { useNetwork, AETHELRED_CONFIG } from '@/hooks/useNetwork';

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(
      QueryClientProvider,
      { client: qc },
      React.createElement(AppProvider, null, children),
    );
}

describe('useNetwork', () => {
  it('returns config', () => {
    const { result } = renderHook(() => useNetwork(), { wrapper: createWrapper() });
    expect(result.current.config).toEqual(AETHELRED_CONFIG);
    expect(result.current.config.chainName).toBe('Aethelred');
    expect(result.current.config.bech32Prefix).toBe('aeth');
  });

  it('starts connected', () => {
    const { result } = renderHook(() => useNetwork(), { wrapper: createWrapper() });
    expect(result.current.isConnected).toBe(true);
  });

  it('provides network state', () => {
    const { result } = renderHook(() => useNetwork(), { wrapper: createWrapper() });
    expect(typeof result.current.state.blockHeight).toBe('number');
    expect(typeof result.current.state.tps).toBe('number');
    expect(typeof result.current.state.networkLoad).toBe('number');
    expect(typeof result.current.state.epoch).toBe('number');
    expect(typeof result.current.state.aethelPrice).toBe('number');
    expect(typeof result.current.state.lastBlockTime).toBe('number');
  });

  it('provides formatted values', () => {
    const { result } = renderHook(() => useNetwork(), { wrapper: createWrapper() });
    expect(result.current.formattedPrice).toMatch(/^\$/);
    expect(result.current.formattedLoad).toMatch(/%$/);
  });

  it('classifies health as healthy for default TPS/load', () => {
    const { result } = renderHook(() => useNetwork(), { wrapper: createWrapper() });
    expect(result.current.health).toBe('healthy');
  });

  it('reconnect toggles connection', () => {
    jest.useFakeTimers();
    const { result } = renderHook(() => useNetwork(), { wrapper: createWrapper() });
    act(() => result.current.reconnect());
    expect(result.current.isConnected).toBe(false);
    act(() => {
      jest.advanceTimersByTime(600);
    });
    expect(result.current.isConnected).toBe(true);
    jest.useRealTimers();
  });

  it('formattedTps formats thousands with K suffix', () => {
    const { result } = renderHook(() => useNetwork(), { wrapper: createWrapper() });
    // Default TPS is 1800-2800 which is > 1000
    expect(result.current.formattedTps).toMatch(/K$/);
  });

  it('formattedBlockHeight is locale-formatted', () => {
    const { result } = renderHook(() => useNetwork(), { wrapper: createWrapper() });
    expect(result.current.formattedBlockHeight).toMatch(/\d/);
  });

  it('provides averageTps', () => {
    const { result } = renderHook(() => useNetwork(), { wrapper: createWrapper() });
    expect(typeof result.current.averageTps).toBe('number');
  });

  it('provides averageBlockTime', () => {
    const { result } = renderHook(() => useNetwork(), { wrapper: createWrapper() });
    expect(typeof result.current.averageBlockTime).toBe('number');
  });

  it('provides recentBlocks array', () => {
    const { result } = renderHook(() => useNetwork(), { wrapper: createWrapper() });
    expect(Array.isArray(result.current.recentBlocks)).toBe(true);
  });

  it('responds to online/offline events', () => {
    const { result } = renderHook(() => useNetwork(), { wrapper: createWrapper() });
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(result.current.isConnected).toBe(false);
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    expect(result.current.isConnected).toBe(true);
  });

  it('seeds recent blocks from server data on first load', async () => {
    const { result } = renderHook(() => useNetwork(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.recentBlocks.length).toBeGreaterThan(0), {
      timeout: 5000,
    });
    expect(result.current.recentBlocks[0]).toBeDefined();
  });

  it('accepts custom maxBlocks parameter', () => {
    const { result } = renderHook(() => useNetwork(10), { wrapper: createWrapper() });
    expect(result.current.maxBlocks).toBe(10);
  });

  it('computes averageBlockTime from blocks with timestamps', async () => {
    const { result } = renderHook(() => useNetwork(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.recentBlocks.length).toBeGreaterThanOrEqual(2), {
      timeout: 5000,
    });
    expect(result.current.averageBlockTime).toBeGreaterThan(0);
  });

  it('tracks new blocks when blockHeight increments', async () => {
    jest.useFakeTimers();
    const { result } = renderHook(() => useNetwork(), { wrapper: createWrapper() });

    await act(async () => {
      jest.advanceTimersByTime(50);
    });

    const initialHeight = result.current.state.blockHeight;

    // Advance the 3-second AppContext interval to trigger block height change
    await act(async () => {
      jest.advanceTimersByTime(3100);
    });

    expect(result.current.state.blockHeight).toBe(initialHeight + 1);

    jest.useRealTimers();
  });

  it('handles block tracking API failure with fallback block', async () => {
    jest.useFakeTimers();
    const spy = jest.spyOn(api, 'get').mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useNetwork(), { wrapper: createWrapper() });

    await act(async () => {
      jest.advanceTimersByTime(3100);
    });

    expect(result.current.state).toBeDefined();

    spy.mockRestore();
    jest.useRealTimers();
  });
});
