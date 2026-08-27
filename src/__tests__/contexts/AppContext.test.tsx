import React from 'react';
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';

import { AppProvider, useApp } from '@/contexts/AppContext';

const WALLET_ADDRESS = '0x0000000000000000000000000000000000000001';

function ContextConsumer() {
  const context = useApp();
  return (
    <div>
      <span data-testid="connected">{context.wallet.connected.toString()}</span>
      <span data-testid="address">{context.wallet.address}</span>
      <span data-testid="balance">{context.wallet.aethelBalance ?? 'none'}</span>
      <span data-testid="provider">{context.wallet.provider ?? 'none'}</span>
      <span data-testid="chain-id">{context.wallet.chainId ?? 'none'}</span>
      <span data-testid="notification-count">{context.notifications.length}</span>
      <span data-testid="search-open">{context.searchOpen.toString()}</span>
      <button
        type="button"
        onClick={() => context.connectWalletWithData(WALLET_ADDRESS, null, 'aethelred', '7332')}
      >
        Authenticate
      </button>
      <button type="button" onClick={context.disconnectWallet}>
        Disconnect
      </button>
      <button
        type="button"
        onClick={() => context.addNotification('success', 'Saved', 'The record was saved.')}
      >
        Notify
      </button>
      <button type="button" onClick={() => context.setSearchOpen(true)}>
        Search
      </button>
      {context.notifications.map((notification) => (
        <button
          type="button"
          key={notification.id}
          onClick={() => context.removeNotification(notification.id)}
        >
          {notification.title}
        </button>
      ))}
    </div>
  );
}

function renderContext() {
  return render(
    <AppProvider>
      <ContextConsumer />
    </AppProvider>,
  );
}

