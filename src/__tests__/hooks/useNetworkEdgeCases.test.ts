/**
 * Tests for useNetwork edge cases that require mocking useApp
 * to control realTime values for health classification and formatting branches.
 */
import { renderHook } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockUseApp = jest.fn();

jest.mock('@/contexts/AppContext', () => ({
  ...jest.requireActual('@/contexts/AppContext'),
  useApp: () => mockUseApp(),
}));

// Must import AFTER jest.mock
import { useNetwork } from '@/hooks/useNetwork';

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

function setRealTime(overrides: Partial<Record<string, number>>) {
  mockUseApp.mockReturnValue({
    realTime: {
      blockHeight: 100000,
      tps: 2000,
      epoch: 1,
      networkLoad: 50,
      aethelPrice: 1.5,
      lastBlockTime: Date.now(),
      ...overrides,
    },
    wallet: { connected: false, address: '', balance: 0 },
    notifications: [],
    addNotification: jest.fn(),
    dismissNotification: jest.fn(),
    connectWallet: jest.fn(),
    connectWalletWithData: jest.fn(),
    disconnectWallet: jest.fn(),
    clearNotifications: jest.fn(),
  });
}

describe('useNetwork health classification edge cases', () => {
  it('returns critical when tps < 100', () => {
    setRealTime({ tps: 50 });
    const { result } = renderHook(() => useNetwork(), { wrapper: makeWrapper() });
    expect(result.current.health).toBe('critical');
  });

  it('returns critical when networkLoad > 95', () => {
    setRealTime({ networkLoad: 97 });
    const { result } = renderHook(() => useNetwork(), { wrapper: makeWrapper() });
    expect(result.current.health).toBe('critical');
  });

  it('returns degraded when tps < 500 but >= 100', () => {
    setRealTime({ tps: 300 });
    const { result } = renderHook(() => useNetwork(), { wrapper: makeWrapper() });
    expect(result.current.health).toBe('degraded');
  });

  it('returns degraded when networkLoad > 85 but <= 95', () => {
    setRealTime({ networkLoad: 90 });
    const { result } = renderHook(() => useNetwork(), { wrapper: makeWrapper() });
    expect(result.current.health).toBe('degraded');
  });

  it('formattedTps returns plain number when tps < 1000', () => {
    setRealTime({ tps: 500 });
    const { result } = renderHook(() => useNetwork(), { wrapper: makeWrapper() });
    expect(result.current.formattedTps).toBe('500');
  });
});
