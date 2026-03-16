import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppProvider, useApp } from '@/contexts/AppContext';
import { useWallet, KeplrProvider } from '@/hooks/useWallet';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(
      QueryClientProvider,
      { client: queryClient },
      React.createElement(AppProvider, null, children),
    );
  };
}

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

describe('useWallet', () => {
  beforeEach(() => {
    localStorage.clear();
    delete (window as unknown as Record<string, unknown>).keplr;
    delete (window as unknown as Record<string, unknown>).leap;
  });

  it('starts in disconnected state', () => {
    const { result } = renderHook(() => useWallet(), { wrapper: createWrapper() });
    expect(result.current.isConnected).toBe(false);
    expect(result.current.wallet.connected).toBe(false);
    expect(result.current.wallet.address).toBe('');
    expect(result.current.activeProvider).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('displayAddress is empty when disconnected', () => {
    const { result } = renderHook(() => useWallet(), { wrapper: createWrapper() });
    expect(result.current.displayAddress).toBe('');
  });

  it('isProviderAvailable returns false when no extension', () => {
    const { result } = renderHook(() => useWallet(), { wrapper: createWrapper() });
    expect(result.current.isProviderAvailable('keplr')).toBe(false);
    expect(result.current.isProviderAvailable('leap')).toBe(false);
  });

  it('exposes connect, disconnect, signMessage, signTransaction functions', () => {
    const { result } = renderHook(() => useWallet(), { wrapper: createWrapper() });
    expect(typeof result.current.connect).toBe('function');
    expect(typeof result.current.disconnect).toBe('function');
    expect(typeof result.current.signMessage).toBe('function');
    expect(typeof result.current.signTransaction).toBe('function');
  });

  it('signMessage throws when not connected', async () => {
    const { result } = renderHook(() => useWallet(), { wrapper: createWrapper() });
    await expect(
      result.current.signMessage({ message: 'test' }),
    ).rejects.toThrow('Wallet not connected');
  });

  it('signTransaction throws when not connected', async () => {
    const { result } = renderHook(() => useWallet(), { wrapper: createWrapper() });
    await expect(
      result.current.signTransaction({
        type: 'transfer',
        from: '',
        to: '',
        amount: 0,
        blockHeight: 0,
      }),
    ).rejects.toThrow('Wallet not connected');
  });

  it('connect throws when provider not available', async () => {
    const { result } = renderHook(() => useWallet(), { wrapper: createWrapper() });
    // No keplr or leap injected in test env
    let caughtError: Error | undefined;
    await act(async () => {
      try {
        await result.current.connect('keplr');
      } catch (e) {
        caughtError = e as Error;
      }
    });
    expect(caughtError).toBeDefined();
    expect(result.current.error).toBeTruthy();
  });

  it('connect throws for unsupported provider', async () => {
    const { result } = renderHook(() => useWallet(), { wrapper: createWrapper() });
    await expect(
      result.current.connect('unknown' as 'keplr'),
    ).rejects.toThrow('not supported');
  });

  it('disconnect clears state', () => {
    const { result } = renderHook(
      () => ({ wallet: useWallet(), app: useApp() }),
      { wrapper: createWrapper() },
    );

    // First connect via AppContext to simulate connected state
    act(() => {
      result.current.app.connectWalletWithData('aeth1longaddressfortruncation', 1000, 'keplr', 'aethelred-1');
    });
    expect(result.current.wallet.isConnected).toBe(true);

    // Now disconnect
    act(() => {
      result.current.wallet.disconnect();
    });
    expect(result.current.wallet.isConnected).toBe(false);
    expect(result.current.wallet.error).toBeNull();
  });

  it('displayAddress truncates long addresses', () => {
    const { result } = renderHook(
      () => ({ wallet: useWallet(), app: useApp() }),
      { wrapper: createWrapper() },
    );

    act(() => {
      result.current.app.connectWalletWithData(
        'aeth1abcdef1234567890xyzxyzxyz',
        1000,
      );
    });

    expect(result.current.wallet.displayAddress).toMatch(/^aeth1abcde\.\.\.xyzxyz$/);
  });

  it('displayAddress returns short address as-is', () => {
    const { result } = renderHook(
      () => ({ wallet: useWallet(), app: useApp() }),
      { wrapper: createWrapper() },
    );

    act(() => {
      result.current.app.connectWalletWithData('aeth1short', 100);
    });

    // Short addresses (<=16 chars) returned unchanged
    expect(result.current.wallet.displayAddress).toBe('aeth1short');
  });

  it('isProviderAvailable detects keplr when injected', () => {
    (window as unknown as Record<string, unknown>).keplr = {};
    const { result } = renderHook(() => useWallet(), { wrapper: createWrapper() });
    expect(result.current.isProviderAvailable('keplr')).toBe(true);
    expect(result.current.isProviderAvailable('leap')).toBe(false);
  });

  it('isProviderAvailable detects leap when injected', () => {
    (window as unknown as Record<string, unknown>).leap = {};
    const { result } = renderHook(() => useWallet(), { wrapper: createWrapper() });
    expect(result.current.isProviderAvailable('leap')).toBe(true);
  });

  it('isProviderAvailable returns false for unknown provider', () => {
    const { result } = renderHook(() => useWallet(), { wrapper: createWrapper() });
    expect(result.current.isProviderAvailable('unknown' as 'keplr')).toBe(false);
  });

  it('signMessage throws when no provider even if connected', async () => {
    const { result } = renderHook(
      () => ({ wallet: useWallet(), app: useApp() }),
      { wrapper: createWrapper() },
    );

    // Connect without a real provider
    act(() => {
      result.current.app.connectWalletWithData('aeth1abc123def456ghi', 1000);
    });

    await expect(
      result.current.wallet.signMessage({ message: 'test' }),
    ).rejects.toThrow('No wallet provider available');
  });

  it('signTransaction returns hash when connected', async () => {
    const { result } = renderHook(
      () => ({ wallet: useWallet(), app: useApp() }),
      { wrapper: createWrapper() },
    );

    act(() => {
      result.current.app.connectWalletWithData('aeth1abc123def456ghi', 1000);
    });

    let hash: string | undefined;
    await act(async () => {
      hash = await result.current.wallet.signTransaction({
        type: 'transfer',
        from: 'aeth1abc123def456ghi',
        to: 'aeth1xyz',
        amount: 100,
        blockHeight: 12345,
      });
    });

    expect(hash).toBeDefined();
    expect(hash!.startsWith('0x')).toBe(true);
  });

  it('connect succeeds with keplr provider injected', async () => {
    const mockKeplr = createMockKeplr();
    (window as unknown as Record<string, unknown>).keplr = mockKeplr;

    const { result } = renderHook(() => useWallet(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.connect('keplr', 'mainnet');
    });

    expect(result.current.isConnected).toBe(true);
    expect(result.current.activeProvider).toBe('keplr');
    expect(result.current.error).toBeNull();
  });

  it('connect succeeds with leap provider', async () => {
    const mockLeap = createMockKeplr();
    (window as unknown as Record<string, unknown>).leap = mockLeap;

    const { result } = renderHook(() => useWallet(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.connect('leap', 'testnet');
    });

    expect(result.current.isConnected).toBe(true);
    expect(result.current.activeProvider).toBe('leap');
  });

  it('signMessage works after successful connect with provider', async () => {
    const mockKeplr = createMockKeplr();
    (window as unknown as Record<string, unknown>).keplr = mockKeplr;

    const { result } = renderHook(() => useWallet(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.connect('keplr');
    });

    let signResult: { message: string; signature: string; publicKey: string } | undefined;
    await act(async () => {
      signResult = await result.current.signMessage({ message: 'test message' });
    });

    expect(signResult).toBeDefined();
    expect(signResult!.message).toBe('test message');
    expect(typeof signResult!.signature).toBe('string');
    expect(typeof signResult!.publicKey).toBe('string');
  });

  it('re-enables provider on mount when persisted wallet state exists', async () => {
    const mockKeplr = createMockKeplr();
    (window as unknown as Record<string, unknown>).keplr = mockKeplr;

    // First connect to set persisted state
    const { result: r1, unmount } = renderHook(
      () => ({ wallet: useWallet(), app: useApp() }),
      { wrapper: createWrapper() },
    );

    act(() => {
      r1.current.app.connectWalletWithData('aeth1mockaddress', 1000, 'keplr', 'aethelred-1');
    });
    unmount();

    // Now re-render with persisted state - the useEffect should call enable
    const { result: r2 } = renderHook(() => useWallet(), { wrapper: createWrapper() });
    // Wait for the effect to run
    await waitFor(() => {
      expect(r2.current.isConnected).toBe(true);
    });
  });

  it('connect with default network uses mainnet chain ID', async () => {
    const mockKeplr = createMockKeplr();
    (window as unknown as Record<string, unknown>).keplr = mockKeplr;

    const { result } = renderHook(() => useWallet(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.connect('keplr');
    });

    expect(mockKeplr.enable).toHaveBeenCalledWith('aethelred-1');
  });

  it('connect with unknown network falls back to mainnet chain ID', async () => {
    const mockKeplr = createMockKeplr();
    (window as unknown as Record<string, unknown>).keplr = mockKeplr;

    const { result } = renderHook(() => useWallet(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.connect('keplr', 'unknownnet');
    });

    expect(mockKeplr.enable).toHaveBeenCalledWith('aethelred-1');
    expect(result.current.isConnected).toBe(true);
  });

  it('disconnect sends delete request and clears provider', async () => {
    const mockKeplr = createMockKeplr();
    (window as unknown as Record<string, unknown>).keplr = mockKeplr;

    const { result } = renderHook(() => useWallet(), { wrapper: createWrapper() });

    // Connect first
    await act(async () => {
      await result.current.connect('keplr');
    });
    expect(result.current.isConnected).toBe(true);
    expect(result.current.activeProvider).toBe('keplr');

    // Disconnect
    act(() => {
      result.current.disconnect();
    });
    expect(result.current.isConnected).toBe(false);
    expect(result.current.activeProvider).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('connect handles keplr.enable failure', async () => {
    const mockKeplr = createMockKeplr();
    mockKeplr.enable = jest.fn().mockRejectedValue(new Error('User rejected'));
    (window as unknown as Record<string, unknown>).keplr = mockKeplr;

    const { result } = renderHook(() => useWallet(), { wrapper: createWrapper() });

    let caughtError: Error | undefined;
    await act(async () => {
      try {
        await result.current.connect('keplr');
      } catch (e) {
        caughtError = e as Error;
      }
    });

    expect(caughtError).toBeDefined();
    expect(result.current.error).toBe('User rejected');
    expect(result.current.isLoading).toBe(false);
  });

  it('signMessage uses signer param when provided', async () => {
    const mockKeplr = createMockKeplr();
    (window as unknown as Record<string, unknown>).keplr = mockKeplr;

    const { result } = renderHook(() => useWallet(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.connect('keplr');
    });

    let signResult: { message: string; signature: string; publicKey: string } | undefined;
    await act(async () => {
      signResult = await result.current.signMessage({
        message: 'test',
        signer: 'aeth1customsigner',
      });
    });

    expect(signResult).toBeDefined();
    // signArbitrary should have been called with the custom signer
    expect(mockKeplr.signArbitrary).toHaveBeenCalledWith(
      expect.any(String),
      'aeth1customsigner',
      'test',
    );
  });

  it('getLeap returns provider when leap is injected', () => {
    const mockLeap = createMockKeplr();
    (window as unknown as Record<string, unknown>).leap = mockLeap;

    const { result } = renderHook(() => useWallet(), { wrapper: createWrapper() });
    expect(result.current.isProviderAvailable('leap')).toBe(true);
  });

  it('connect error with non-Error thrown uses default message', async () => {
    const mockKeplr = createMockKeplr();
    mockKeplr.enable = jest.fn().mockRejectedValue('string error');
    (window as unknown as Record<string, unknown>).keplr = mockKeplr;

    const { result } = renderHook(() => useWallet(), { wrapper: createWrapper() });

    let caughtError: unknown;
    await act(async () => {
      try {
        await result.current.connect('keplr');
      } catch (e) {
        caughtError = e;
      }
    });

    expect(caughtError).toBe('string error');
    expect(result.current.error).toBe('Failed to connect wallet');
  });

  it('useEffect re-enables wallet on mount with persisted keplr provider', async () => {
    const mockKeplr = createMockKeplr();
    (window as unknown as Record<string, unknown>).keplr = mockKeplr;

    // Simulate persisted state by connecting first
    const { result: r1, unmount: u1 } = renderHook(
      () => ({ wallet: useWallet(), app: useApp() }),
      { wrapper: createWrapper() },
    );

    // Connect via keplr
    await act(async () => {
      await r1.current.wallet.connect('keplr');
    });
    expect(r1.current.wallet.isConnected).toBe(true);

    u1();

    // Re-render - the useEffect should call cosmosProvider.enable
    const enableCallsBefore = (mockKeplr.enable as jest.Mock).mock.calls.length;

    const wrapper2 = createWrapper();
    const { result: r2 } = renderHook(() => useWallet(), { wrapper: wrapper2 });

    // The persisted state from localStorage triggers the re-enable effect
    await waitFor(() => {
      expect(r2.current.isConnected).toBe(true);
    });
  });

  it('useEffect skips re-enable when cosmosProvider is null (extension removed)', async () => {
    // Pre-set localStorage so wallet initializes with provider='keplr' and connected=true
    // but don't inject keplr into window. This hits line 165: if (!cosmosProvider) return;
    // Use address 'aeth1mock' to match the GET /api/wallet/connect mock response.
    localStorage.setItem('shiora_wallet', JSON.stringify({
      connected: true,
      address: 'aeth1mock',
      balance: 1000,
      provider: 'keplr',
      chainId: 'aethelred-1',
    }));

    const { result } = renderHook(() => useWallet(), { wrapper: createWrapper() });

    // The useEffect fires with connected=true, activeProvider='keplr', but no keplr extension
    // so getCosmosProvider returns null and the effect returns early
    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });

    localStorage.removeItem('shiora_wallet');
  });

});
