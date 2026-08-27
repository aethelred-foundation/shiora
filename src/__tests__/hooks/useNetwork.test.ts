import { act, renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { api } from '@/lib/api/client';
import { AETHELRED_CONFIG, useNetwork } from '@/hooks/useNetwork';

const LIVE_STATUS = {
  blockHeight: 100_004,
  tps: 1200,
  epoch: null,
  networkLoad: 40,
  aethelPrice: null,
  lastBlockTime: 1_700_000_012_000,
  recentBlocks: [
    {
      height: 100_004,
      hash: `0x${'a'.repeat(64)}`,
      txCount: 12,
      proposer: '0x0000000000000000000000000000000000000001',
      timestamp: 1_700_000_012_000,
      gasUsed: 100_000,
    },
    {
      height: 100_003,
      hash: `0x${'b'.repeat(64)}`,
      txCount: 9,
      proposer: '0x0000000000000000000000000000000000000001',
      timestamp: 1_700_000_009_000,
      gasUsed: 90_000,
    },
  ],
  chainId: '7332',
  source: 'evm-json-rpc' as const,
};

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('useNetwork', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.spyOn(api, 'get').mockResolvedValue(LIVE_STATUS);
  });

  it('uses the public-testnet configuration without client RPC defaults', () => {
    const { result } = renderHook(() => useNetwork(), {
      wrapper: createWrapper(),
    });
    expect(result.current.config).toEqual(AETHELRED_CONFIG);
    expect(result.current.config.chainName).toBe('Aethelred Testnet');
    expect(result.current.config.chainId).toBe('7332');
    expect(result.current.config.rpcUrl).toBe('');
  });

  it('returns unavailable state before live telemetry arrives', () => {
    jest.spyOn(api, 'get').mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useNetwork(), {
      wrapper: createWrapper(),
    });
    expect(result.current.health).toBe('unavailable');
    expect(result.current.state.blockHeight).toBeNull();
    expect(result.current.formattedPrice).toBe('Unavailable');
    expect(result.current.isConnected).toBe(false);
  });

  it('assumes an online baseline during server rendering when navigator is unavailable', () => {
    const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: undefined,
    });
    jest.spyOn(api, 'get').mockReturnValue(new Promise(() => {}));

    try {
      const { result, unmount } = renderHook(() => useNetwork(), {
        wrapper: createWrapper(),
      });
      expect(result.current.isConnected).toBe(false);
      unmount();
    } finally {
      if (originalNavigator) {
        Object.defineProperty(globalThis, 'navigator', originalNavigator);
      }
    }
  });

  it('maps and formats live telemetry', async () => {
    const { result } = renderHook(() => useNetwork(), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.state.blockHeight).toBe(100_004));
    expect(result.current.state.tps).toBe(1200);
    expect(result.current.formattedTps).toBe('1.2K');
    expect(result.current.formattedBlockHeight).toBe('100,004');
    expect(result.current.formattedLoad).toBe('40%');
    expect(result.current.formattedPrice).toBe('Unavailable');
    expect(result.current.health).toBe('healthy');
    expect(result.current.recentBlocks).toHaveLength(2);
    expect(result.current.averageBlockTime).toBe(3);
    expect(result.current.averageTps).toBe(1200);
    expect(result.current.isConnected).toBe(true);
  });

  it('honors the maximum block history size', async () => {
    const { result } = renderHook(() => useNetwork(1), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.recentBlocks).toHaveLength(1));
    expect(result.current.maxBlocks).toBe(1);
    expect(result.current.averageBlockTime).toBe(0);
  });

  it('reports zero average block time for non-increasing timestamps', async () => {
    jest.spyOn(api, 'get').mockResolvedValue({
      ...LIVE_STATUS,
      recentBlocks: LIVE_STATUS.recentBlocks.map((block) => ({
        ...block,
        timestamp: LIVE_STATUS.recentBlocks[0].timestamp,
      })),
    });
    const { result } = renderHook(() => useNetwork(), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.recentBlocks).toHaveLength(2));
    expect(result.current.averageBlockTime).toBe(0);
  });

  it('refetches live telemetry on reconnect', async () => {
    const getSpy = jest.spyOn(api, 'get').mockResolvedValue(LIVE_STATUS);
    const { result } = renderHook(() => useNetwork(), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isConnected).toBe(true));
    const callsBefore = getSpy.mock.calls.length;
    act(() => result.current.reconnect());
    await waitFor(() => expect(getSpy.mock.calls.length).toBeGreaterThan(callsBefore));
  });

  it('reflects browser offline status without fabricating a reconnect', async () => {
    const { result } = renderHook(() => useNetwork(), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isConnected).toBe(true));
    act(() => window.dispatchEvent(new Event('offline')));
    expect(result.current.isConnected).toBe(false);
    act(() => window.dispatchEvent(new Event('online')));
    expect(result.current.isConnected).toBe(true);
  });

  it('reports upstream errors as unavailable', async () => {
    jest.spyOn(api, 'get').mockRejectedValue(new Error('chain endpoint unavailable'));
    const { result } = renderHook(() => useNetwork(), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.error).toBeInstanceOf(Error));
    expect(result.current.health).toBe('unavailable');
    expect(result.current.isConnected).toBe(false);
  });

  it.each([
    [{ tps: 50 }, 'critical'],
    [{ networkLoad: 97 }, 'critical'],
    [{ tps: 300 }, 'degraded'],
    [{ networkLoad: 90 }, 'degraded'],
  ])('classifies network thresholds from live values', async (overrides, expected) => {
    jest.spyOn(api, 'get').mockResolvedValue({
      ...LIVE_STATUS,
      ...overrides,
    });
    const { result } = renderHook(() => useNetwork(), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.health).toBe(expected));
  });

  it('formats sub-thousand throughput without a suffix', async () => {
    jest.spyOn(api, 'get').mockResolvedValue({
      ...LIVE_STATUS,
      tps: 500,
    });
    const { result } = renderHook(() => useNetwork(), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.formattedTps).toBe('500'));
  });
});
