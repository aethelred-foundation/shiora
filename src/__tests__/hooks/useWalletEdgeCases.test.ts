/**
 * Tests for useWallet edge cases that require mocking useApp
 * to control the initial wallet state (provider, connected, chainId)
 * so that the re-enable useEffect branches are hit.
 */
import { renderHook, waitFor, act } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { KeplrProvider } from '@/hooks/useWallet';
import { api } from '@/lib/api/client';

const mockAddNotification = jest.fn();
const mockConnectWalletWithData = jest.fn();
const mockDisconnectWallet = jest.fn();

let mockWallet = {
  connected: false,
  address: '',
  balance: 0,
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

// Must import AFTER jest.mock
import { useWallet } from '@/hooks/useWallet';

function createMockKeplr(): KeplrProvider {
  return {
    enable: jest.fn().mockResolvedValue(undefined),
    getKey: jest.fn().mockResolvedValue({
      name: 'Test Key',
      algo: 'secp256k1',
      pubKey: new Uint8Array(33),
      address: new Uint8Array(20),
      bech32Address: 'aeth1mockaddress1234567890abcdef',
    }),
    signArbitrary: jest.fn().mockResolvedValue({
      signature: btoa('mocksignature1234567890'),
      pub_key: { value: btoa('mockpubkey12345') },
    }),
  };
}

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

describe('useWallet re-enable useEffect edge cases', () => {
  beforeEach(() => {
    delete (window as unknown as Record<string, unknown>).keplr;
    delete (window as unknown as Record<string, unknown>).leap;
    mockAddNotification.mockClear();
  });

  it('useEffect skips re-enable when cosmosProvider is null (line 165)', async () => {
    // Wallet is connected with keplr provider, but keplr extension is not in window
    mockWallet = {
      connected: true,
      address: 'aeth1mockaddress',
      balance: 1000,
      provider: 'keplr',
      chainId: 'aethelred-1',
    };

    const { result } = renderHook(() => useWallet(), { wrapper: makeWrapper() });

    // The useEffect fires with connected=true, activeProvider='keplr' (from wallet.provider),
    // but getCosmosProvider returns null because keplr is not in window -> line 165 returns
    expect(result.current.isConnected).toBe(true);
    expect(result.current.activeProvider).toBe('keplr');
  });

  it('useEffect catch branch when provider.enable rejects (lines 168-170)', async () => {
    const mockKeplr = createMockKeplr();
    mockKeplr.enable = jest.fn().mockRejectedValue(new Error('Extension locked'));
    (window as unknown as Record<string, unknown>).keplr = mockKeplr;

    mockWallet = {
      connected: true,
      address: 'aeth1mockaddress',
      balance: 1000,
      provider: 'keplr',
      chainId: 'aethelred-1',
    };

    const { result } = renderHook(() => useWallet(), { wrapper: makeWrapper() });

    // The useEffect fires with connected=true, activeProvider='keplr',
    // cosmosProvider.enable rejects -> catch handler runs silently
    await waitFor(() => {
      expect(mockKeplr.enable).toHaveBeenCalledWith('aethelred-1');
    });
    expect(result.current.isConnected).toBe(true);

    delete (window as unknown as Record<string, unknown>).keplr;
  });

  it('isProviderAvailable returns false for unknown provider (line 175/182)', () => {
    mockWallet = { connected: false, address: '', balance: 0, provider: undefined, chainId: undefined };
    const { result } = renderHook(() => useWallet(), { wrapper: makeWrapper() });
    expect(result.current.isProviderAvailable('unknown' as any)).toBe(false);
  });

  it('connect with leap provider exercises getLeap path', async () => {
    const mockLeap = createMockKeplr();
    (window as unknown as Record<string, unknown>).leap = mockLeap;

    mockWallet = { connected: false, address: '', balance: 0, provider: undefined, chainId: undefined };
    const { result } = renderHook(() => useWallet(), { wrapper: makeWrapper() });

    await result.current.connect('leap', 'testnet');

    expect(mockLeap.enable).toHaveBeenCalled();
    expect(mockConnectWalletWithData).toHaveBeenCalled();

    delete (window as unknown as Record<string, unknown>).leap;
  });

  it('connect with leap when leap is not injected throws error (exercises getLeap null path)', async () => {
    // No leap extension injected in window
    mockWallet = { connected: false, address: '', balance: 0, provider: undefined, chainId: undefined };
    const { result } = renderHook(() => useWallet(), { wrapper: makeWrapper() });

    let caughtError: Error | undefined;
    await result.current.connect('leap').catch((e: Error) => { caughtError = e; });

    expect(caughtError).toBeDefined();
    expect(caughtError!.message).toMatch(/not supported/);
  });

  it('useEffect skips re-enable when leap provider cosmosProvider is null', () => {
    // Wallet connected with leap provider but no leap extension
    mockWallet = {
      connected: true,
      address: 'aeth1mockaddress',
      balance: 1000,
      provider: 'leap',
      chainId: 'aethelred-1',
    };

    const { result } = renderHook(() => useWallet(), { wrapper: makeWrapper() });
    // getLeap returns null -> getCosmosProvider returns null -> useEffect returns early
    expect(result.current.isConnected).toBe(true);
  });

  it('connect with default args exercises default provider/network', async () => {
    const mockKeplr = createMockKeplr();
    (window as unknown as Record<string, unknown>).keplr = mockKeplr;

    mockWallet = { connected: false, address: '', balance: 0, provider: undefined, chainId: undefined };
    const { result } = renderHook(() => useWallet(), { wrapper: makeWrapper() });

    // Calling connect() with no args uses default provider='keplr', network='mainnet'
    await result.current.connect();

    expect(mockKeplr.enable).toHaveBeenCalledWith('aethelred-1');

    delete (window as unknown as Record<string, unknown>).keplr;
  });

  it('disconnect catch handler silently handles api.delete failure', async () => {
    mockWallet = {
      connected: true,
      address: 'aeth1mockaddress',
      balance: 1000,
      provider: 'keplr',
      chainId: 'aethelred-1',
    };

    // Mock api.delete to reject
    const spy = jest.spyOn(api, 'delete').mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useWallet(), { wrapper: makeWrapper() });

    act(() => {
      result.current.disconnect();
    });

    // Wait for the async catch to settle
    await waitFor(() => {
      expect(mockDisconnectWallet).toHaveBeenCalled();
    });

    // The disconnect should still work despite the API error
    expect(mockAddNotification).toHaveBeenCalledWith(
      'info',
      'Wallet Disconnected',
      'Your wallet has been disconnected',
    );

    spy.mockRestore();
  });
});
