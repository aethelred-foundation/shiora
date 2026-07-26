import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppProvider, useApp } from '@/contexts/AppContext';
import { useWallet, type Eip1193Provider } from '@/hooks/useWallet';

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

const TEST_ACCOUNT = '0x00000000000000000000000000000000000a1b2c';

/**
 * A mock Aethelred Wallet (EIP-1193) provider. Responds to eth_requestAccounts
 * with a 0x account and to personal_sign with a well-formed 65-byte signature.
 */
function createMockWallet(overrides: Partial<Record<string, unknown>> = {}): Eip1193Provider {
  const request = jest.fn(async ({ method }: { method: string }) => {
    if (method === 'eth_requestAccounts') return [TEST_ACCOUNT];
    if (method === 'eth_chainId') return '0x1ca4';
    if (method === 'personal_sign') return '0x' + '11'.repeat(65);
    if (method === 'eth_sendTransaction') return '0x' + '22'.repeat(32);
    return null;
  });
  return { request, isAethelred: true, ...overrides } as Eip1193Provider;
}

function injectWallet(provider: Eip1193Provider | null) {
  if (provider) {
    (window as unknown as Record<string, unknown>).ethereum = provider;
  } else {
    delete (window as unknown as Record<string, unknown>).ethereum;
  }
}

