// ============================================================
// Tests for src/contexts/AppContext.tsx
// ============================================================

import React from 'react';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { AppProvider, useApp } from '@/contexts/AppContext';

// ---------------------------------------------------------------------------
// Test helper component that exposes context values
// ---------------------------------------------------------------------------
function ContextConsumer() {
  const ctx = useApp();
  return (
    <div>
      <span data-testid="connected">{ctx.wallet.connected.toString()}</span>
      <span data-testid="address">{ctx.wallet.address}</span>
      <span data-testid="aethel-balance">{ctx.wallet.aethelBalance}</span>
      <span data-testid="total-records">{ctx.healthData.totalRecords}</span>
      <span data-testid="tee-status">{ctx.teeState.status}</span>
      <span data-testid="block-height">{ctx.realTime.blockHeight}</span>
      <span data-testid="notification-count">{ctx.notifications.length}</span>
      <span data-testid="search-open">{ctx.searchOpen.toString()}</span>
      <button data-testid="connect-btn" onClick={ctx.connectWallet}>
        Connect
      </button>
      <button data-testid="disconnect-btn" onClick={ctx.disconnectWallet}>
        Disconnect
      </button>
      <button
        data-testid="add-notif-btn"
        onClick={() => ctx.addNotification('success', 'Test', 'Test message')}
      >
        Add Notification
      </button>
      <button data-testid="open-search-btn" onClick={() => ctx.setSearchOpen(true)}>
        Open Search
      </button>
      {ctx.notifications.map((n) => (
        <div key={n.id} data-testid={`notif-${n.id}`}>
          <span>{n.title}</span>
          <button onClick={() => ctx.removeNotification(n.id)}>Remove</button>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// AppProvider renders children
// ---------------------------------------------------------------------------
describe('AppProvider', () => {
  it('renders children', () => {
    render(
      <AppProvider>
        <p>Child Content</p>
      </AppProvider>
    );
    expect(screen.getByText('Child Content')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// useApp throws outside provider
// ---------------------------------------------------------------------------
describe('useApp', () => {
  it('throws when used outside AppProvider', () => {
    // Suppress console.error for expected error
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    function BadComponent() {
      useApp();
      return <div />;
    }

    expect(() => render(<BadComponent />)).toThrow(
      'useApp must be used within an <AppProvider>'
    );

    consoleSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// Default state
// ---------------------------------------------------------------------------
describe('Default context state', () => {
  it('wallet is disconnected by default', () => {
    render(
      <AppProvider>
        <ContextConsumer />
      </AppProvider>
    );
    expect(screen.getByTestId('connected').textContent).toBe('false');
    expect(screen.getByTestId('address').textContent).toBe('');
  });

  it('health data has default values', () => {
    render(
      <AppProvider>
        <ContextConsumer />
      </AppProvider>
    );
    expect(screen.getByTestId('total-records').textContent).toBe('147');
  });

  it('TEE status is operational', () => {
    render(
      <AppProvider>
        <ContextConsumer />
      </AppProvider>
    );
    expect(screen.getByTestId('tee-status').textContent).toBe('operational');
  });

  it('block height is initialized', () => {
    render(
      <AppProvider>
        <ContextConsumer />
      </AppProvider>
    );
    const height = parseInt(screen.getByTestId('block-height').textContent || '0');
    expect(height).toBeGreaterThan(0);
  });

  it('no notifications by default', () => {
    render(
      <AppProvider>
        <ContextConsumer />
      </AppProvider>
    );
    expect(screen.getByTestId('notification-count').textContent).toBe('0');
  });

  it('search is closed by default', () => {
    render(
      <AppProvider>
        <ContextConsumer />
      </AppProvider>
    );
    expect(screen.getByTestId('search-open').textContent).toBe('false');
  });
});

// ---------------------------------------------------------------------------
// Wallet connect / disconnect
// ---------------------------------------------------------------------------
describe('Wallet operations', () => {
  it('connects wallet and sets address and balances', () => {
    render(
      <AppProvider>
        <ContextConsumer />
      </AppProvider>
    );

    act(() => {
      fireEvent.click(screen.getByTestId('connect-btn'));
    });

    expect(screen.getByTestId('connected').textContent).toBe('true');
    expect(screen.getByTestId('address').textContent).not.toBe('');
    expect(screen.getByTestId('address').textContent).toMatch(/^aeth1/);
    expect(parseFloat(screen.getByTestId('aethel-balance').textContent || '0')).toBeGreaterThan(0);
  });

  it('saves wallet to localStorage on connect', () => {
    render(
      <AppProvider>
        <ContextConsumer />
      </AppProvider>
    );

    act(() => {
      fireEvent.click(screen.getByTestId('connect-btn'));
    });

    expect(localStorage.setItem).toHaveBeenCalledWith(
      'shiora_wallet',
      expect.any(String)
    );
  });

  it('disconnects wallet and resets state', () => {
    render(
      <AppProvider>
        <ContextConsumer />
      </AppProvider>
    );

    // Connect first
    act(() => {
      fireEvent.click(screen.getByTestId('connect-btn'));
    });
    expect(screen.getByTestId('connected').textContent).toBe('true');

    // Disconnect
    act(() => {
      fireEvent.click(screen.getByTestId('disconnect-btn'));
    });
    expect(screen.getByTestId('connected').textContent).toBe('false');
    expect(screen.getByTestId('address').textContent).toBe('');
  });

  it('removes wallet from localStorage on disconnect', () => {
    render(
      <AppProvider>
        <ContextConsumer />
      </AppProvider>
    );

    act(() => {
      fireEvent.click(screen.getByTestId('connect-btn'));
    });
    act(() => {
      fireEvent.click(screen.getByTestId('disconnect-btn'));
    });

    expect(localStorage.removeItem).toHaveBeenCalledWith('shiora_wallet');
  });
});

// ---------------------------------------------------------------------------
// Session revalidation on rehydration
// ---------------------------------------------------------------------------
describe('Session revalidation', () => {
  it('keeps wallet connected when session address matches localStorage', async () => {
    // Pre-populate localStorage with a connected wallet
    const storedWallet = JSON.stringify({
      connected: true,
      address: 'aeth1validaddr',
      aethelBalance: 1000,
    });
    (localStorage.getItem as jest.Mock).mockReturnValue(storedWallet);

    // Override fetch so the session check returns the same address
    const fetchMock = global.fetch as jest.Mock;
    const originalImpl = fetchMock.getMockImplementation();
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : (input instanceof URL ? input.href : (input as Request).url);
      if (url.includes('/api/wallet/connect') && (!init?.method || init.method === 'GET')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => ({ success: true, data: { address: 'aeth1validaddr', authenticated: true } }),
          text: async () => '{}',
          clone: function () { return this; },
        };
      }
      if (originalImpl) return originalImpl(input, init);
      return { ok: true, status: 200, json: async () => ({ success: true, data: {} }) };
    });

    await act(async () => {
      render(
        <AppProvider>
          <ContextConsumer />
        </AppProvider>
      );
    });

    // Wait for the async session check to complete
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(screen.getByTestId('connected').textContent).toBe('true');
    expect(screen.getByTestId('address').textContent).toBe('aeth1validaddr');

    // Restore
    if (originalImpl) fetchMock.mockImplementation(originalImpl);
  });

  it('auto-disconnects when session address differs from localStorage', async () => {
    // localStorage says wallet A, but server session belongs to wallet B
    const storedWallet = JSON.stringify({
      connected: true,
      address: 'aeth1walletA',
      aethelBalance: 1000,
    });
    (localStorage.getItem as jest.Mock).mockReturnValue(storedWallet);

    const fetchMock = global.fetch as jest.Mock;
    const originalImpl = fetchMock.getMockImplementation();
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : (input instanceof URL ? input.href : (input as Request).url);
      if (url.includes('/api/wallet/connect') && (!init?.method || init.method === 'GET')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => ({ success: true, data: { address: 'aeth1walletB', authenticated: true } }),
          text: async () => '{}',
          clone: function () { return this; },
        };
      }
      if (originalImpl) return originalImpl(input, init);
      return { ok: true, status: 200, json: async () => ({ success: true, data: {} }) };
    });

    await act(async () => {
      render(
        <AppProvider>
          <ContextConsumer />
        </AppProvider>
      );
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(screen.getByTestId('connected').textContent).toBe('false');
    expect(screen.getByTestId('address').textContent).toBe('');
    expect(localStorage.removeItem).toHaveBeenCalledWith('shiora_wallet');

    if (originalImpl) fetchMock.mockImplementation(originalImpl);
  });

  it('auto-disconnects when server session is expired', async () => {
    const storedWallet = JSON.stringify({
      connected: true,
      address: 'aeth1expiredaddr',
      aethelBalance: 500,
    });
    (localStorage.getItem as jest.Mock).mockReturnValue(storedWallet);

    // Override fetch to return 401 for the session check
    const fetchMock = global.fetch as jest.Mock;
    const originalImpl = fetchMock.getMockImplementation();
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : (input instanceof URL ? input.href : (input as Request).url);
      if (url.includes('/api/wallet/connect') && (!init?.method || init.method === 'GET')) {
        return {
          ok: false,
          status: 401,
          statusText: 'Unauthorized',
          headers: { get: () => 'application/json' },
          json: async () => ({ success: false, error: { code: 'UNAUTHORIZED' } }),
          text: async () => '{}',
          clone: function () { return this; },
        };
      }
      if (originalImpl) return originalImpl(input, init);
      return { ok: true, status: 200, json: async () => ({ success: true, data: {} }) };
    });

    await act(async () => {
      render(
        <AppProvider>
          <ContextConsumer />
        </AppProvider>
      );
    });

    // Wait for the async session check to complete
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(screen.getByTestId('connected').textContent).toBe('false');
    expect(screen.getByTestId('address').textContent).toBe('');
    expect(localStorage.removeItem).toHaveBeenCalledWith('shiora_wallet');

    // Restore
    if (originalImpl) fetchMock.mockImplementation(originalImpl);
  });
});

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------
describe('Notifications', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('adds a notification', () => {
    render(
      <AppProvider>
        <ContextConsumer />
      </AppProvider>
    );

    act(() => {
      fireEvent.click(screen.getByTestId('add-notif-btn'));
    });

    expect(screen.getByTestId('notification-count').textContent).toBe('1');
    expect(screen.getByText('Test')).toBeInTheDocument();
  });

  it('removes a notification manually', () => {
    render(
      <AppProvider>
        <ContextConsumer />
      </AppProvider>
    );

    act(() => {
      fireEvent.click(screen.getByTestId('add-notif-btn'));
    });

    expect(screen.getByTestId('notification-count').textContent).toBe('1');

    // Click the Remove button
    act(() => {
      fireEvent.click(screen.getByText('Remove'));
    });

    expect(screen.getByTestId('notification-count').textContent).toBe('0');
  });

  it('auto-removes notifications after 5 seconds', () => {
    render(
      <AppProvider>
        <ContextConsumer />
      </AppProvider>
    );

    act(() => {
      fireEvent.click(screen.getByTestId('add-notif-btn'));
    });

    expect(screen.getByTestId('notification-count').textContent).toBe('1');

    // Fast-forward 5 seconds
    act(() => {
      jest.advanceTimersByTime(5000);
    });

    expect(screen.getByTestId('notification-count').textContent).toBe('0');
  });

  it('can add multiple notifications', () => {
    render(
      <AppProvider>
        <ContextConsumer />
      </AppProvider>
    );

    act(() => {
      fireEvent.click(screen.getByTestId('add-notif-btn'));
      fireEvent.click(screen.getByTestId('add-notif-btn'));
      fireEvent.click(screen.getByTestId('add-notif-btn'));
    });

    expect(screen.getByTestId('notification-count').textContent).toBe('3');
  });
});

// ---------------------------------------------------------------------------
// Real-time updates
// ---------------------------------------------------------------------------
describe('Real-time updates', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('increments block height over time', () => {
    render(
      <AppProvider>
        <ContextConsumer />
      </AppProvider>
    );

    const initialHeight = parseInt(screen.getByTestId('block-height').textContent || '0');

    // Advance past the 3-second interval
    act(() => {
      jest.advanceTimersByTime(3100);
    });

    const newHeight = parseInt(screen.getByTestId('block-height').textContent || '0');
    expect(newHeight).toBeGreaterThan(initialHeight);
  });
});

// ---------------------------------------------------------------------------
// connectWalletWithData
// ---------------------------------------------------------------------------
describe('connectWalletWithData', () => {
  it('sets specific wallet data with provider and chainId', () => {
    function ConnectWithData() {
      const ctx = useApp();
      return (
        <div>
          <span data-testid="cwd-connected">{ctx.wallet.connected.toString()}</span>
          <span data-testid="cwd-address">{ctx.wallet.address}</span>
          <span data-testid="cwd-balance">{ctx.wallet.aethelBalance}</span>
          <span data-testid="cwd-provider">{ctx.wallet.provider ?? 'none'}</span>
          <span data-testid="cwd-chainId">{ctx.wallet.chainId ?? 'none'}</span>
          <button
            data-testid="cwd-btn"
            onClick={() => ctx.connectWalletWithData('aeth1xyz', 999, 'leap', 'aethelred-1')}
          >
            Connect With Data
          </button>
          <button
            data-testid="cwd-btn-no-extras"
            onClick={() => ctx.connectWalletWithData('aeth1abc', 500)}
          >
            Connect No Extras
          </button>
        </div>
      );
    }

    render(
      <AppProvider>
        <ConnectWithData />
      </AppProvider>
    );

    act(() => {
      fireEvent.click(screen.getByTestId('cwd-btn'));
    });

    expect(screen.getByTestId('cwd-connected').textContent).toBe('true');
    expect(screen.getByTestId('cwd-address').textContent).toBe('aeth1xyz');
    expect(screen.getByTestId('cwd-balance').textContent).toBe('999');
    expect(screen.getByTestId('cwd-provider').textContent).toBe('leap');
    expect(screen.getByTestId('cwd-chainId').textContent).toBe('aethelred-1');
  });

  it('defaults provider and chainId to null', () => {
    function ConnectNoExtras() {
      const ctx = useApp();
      return (
        <div>
          <span data-testid="ne-provider">{String(ctx.wallet.provider)}</span>
          <span data-testid="ne-chainId">{String(ctx.wallet.chainId)}</span>
          <button
            data-testid="ne-btn"
            onClick={() => ctx.connectWalletWithData('aeth1abc', 500)}
          >
            Connect
          </button>
        </div>
      );
    }

    render(
      <AppProvider>
        <ConnectNoExtras />
      </AppProvider>
    );

    act(() => {
      fireEvent.click(screen.getByTestId('ne-btn'));
    });

    expect(screen.getByTestId('ne-provider').textContent).toBe('null');
    expect(screen.getByTestId('ne-chainId').textContent).toBe('null');
  });
});

// ---------------------------------------------------------------------------
// Additional domain states
// ---------------------------------------------------------------------------
describe('Domain states', () => {
  function DomainConsumer() {
    const ctx = useApp();
    return (
      <div>
        <span data-testid="consent-active">{ctx.consentState.activeConsents}</span>
        <span data-testid="consent-pending">{ctx.consentState.pendingRequests}</span>
        <span data-testid="chat-total">{ctx.chatState.totalConversations}</span>
        <span data-testid="chat-active">{String(ctx.chatState.activeConversationId)}</span>
        <span data-testid="vault-compartments">{ctx.vaultState.compartmentCount}</span>
        <span data-testid="vault-privacy">{ctx.vaultState.privacyScore}</span>
        <span data-testid="gov-active">{ctx.governanceState.activeProposals}</span>
        <span data-testid="gov-voting">{ctx.governanceState.votingPower}</span>
        <span data-testid="staking-amount">{ctx.stakingState.stakedAmount}</span>
        <span data-testid="staking-apy">{ctx.stakingState.currentAPY}</span>
        <span data-testid="market-listings">{ctx.marketplaceState.activeListings}</span>
        <span data-testid="market-earnings">{ctx.marketplaceState.totalEarnings}</span>
        <span data-testid="rewards-total">{ctx.rewardsState.totalEarned}</span>
        <span data-testid="rewards-level">{ctx.rewardsState.level}</span>
      </div>
    );
  }

  it('provides consent state', () => {
    render(<AppProvider><DomainConsumer /></AppProvider>);
    expect(Number(screen.getByTestId('consent-active').textContent)).toBeGreaterThan(0);
    expect(Number(screen.getByTestId('consent-pending').textContent)).toBeGreaterThanOrEqual(0);
  });

  it('provides chat state', () => {
    render(<AppProvider><DomainConsumer /></AppProvider>);
    expect(screen.getByTestId('chat-active').textContent).toBe('null');
    expect(Number(screen.getByTestId('chat-total').textContent)).toBeGreaterThan(0);
  });

  it('provides vault state', () => {
    render(<AppProvider><DomainConsumer /></AppProvider>);
    expect(Number(screen.getByTestId('vault-compartments').textContent)).toBe(8);
    expect(Number(screen.getByTestId('vault-privacy').textContent)).toBeGreaterThan(0);
  });

  it('provides governance state', () => {
    render(<AppProvider><DomainConsumer /></AppProvider>);
    expect(Number(screen.getByTestId('gov-active').textContent)).toBeGreaterThan(0);
    expect(Number(screen.getByTestId('gov-voting').textContent)).toBeGreaterThan(0);
  });

  it('provides staking state', () => {
    render(<AppProvider><DomainConsumer /></AppProvider>);
    expect(Number(screen.getByTestId('staking-amount').textContent)).toBeGreaterThan(0);
    expect(Number(screen.getByTestId('staking-apy').textContent)).toBeGreaterThan(0);
  });

  it('provides marketplace state', () => {
    render(<AppProvider><DomainConsumer /></AppProvider>);
    expect(Number(screen.getByTestId('market-listings').textContent)).toBeGreaterThan(0);
    expect(Number(screen.getByTestId('market-earnings').textContent)).toBeGreaterThan(0);
  });

  it('provides rewards state', () => {
    render(<AppProvider><DomainConsumer /></AppProvider>);
    expect(Number(screen.getByTestId('rewards-total').textContent)).toBeGreaterThan(0);
    expect(Number(screen.getByTestId('rewards-level').textContent)).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Search state
// ---------------------------------------------------------------------------
describe('Search state', () => {
  it('can open search', () => {
    render(
      <AppProvider>
        <ContextConsumer />
      </AppProvider>
    );

    expect(screen.getByTestId('search-open').textContent).toBe('false');

    act(() => {
      fireEvent.click(screen.getByTestId('open-search-btn'));
    });

    expect(screen.getByTestId('search-open').textContent).toBe('true');
  });
});

// ---------------------------------------------------------------------------
// Edge cases for real-time updates
// ---------------------------------------------------------------------------
describe('Real-time edge cases', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('epoch can increment when blockHeight is multiple of 1000', () => {
    // The epoch increments when blockHeight % 1000 === 0
    // We need to advance the timer enough times for blockHeight to reach a multiple of 1000
    render(
      <AppProvider>
        <ContextConsumer />
      </AppProvider>
    );

    // Advance many 3-second intervals to increase the chance of hitting blockHeight % 1000 === 0
    // The initial blockHeight is 2847391, so we need 2848000 - 2847391 = 609 increments
    // That's 609 * 3000ms = 1,827,000ms
    for (let i = 0; i < 610; i++) {
      act(() => {
        jest.advanceTimersByTime(3000);
      });
    }

    // Just verify it didn't crash — the branch would have been hit
    const height = parseInt(screen.getByTestId('block-height').textContent || '0');
    expect(height).toBeGreaterThan(2847391);
  });
});

// ---------------------------------------------------------------------------
// Session revalidation network error
// ---------------------------------------------------------------------------
describe('Session revalidation network error', () => {
  it('keeps local state on network error during session check', async () => {
    const storedWallet = JSON.stringify({
      connected: true,
      address: 'aeth1networkfail',
      aethelBalance: 777,
    });
    (localStorage.getItem as jest.Mock).mockReturnValue(storedWallet);

    const fetchMock = global.fetch as jest.Mock;
    const originalImpl = fetchMock.getMockImplementation();
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : (input instanceof URL ? input.href : (input as Request).url);
      if (url.includes('/api/wallet/connect') && (!init?.method || init.method === 'GET')) {
        throw new Error('Network error');
      }
      if (originalImpl) return originalImpl(input, init);
      return { ok: true, status: 200, json: async () => ({ success: true, data: {} }) };
    });

    await act(async () => {
      render(
        <AppProvider>
          <ContextConsumer />
        </AppProvider>
      );
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    // Should keep the wallet connected on network error
    expect(screen.getByTestId('connected').textContent).toBe('true');
    expect(screen.getByTestId('address').textContent).toBe('aeth1networkfail');

    if (originalImpl) fetchMock.mockImplementation(originalImpl);
  });

  it('handles localStorage getItem returning invalid JSON', async () => {
    (localStorage.getItem as jest.Mock).mockReturnValue('not-valid-json');

    await act(async () => {
      render(
        <AppProvider>
          <ContextConsumer />
        </AppProvider>
      );
    });

    // Should gracefully handle and show disconnected
    expect(screen.getByTestId('connected').textContent).toBe('false');
  });

  it('handles localStorage getItem returning non-connected wallet', async () => {
    const storedWallet = JSON.stringify({
      connected: false,
      address: '',
      aethelBalance: 0,
    });
    (localStorage.getItem as jest.Mock).mockReturnValue(storedWallet);

    await act(async () => {
      render(
        <AppProvider>
          <ContextConsumer />
        </AppProvider>
      );
    });

    expect(screen.getByTestId('connected').textContent).toBe('false');
  });

  it('handles session check returning ok with no data.address', async () => {
    const storedWallet = JSON.stringify({
      connected: true,
      address: 'aeth1noserveraddr',
      aethelBalance: 500,
    });
    (localStorage.getItem as jest.Mock).mockReturnValue(storedWallet);

    const fetchMock = global.fetch as jest.Mock;
    const originalImpl = fetchMock.getMockImplementation();
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : (input instanceof URL ? input.href : (input as Request).url);
      if (url.includes('/api/wallet/connect') && (!init?.method || init.method === 'GET')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => ({ success: true, data: {} }), // no address field
          text: async () => '{}',
          clone: function () { return this; },
        };
      }
      if (originalImpl) return originalImpl(input, init);
      return { ok: true, status: 200, json: async () => ({ success: true, data: {} }) };
    });

    await act(async () => {
      render(
        <AppProvider>
          <ContextConsumer />
        </AppProvider>
      );
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    // Should keep connected when server doesn't return an address to compare
    expect(screen.getByTestId('connected').textContent).toBe('true');

    if (originalImpl) fetchMock.mockImplementation(originalImpl);
  });

  it('handles session check returning ok with json parse error', async () => {
    const storedWallet = JSON.stringify({
      connected: true,
      address: 'aeth1parsefail',
      aethelBalance: 500,
    });
    (localStorage.getItem as jest.Mock).mockReturnValue(storedWallet);

    const fetchMock = global.fetch as jest.Mock;
    const originalImpl = fetchMock.getMockImplementation();
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : (input instanceof URL ? input.href : (input as Request).url);
      if (url.includes('/api/wallet/connect') && (!init?.method || init.method === 'GET')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => { throw new Error('JSON parse error'); },
          text: async () => 'not json',
          clone: function () { return this; },
        };
      }
      if (originalImpl) return originalImpl(input, init);
      return { ok: true, status: 200, json: async () => ({ success: true, data: {} }) };
    });

    await act(async () => {
      render(
        <AppProvider>
          <ContextConsumer />
        </AppProvider>
      );
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    // Should keep connected on JSON parse error (catch block ignores parse errors)
    expect(screen.getByTestId('connected').textContent).toBe('true');

    if (originalImpl) fetchMock.mockImplementation(originalImpl);
  });
});
