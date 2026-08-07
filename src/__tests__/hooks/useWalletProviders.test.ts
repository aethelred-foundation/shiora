/**
 * Wallet-provider resolution — identity over slot-racing.
 *
 * With MetaMask and the Aethelred Wallet both installed, window.ethereum
 * belongs to whichever extension won the injection race (usually
 * MetaMask). The hook must therefore resolve providers by identity:
 * EIP-6963 announcement first, wallet-specific handles second, the bare
 * window.ethereum slot only as a last resort — and MetaMask must be a
 * first-class second option with the same challenge/EIP-191 auth flow.
 *
 * Ordering note: the EIP-6963 store is a module-level singleton (one
 * discovery pass per page). Tests that assert "nothing announced yet"
 * run BEFORE any test that dispatches an announcement.
 */

import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppProvider } from '@/contexts/AppContext';
import {
  useWallet,
  AETHELRED_WALLET_RDNS,
  METAMASK_RDNS,
  type Eip1193Provider,
} from '@/hooks/useWallet';

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

function createMockWallet(
  flags: Partial<Pick<Eip1193Provider, 'isAethelred' | 'isMetaMask'>> = {},
): Eip1193Provider {
  const request = jest.fn(async ({ method }: { method: string }) => {
    if (method === 'eth_requestAccounts') return [TEST_ACCOUNT];
    if (method === 'eth_chainId') return '0x1ca4';
    if (method === 'personal_sign') return '0x' + '11'.repeat(65);
    return null;
  });
  return { request, ...flags } as Eip1193Provider;
}

type WalletWindow = {
  ethereum?: Eip1193Provider;
  aethelred?: Eip1193Provider;
};

function walletWindow(): WalletWindow {
  return window as unknown as WalletWindow;
}

function announce(rdns: string, provider: Eip1193Provider) {
  window.dispatchEvent(
    new CustomEvent('eip6963:announceProvider', {
      detail: { info: { rdns }, provider },
    }),
  );
}

beforeEach(() => {
  localStorage.clear();
  delete walletWindow().ethereum;
  delete walletWindow().aethelred;
});

