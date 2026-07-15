/**
 * useWallet edge cases that need a controlled initial wallet state
 * (persisted provider/chainId) via a mocked useApp.
 *
 * The Aethelred Wallet is EIP-1193, so — unlike the old Cosmos flow — there is
 * no "re-enable the extension on mount" step. These tests cover what remains:
 * restoring persisted session state and the provider-detection path.
 */
import { renderHook } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Eip1193Provider } from '@/hooks/useWallet';

const mockAddNotification = jest.fn();
const mockConnectWalletWithData = jest.fn();
const mockDisconnectWallet = jest.fn();

let mockWallet = {
  connected: false,
  address: '',
  balance: 0 as number | null,
  provider: undefined as string | undefined,
  chainId: undefined as string | undefined,
};

jest.mock('@/contexts/AppContext', () => ({
  ...jest.requireActual('@/contexts/AppContext'),
  useApp: () => ({
    wallet: mockWallet,
    realTime: {
      blockHeight: 100000,
      tps: 2000,
      epoch: 1,
      networkLoad: 50,
      aethelPrice: 1.5,
      lastBlockTime: Date.now(),
    },
    notifications: [],
    addNotification: mockAddNotification,
    dismissNotification: jest.fn(),
    connectWallet: jest.fn(),
    connectWalletWithData: mockConnectWalletWithData,
    disconnectWallet: mockDisconnectWallet,
    clearNotifications: jest.fn(),
  }),
}));

import { useWallet } from '@/hooks/useWallet';

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return React.createElement(QueryClientProvider, { client: qc }, children);
}

function injectWallet(provider: Eip1193Provider | null) {
  if (provider) {
    (window as unknown as Record<string, unknown>).ethereum = provider;
  } else {
    delete (window as unknown as Record<string, unknown>).ethereum;
  }
}

describe('useWallet edge cases (persisted state, provider detection)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    injectWallet(null);
    mockWallet = {
      connected: false,
      address: '',
      balance: 0,
      provider: undefined,
      chainId: undefined,
    };
  });

  it('restores the active provider from persisted wallet state', () => {
    mockWallet = {
      connected: true,
      address: '0x00000000000000000000000000000000000a1b2c',
      balance: null,
      provider: 'aethelred',
      chainId: '7332',
    };
    const { result } = renderHook(() => useWallet(), { wrapper });
    expect(result.current.isConnected).toBe(true);
    expect(result.current.activeProvider).toBe('aethelred');
  });

  it('reports the wallet available when window.ethereum is injected', () => {
    injectWallet({ request: jest.fn(), isAethelred: true } as unknown as Eip1193Provider);
    const { result } = renderHook(() => useWallet(), { wrapper });
    expect(result.current.isProviderAvailable('aethelred')).toBe(true);
  });

  it('reports the wallet unavailable when nothing is injected', () => {
    const { result } = renderHook(() => useWallet(), { wrapper });
    expect(result.current.isProviderAvailable('aethelred')).toBe(false);
  });

  it('derives a truncated display address from a persisted 0x account', () => {
    mockWallet = {
      connected: true,
      address: '0xabcdef0123456789abcdef0123456789abcdef01',
      balance: null,
      provider: 'aethelred',
      chainId: '7331',
    };
    const { result } = renderHook(() => useWallet(), { wrapper });
    expect(result.current.displayAddress).toBe('0xabcd…ef01');
  });
});
