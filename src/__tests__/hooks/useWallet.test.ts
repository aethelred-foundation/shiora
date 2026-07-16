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
    if (method === 'personal_sign') return '0x' + '11'.repeat(65);
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
      result.current.signTransaction({ type: 'transfer', from: '', to: '', amount: 0, blockHeight: 0 }),
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
      await result.current.signMessage({ message: 'm', signer: '0xABCDEF0000000000000000000000000000000000' });
    });
    expect(wallet.request).toHaveBeenCalledWith({
      method: 'personal_sign',
      params: ['m', '0xabcdef0000000000000000000000000000000000'],
    });
  });

  it('signMessage throws when the wallet is gone but state says connected', async () => {
    const { result } = renderHook(
      () => ({ wallet: useWallet(), app: useApp() }),
      { wrapper: createWrapper() },
    );
    act(() => {
      result.current.app.connectWalletWithData(TEST_ACCOUNT, null, 'aethelred', '7332');
    });
    await expect(result.current.wallet.signMessage({ message: 'x' })).rejects.toThrow(
      'No wallet provider available',
    );
  });

  it('signTransaction returns a 0x hash when connected', async () => {
    const { result } = renderHook(
      () => ({ wallet: useWallet(), app: useApp() }),
      { wrapper: createWrapper() },
    );
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

  it('disconnect clears local state even when the server sign-out fails', async () => {
    injectWallet(createMockWallet());
    const { result } = renderHook(() => useWallet(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.connect('aethelred');
    });
    expect(result.current.isConnected).toBe(true);

    // The DELETE /api/wallet/connect best-effort sign-out must never block a
    // local disconnect — even with the network down.
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockRejectedValue(new Error('network down'));
    try {
      await act(async () => {
        result.current.disconnect();
      });
      expect(result.current.isConnected).toBe(false);
      expect(result.current.activeProvider).toBeNull();
      expect(result.current.error).toBeNull();
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('displayAddress truncates a 0x address', () => {
    const { result } = renderHook(
      () => ({ wallet: useWallet(), app: useApp() }),
      { wrapper: createWrapper() },
    );
    act(() => {
      result.current.app.connectWalletWithData(
        '0x1234567890abcdef1234567890abcdef12345678',
        null,
        'aethelred',
      );
    });
    expect(result.current.wallet.displayAddress).toBe('0x1234…5678');
  });

  it('displayAddress returns a short value as-is', () => {
    const { result } = renderHook(
      () => ({ wallet: useWallet(), app: useApp() }),
      { wrapper: createWrapper() },
    );
    act(() => {
      result.current.app.connectWalletWithData('0x1234', null, 'aethelred');
    });
    expect(result.current.wallet.displayAddress).toBe('0x1234');
  });
});