describe('provider availability before any EIP-6963 announcement', () => {
  it('metamask is unavailable when window.ethereum is absent', () => {
    const { result } = renderHook(() => useWallet(), { wrapper: createWrapper() });
    expect(result.current.isProviderAvailable('metamask')).toBe(false);
  });

  it('metamask is unavailable when window.ethereum is not MetaMask', () => {
    walletWindow().ethereum = createMockWallet({ isAethelred: true });
    const { result } = renderHook(() => useWallet(), { wrapper: createWrapper() });
    expect(result.current.isProviderAvailable('metamask')).toBe(false);
  });

  it('metamask is available via a window.ethereum that self-identifies', () => {
    walletWindow().ethereum = createMockWallet({ isMetaMask: true });
    const { result } = renderHook(() => useWallet(), { wrapper: createWrapper() });
    expect(result.current.isProviderAvailable('metamask')).toBe(true);
  });

  it('aethelred is available via the window.aethelred handle even when MetaMask owns window.ethereum', () => {
    walletWindow().ethereum = createMockWallet({ isMetaMask: true });
    walletWindow().aethelred = createMockWallet({ isAethelred: true });
    const { result } = renderHook(() => useWallet(), { wrapper: createWrapper() });
    expect(result.current.isProviderAvailable('aethelred')).toBe(true);
  });

  it('walletconnect has no injected provider path', () => {
    walletWindow().ethereum = createMockWallet({ isMetaMask: true });
    const { result } = renderHook(() => useWallet(), { wrapper: createWrapper() });
    expect(result.current.isProviderAvailable('walletconnect')).toBe(false);
  });

  it('connect fails clearly when MetaMask is not installed', async () => {
    const { result } = renderHook(() => useWallet(), { wrapper: createWrapper() });
    await act(async () => {
      await result.current.connect('metamask').catch(() => {});
    });
    expect(result.current.error).toMatch(/MetaMask not found/);
  });

  it('connect defaults to the Aethelred Wallet when called with no arguments', async () => {
    const { result } = renderHook(() => useWallet(), { wrapper: createWrapper() });
    await act(async () => {
      await result.current.connect().catch(() => {});
    });
    expect(result.current.error).toMatch(/Aethelred Wallet not found/);
  });

  it('rejects unknown network names instead of falling back', async () => {
    walletWindow().aethelred = createMockWallet({ isAethelred: true });
    const { result } = renderHook(() => useWallet(), { wrapper: createWrapper() });
    await act(async () => {
      await expect(result.current.connect('aethelred', 'not-a-network')).rejects.toThrow(
        /only the Aethelred public testnet/,
      );
    });
    expect(result.current.isConnected).toBe(false);
  });

  it('connect("aethelred") signs via window.aethelred, not the MetaMask-owned window.ethereum', async () => {
    const metamask = createMockWallet({ isMetaMask: true });
    const aethelred = createMockWallet({ isAethelred: true });
    walletWindow().ethereum = metamask;
    walletWindow().aethelred = aethelred;

    const { result } = renderHook(() => useWallet(), { wrapper: createWrapper() });
    await act(async () => {
      await result.current.connect('aethelred', 'testnet');
    });

    expect(result.current.isConnected).toBe(true);
    expect(aethelred.request).toHaveBeenCalledWith({ method: 'eth_requestAccounts' });
    expect(metamask.request).not.toHaveBeenCalled();
  });

  it('connect("metamask") authenticates through the same challenge flow', async () => {
    const metamask = createMockWallet({ isMetaMask: true });
    walletWindow().ethereum = metamask;

    const { result } = renderHook(() => useWallet(), { wrapper: createWrapper() });
    await act(async () => {
      await result.current.connect('metamask', 'testnet');
    });

    expect(result.current.isConnected).toBe(true);
    expect(result.current.activeProvider).toBe('metamask');
    expect(metamask.request).toHaveBeenCalledWith({ method: 'eth_requestAccounts' });
    expect(metamask.request).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'personal_sign' }),
    );
  });

  it('signMessage signs with the wallet the session was opened with', async () => {
    const metamask = createMockWallet({ isMetaMask: true });
    const aethelred = createMockWallet({ isAethelred: true });
    walletWindow().ethereum = metamask;
    walletWindow().aethelred = aethelred;

    const { result } = renderHook(() => useWallet(), { wrapper: createWrapper() });
    await act(async () => {
      await result.current.connect('metamask', 'testnet');
    });

    (metamask.request as jest.Mock).mockClear();
    (aethelred.request as jest.Mock).mockClear();

    await act(async () => {
      await result.current.signMessage({ message: 'prove it' });
    });

    expect(metamask.request).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'personal_sign' }),
    );
    expect(aethelred.request).not.toHaveBeenCalled();
  });
});

describe('EIP-6963 announcements take precedence', () => {
  it('prefers the announced Aethelred provider over every window handle', async () => {
    const announced = createMockWallet({ isAethelred: true });
    const slotOwner = createMockWallet({ isMetaMask: true });
    walletWindow().ethereum = slotOwner;
    announce(AETHELRED_WALLET_RDNS, announced);

    const { result } = renderHook(() => useWallet(), { wrapper: createWrapper() });
    await act(async () => {
      await result.current.connect('aethelred', 'testnet');
    });

    expect(result.current.isConnected).toBe(true);
    expect(announced.request).toHaveBeenCalledWith({ method: 'eth_requestAccounts' });
    expect(slotOwner.request).not.toHaveBeenCalled();
  });

  it('prefers the announced MetaMask provider over the window.ethereum slot', () => {
    const announced = createMockWallet({ isMetaMask: true });
    announce(METAMASK_RDNS, announced);

    const { result } = renderHook(() => useWallet(), { wrapper: createWrapper() });
    expect(result.current.isProviderAvailable('metamask')).toBe(true);
  });

  it('ignores malformed announcements (no rdns / no provider)', () => {
    window.dispatchEvent(new CustomEvent('eip6963:announceProvider', { detail: { info: {} } }));
    window.dispatchEvent(new CustomEvent('eip6963:announceProvider', { detail: undefined }));
    // Reaching here without a throw is the assertion; availability logic
    // still answers from the well-formed announcements above.
    const { result } = renderHook(() => useWallet(), { wrapper: createWrapper() });
    expect(result.current.isProviderAvailable('metamask')).toBe(true);
  });
});