describe('useWallet (Aethelred Wallet / EIP-1193)', () => {
  beforeEach(() => {
    localStorage.clear();
    injectWallet(null);
  });

  it('starts in disconnected state', () => {
    const { result } = renderHook(() => useWallet(), { wrapper: createWrapper() });
    expect(result.current.isConnected).toBe(false);
    expect(result.current.wallet.address).toBe('');
    expect(result.current.activeProvider).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('displayAddress is empty when disconnected', () => {
    const { result } = renderHook(() => useWallet(), { wrapper: createWrapper() });
    expect(result.current.displayAddress).toBe('');
  });

  it('isProviderAvailable is false when no wallet is injected', () => {
    const { result } = renderHook(() => useWallet(), { wrapper: createWrapper() });
    expect(result.current.isProviderAvailable('aethelred')).toBe(false);
  });

  it('isProviderAvailable is true when the Aethelred Wallet is injected', () => {
    injectWallet(createMockWallet());
    const { result } = renderHook(() => useWallet(), { wrapper: createWrapper() });
    expect(result.current.isProviderAvailable('aethelred')).toBe(true);
  });

  it('exposes connect, disconnect, signMessage, signTransaction', () => {
    const { result } = renderHook(() => useWallet(), { wrapper: createWrapper() });
    expect(typeof result.current.connect).toBe('function');
    expect(typeof result.current.disconnect).toBe('function');
    expect(typeof result.current.signMessage).toBe('function');
    expect(typeof result.current.signTransaction).toBe('function');
  });

  it('signMessage throws when not connected', async () => {
    const { result } = renderHook(() => useWallet(), { wrapper: createWrapper() });
    await expect(result.current.signMessage({ message: 'test' })).rejects.toThrow(
      'Wallet not connected',
    );
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

  it('connect fails clearly when the Aethelred Wallet is not installed', async () => {
    const { result } = renderHook(() => useWallet(), { wrapper: createWrapper() });
    let caught: Error | undefined;
    await act(async () => {
      try {
        await result.current.connect('aethelred');
      } catch (e) {
        caught = e as Error;
      }
    });
    expect(caught).toBeDefined();
    expect(result.current.error).toMatch(/Aethelred Wallet not found/);
  });

  it('fails loudly when the session cookie does not stick (post-connect probe)', async () => {
    const wallet = createMockWallet();
    injectWallet(wallet);
    // Simulate a browser that dropped the Secure-only cookie: the probe 401s.
    const realFetch = global.fetch;
    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/api/me')) {
        return new Response(
          JSON.stringify({
            success: false,
            error: { code: 'UNAUTHORIZED', message: 'no session' },
          }),
          { status: 401, headers: { 'content-type': 'application/json' } },
        );
      }
      return realFetch(input as RequestInfo, init);
    }) as typeof fetch;

    const { result } = renderHook(() => useWallet(), { wrapper: createWrapper() });
    try {
      let caught: Error | undefined;
      await act(async () => {
        try {
          await result.current.connect('aethelred', 'testnet');
        } catch (e) {
          caught = e as Error;
        }
      });
      expect(caught?.message).toMatch(/did not keep the session cookie/);
      expect(result.current.isConnected).toBe(false);
    } finally {
      global.fetch = realFetch;
    }
  });

  it('connect succeeds via the Aethelred Wallet (requestAccounts + personal_sign)', async () => {
    const wallet = createMockWallet();
    injectWallet(wallet);
    const { result } = renderHook(() => useWallet(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.connect('aethelred', 'testnet');
    });

    expect(result.current.isConnected).toBe(true);
    expect(result.current.activeProvider).toBe('aethelred');
    expect(result.current.error).toBeNull();
    // Drove the real EIP-1193 methods.
    expect(wallet.request).toHaveBeenCalledWith({ method: 'eth_requestAccounts' });
    expect(wallet.request).toHaveBeenCalledWith({ method: 'eth_chainId' });
    expect(wallet.request).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'personal_sign' }),
    );
  });

  it('connect rejects when no account is authorised', async () => {
    const wallet = createMockWallet({
      request: jest.fn(async ({ method }: { method: string }) =>
        method === 'eth_requestAccounts' ? [] : null,
      ),
    });
    injectWallet(wallet);
    const { result } = renderHook(() => useWallet(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.connect('aethelred').catch(() => {});
    });
    expect(result.current.isConnected).toBe(false);
    expect(result.current.error).toMatch(/No account was authorised/);
  });

  it('switches to chain 7332 before authenticating when the wallet is on another chain', async () => {
    let activeChainId = '0x1';
    const wallet = createMockWallet({
      request: jest.fn(async ({ method }: { method: string }) => {
        if (method === 'eth_requestAccounts') return [TEST_ACCOUNT];
        if (method === 'eth_chainId') return activeChainId;
        if (method === 'wallet_switchEthereumChain') {
          activeChainId = '0x1ca4';
          return null;
        }
        if (method === 'personal_sign') return '0x' + '11'.repeat(65);
        return null;
      }),
    });
    injectWallet(wallet);
    const { result } = renderHook(() => useWallet(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.connect('aethelred', 'testnet');
    });

    expect(wallet.request).toHaveBeenCalledWith({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: '0x1ca4' }],
    });
    expect(result.current.wallet.chainId).toBe('7332');
  });

  it('fails closed when chain 7332 is not configured in the wallet', async () => {
    const missingChain = Object.assign(new Error('Unknown chain'), { code: 4902 });
    const wallet = createMockWallet({
      request: jest.fn(async ({ method }: { method: string }) => {
        if (method === 'eth_requestAccounts') return [TEST_ACCOUNT];
        if (method === 'eth_chainId') return '0x1';
        if (method === 'wallet_switchEthereumChain') throw missingChain;
        return null;
      }),
    });
    injectWallet(wallet);
    const { result } = renderHook(() => useWallet(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.connect('aethelred', 'testnet').catch(() => {});
    });

    expect(result.current.isConnected).toBe(false);
    expect(result.current.error).toMatch(/official chain 7332 network profile/);
  });

  it('connect surfaces a user rejection from the wallet', async () => {
    const wallet = createMockWallet({
      request: jest.fn(async () => {
        throw new Error('User rejected the request');
      }),
    });
    injectWallet(wallet);
    const { result } = renderHook(() => useWallet(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.connect('aethelred').catch(() => {});
    });
    expect(result.current.error).toBe('User rejected the request');
    expect(result.current.isLoading).toBe(false);
  });

  it('connect uses a non-Error thrown value default message', async () => {
    const wallet = createMockWallet({
      request: jest.fn(async () => {
        throw 'string error';
      }),
    });
    injectWallet(wallet);
    const { result } = renderHook(() => useWallet(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.connect('aethelred').catch(() => {});
    });
    expect(result.current.error).toBe('Failed to connect wallet');
  });

  it('signMessage returns a signature after connect', async () => {
    injectWallet(createMockWallet());
    const { result } = renderHook(() => useWallet(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.connect('aethelred');
    });

    let sig: { message: string; signature: string; publicKey: string } | undefined;
    await act(async () => {
      sig = await result.current.signMessage({ message: 'hello' });
    });
    expect(sig!.message).toBe('hello');
    expect(sig!.signature.startsWith('0x')).toBe(true);
  });

  it('signMessage passes an explicit signer to personal_sign (lowercased)', async () => {
    const wallet = createMockWallet();
    injectWallet(wallet);
    const { result } = renderHook(() => useWallet(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.connect('aethelred');
    });
    await act(async () => {
      await result.current.signMessage({
        message: 'm',
        signer: '0xABCDEF0000000000000000000000000000000000',
      });
    });
    expect(wallet.request).toHaveBeenCalledWith({
      method: 'personal_sign',
      params: ['m', '0xabcdef0000000000000000000000000000000000'],
    });
  });

  it('signMessage throws when the wallet is gone but state says connected', async () => {
    const { result } = renderHook(() => ({ wallet: useWallet(), app: useApp() }), {
      wrapper: createWrapper(),
    });
    act(() => {
      result.current.app.connectWalletWithData(TEST_ACCOUNT, null, 'aethelred', '7332');
    });
    await expect(result.current.wallet.signMessage({ message: 'x' })).rejects.toThrow(
      'No wallet provider available',
    );
  });

  it('signTransaction broadcasts through the connected wallet', async () => {
    const provider = createMockWallet();
    injectWallet(provider);
    const { result } = renderHook(() => ({ wallet: useWallet(), app: useApp() }), {
      wrapper: createWrapper(),
    });
    act(() => {
      result.current.app.connectWalletWithData(TEST_ACCOUNT, null, 'aethelred', '7332');
    });

    let hash: string | undefined;
    await act(async () => {
      hash = await result.current.wallet.signTransaction({
        type: 'transfer',
        from: TEST_ACCOUNT,
        to: '0x1111111111111111111111111111111111111111',
        amount: 100,
        blockHeight: 12345,
      });
    });
    expect(hash!.startsWith('0x')).toBe(true);
    expect(provider.request).toHaveBeenCalledWith({
      method: 'eth_sendTransaction',
      params: [
        {
          from: TEST_ACCOUNT,
          to: '0x1111111111111111111111111111111111111111',
          value: '0x56bc75e2d63100000',
        },
      ],
    });
  });

  it('switches to chain 7332 before broadcasting a transaction', async () => {
    let activeChainId = '0x1';
    const provider = createMockWallet({
      request: jest.fn(async ({ method }: { method: string }) => {
        if (method === 'eth_chainId') return activeChainId;
        if (method === 'wallet_switchEthereumChain') {
          activeChainId = '0x1ca4';
          return null;
        }
        if (method === 'eth_sendTransaction') return '0x' + '22'.repeat(32);
        return null;
      }),
    });
    injectWallet(provider);
    const { result } = renderHook(() => ({ wallet: useWallet(), app: useApp() }), {
      wrapper: createWrapper(),
    });
    act(() => {
      result.current.app.connectWalletWithData(TEST_ACCOUNT, null, 'aethelred', '7332');
    });

    await act(async () => {
      await result.current.wallet.signTransaction({
        type: 'transfer',
        from: TEST_ACCOUNT,
        to: '0x1111111111111111111111111111111111111111',
        amount: 1,
        blockHeight: 1,
      });
    });

    expect(provider.request).toHaveBeenCalledWith({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: '0x1ca4' }],
    });
    expect(provider.request).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'eth_sendTransaction' }),
    );
  });

  it('signTransaction fails when the injected provider is no longer available', async () => {
    const { result } = renderHook(() => ({ wallet: useWallet(), app: useApp() }), {
      wrapper: createWrapper(),
    });
    act(() => {
      result.current.app.connectWalletWithData(TEST_ACCOUNT, null, 'aethelred', '7332');
    });

    await expect(
      result.current.wallet.signTransaction({
        type: 'transfer',
        from: TEST_ACCOUNT,
        to: '0x1111111111111111111111111111111111111111',
        amount: 1,
        blockHeight: 1,
      }),
    ).rejects.toThrow('No wallet provider available for transactions');
  });

  it('signTransaction rejects a sender other than the connected wallet', async () => {
    injectWallet(createMockWallet());
    const { result } = renderHook(() => ({ wallet: useWallet(), app: useApp() }), {
      wrapper: createWrapper(),
    });
    act(() => {
      result.current.app.connectWalletWithData(TEST_ACCOUNT, null, 'aethelred', '7332');
    });

    await expect(
      result.current.wallet.signTransaction({
        type: 'transfer',
        from: '0x9999999999999999999999999999999999999999',
        to: '0x1111111111111111111111111111111111111111',
        amount: 1,
        blockHeight: 1,
      }),
    ).rejects.toThrow('Transaction sender does not match the connected wallet');
  });

  it('signTransaction rejects an invalid EVM recipient', async () => {
    injectWallet(createMockWallet());
    const { result } = renderHook(() => ({ wallet: useWallet(), app: useApp() }), {
      wrapper: createWrapper(),
    });
    act(() => {
      result.current.app.connectWalletWithData(TEST_ACCOUNT, null, 'aethelred', '7332');
    });

    await expect(
      result.current.wallet.signTransaction({
        type: 'transfer',
        from: TEST_ACCOUNT,
        to: 'not-an-address',
        amount: 1,
        blockHeight: 1,
      }),
    ).rejects.toThrow('Transaction recipient must be a valid EVM address');
  });

  it.each([0, Number.POSITIVE_INFINITY])(
    'signTransaction rejects invalid amount %s',
    async (amount) => {
      injectWallet(createMockWallet());
      const { result } = renderHook(() => ({ wallet: useWallet(), app: useApp() }), {
        wrapper: createWrapper(),
      });
      act(() => {
        result.current.app.connectWalletWithData(TEST_ACCOUNT, null, 'aethelred', '7332');
      });

      await expect(
        result.current.wallet.signTransaction({
          type: 'transfer',
          from: TEST_ACCOUNT,
          to: '0x1111111111111111111111111111111111111111',
          amount,
          blockHeight: 1,
        }),
      ).rejects.toThrow('Transaction amount must be a positive finite number');
    },
  );

  it('signTransaction rejects a malformed transaction hash from the wallet', async () => {
    const provider = createMockWallet({
      request: jest.fn(async ({ method }: { method: string }) => {
        if (method === 'eth_chainId') return '0x1ca4';
        if (method === 'eth_sendTransaction') return 'not-a-hash';
        return null;
      }),
    });
    injectWallet(provider);
    const { result } = renderHook(() => ({ wallet: useWallet(), app: useApp() }), {
      wrapper: createWrapper(),
    });
    act(() => {
      result.current.app.connectWalletWithData(TEST_ACCOUNT, null, 'aethelred', '7332');
    });

    await expect(
      result.current.wallet.signTransaction({
        type: 'transfer',
        from: TEST_ACCOUNT,
        to: '0x1111111111111111111111111111111111111111',
        amount: 1,
        blockHeight: 1,
      }),
    ).rejects.toThrow('Wallet returned an invalid transaction hash');
  });

  it('disconnect clears state', async () => {
    injectWallet(createMockWallet());
    const { result } = renderHook(() => useWallet(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.connect('aethelred');
    });
    expect(result.current.isConnected).toBe(true);
    expect(result.current.activeProvider).toBe('aethelred');

    act(() => {
      result.current.disconnect();
    });
    expect(result.current.isConnected).toBe(false);
    expect(result.current.activeProvider).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('displayAddress truncates a 0x address', () => {
    const { result } = renderHook(() => ({ wallet: useWallet(), app: useApp() }), {
      wrapper: createWrapper(),
    });
    act(() => {
      result.current.app.connectWalletWithData(
        '0x1234567890abcdef1234567890abcdef12345678',
        null,
        'aethelred',
        '7332',
      );
    });
    expect(result.current.wallet.displayAddress).toBe('0x1234…5678');
  });

  it('displayAddress returns a short value as-is', () => {
    const { result } = renderHook(() => ({ wallet: useWallet(), app: useApp() }), {
      wrapper: createWrapper(),
    });
    act(() => {
      result.current.app.connectWalletWithData('0x1234', null, 'aethelred', '7332');
    });
    expect(result.current.wallet.displayAddress).toBe('0x1234');
  });
});