describe('AppProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.restoreAllMocks();
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: { address: WALLET_ADDRESS },
      }),
    } as Response);
  });

  it('renders children with an unauthenticated wallet by default', () => {
    renderContext();
    expect(screen.getByTestId('connected')).toHaveTextContent('false');
    expect(screen.getByTestId('address')).toHaveTextContent('');
    expect(screen.getByTestId('notification-count')).toHaveTextContent('0');
    expect(screen.getByTestId('search-open')).toHaveTextContent('false');
  });

  it('requires consumers to be wrapped by the provider', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<ContextConsumer />)).toThrow(
      'useApp must be used within an <AppProvider>',
    );
    consoleError.mockRestore();
  });

  it('stores only wallet state after authenticated connection', () => {
    renderContext();
    fireEvent.click(screen.getByText('Authenticate'));

    expect(screen.getByTestId('connected')).toHaveTextContent('true');
    expect(screen.getByTestId('address')).toHaveTextContent(WALLET_ADDRESS);
    expect(screen.getByTestId('provider')).toHaveTextContent('aethelred');
    expect(screen.getByTestId('chain-id')).toHaveTextContent('7332');
    expect(JSON.parse(localStorage.getItem('shiora_wallet') ?? '{}')).toMatchObject({
      connected: true,
      address: WALLET_ADDRESS,
      aethelBalance: null,
      provider: 'aethelred',
      chainId: '7332',
    });
  });

  it('normalizes an omitted wallet provider without weakening chain validation', () => {
    const { result } = renderHook(() => useApp(), {
      wrapper: ({ children }) => <AppProvider>{children}</AppProvider>,
    });

    act(() => {
      result.current.connectWalletWithData(WALLET_ADDRESS, null, undefined, '7332');
    });
    expect(result.current.wallet.provider).toBeNull();
    expect(result.current.wallet.chainId).toBe('7332');
  });

  it('rejects a wallet connection outside the public testnet', () => {
    const { result } = renderHook(() => useApp(), {
      wrapper: ({ children }) => <AppProvider>{children}</AppProvider>,
    });

    expect(() =>
      act(() => {
        result.current.connectWalletWithData(WALLET_ADDRESS, null, 'aethelred', '1');
      }),
    ).toThrow(/only on the Aethelred public testnet/);
    expect(result.current.wallet.connected).toBe(false);
  });

  it('disconnects locally and requests server-session deletion', async () => {
    renderContext();
    fireEvent.click(screen.getByText('Authenticate'));
    fireEvent.click(screen.getByText('Disconnect'));

    expect(screen.getByTestId('connected')).toHaveTextContent('false');
    expect(localStorage.getItem('shiora_wallet')).toBeNull();
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/wallet/connect',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('remains locally disconnected when server-session deletion fails', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('logout unavailable'));
    renderContext();
    fireEvent.click(screen.getByText('Authenticate'));

    await act(async () => {
      fireEvent.click(screen.getByText('Disconnect'));
      await Promise.resolve();
    });

    expect(screen.getByTestId('connected')).toHaveTextContent('false');
    expect(localStorage.getItem('shiora_wallet')).toBeNull();
  });

  it('restores wallet state only when the server session matches', async () => {
    localStorage.setItem(
      'shiora_wallet',
      JSON.stringify({
        connected: true,
        address: WALLET_ADDRESS,
        aethelBalance: 7.5,
        provider: 'aethelred',
        chainId: '7332',
      }),
    );
    renderContext();

    await waitFor(() => expect(screen.getByTestId('connected')).toHaveTextContent('true'));
    expect(screen.getByTestId('balance')).toHaveTextContent('7.5');
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/wallet/connect',
      expect.objectContaining({
        credentials: 'include',
        cache: 'no-store',
      }),
    );
  });

  it('clears a restored wallet when the server session differs', async () => {
    localStorage.setItem(
      'shiora_wallet',
      JSON.stringify({
        connected: true,
        address: WALLET_ADDRESS,
        chainId: '7332',
      }),
    );
    jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          address: '0x0000000000000000000000000000000000000002',
        },
      }),
    } as Response);
    renderContext();

    await waitFor(() => expect(localStorage.getItem('shiora_wallet')).toBeNull());
    expect(screen.getByTestId('connected')).toHaveTextContent('false');
  });

  it('clears a restored wallet when server-session validation is rejected', async () => {
    localStorage.setItem(
      'shiora_wallet',
      JSON.stringify({
        connected: true,
        address: WALLET_ADDRESS,
        chainId: '7332',
      }),
    );
    jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 401,
    } as Response);
    renderContext();

    await waitFor(() => expect(localStorage.getItem('shiora_wallet')).toBeNull());
    expect(screen.getByTestId('connected')).toHaveTextContent('false');
  });

  it('clears invalid persisted wallet data', () => {
    localStorage.setItem('shiora_wallet', '{invalid-json');
    renderContext();
    expect(localStorage.getItem('shiora_wallet')).toBeNull();
    expect(screen.getByTestId('connected')).toHaveTextContent('false');
  });

  it('clears well-formed persisted data that is not a valid public-testnet wallet', () => {
    localStorage.setItem(
      'shiora_wallet',
      JSON.stringify({
        connected: true,
        address: '',
        chainId: '7332',
      }),
    );
    renderContext();
    expect(localStorage.getItem('shiora_wallet')).toBeNull();
    expect(screen.getByTestId('connected')).toHaveTextContent('false');
  });

  it('keeps restored state on a transient validation network error', async () => {
    localStorage.setItem(
      'shiora_wallet',
      JSON.stringify({
        connected: true,
        address: WALLET_ADDRESS,
        chainId: '7332',
      }),
    );
    jest.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('network unavailable'));
    renderContext();

    await waitFor(() => expect(screen.getByTestId('connected')).toHaveTextContent('true'));
  });

  it('adds and manually removes notifications', () => {
    renderContext();
    fireEvent.click(screen.getByText('Notify'));
    expect(screen.getByTestId('notification-count')).toHaveTextContent('1');
    fireEvent.click(screen.getByText('Saved'));
    expect(screen.getByTestId('notification-count')).toHaveTextContent('0');
  });

  it('safely ignores removal of a notification that has no timer', () => {
    const { result } = renderHook(() => useApp(), {
      wrapper: ({ children }) => <AppProvider>{children}</AppProvider>,
    });
    act(() => result.current.removeNotification('already-absent'));
    expect(result.current.notifications).toEqual([]);
  });

  it('expires notifications after five seconds', () => {
    jest.useFakeTimers();
    renderContext();
    fireEvent.click(screen.getByText('Notify'));
    act(() => {
      jest.advanceTimersByTime(5000);
    });
    expect(screen.getByTestId('notification-count')).toHaveTextContent('0');
    jest.useRealTimers();
  });

  it('opens global search state', () => {
    renderContext();
    fireEvent.click(screen.getByText('Search'));
    expect(screen.getByTestId('search-open')).toHaveTextContent('true');
  });
});
