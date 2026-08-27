import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import SettingsPage from '@/app/settings/page';
import { AppProvider } from '@/contexts/AppContext';
import { I18nProvider } from '@/contexts/I18nContext';

const reconnect = jest.fn();
let mockNetworkHealth: 'healthy' | 'degraded' | 'critical' | 'unavailable' = 'healthy';
let mockNetworkTps: number | null = 12.5;
let mockFormattedTps = '12.5';

jest.mock('@/hooks/useNetwork', () => ({
  useNetwork: () => ({
    state: {
      blockHeight: 100_000,
      tps: mockNetworkTps,
      epoch: null,
      networkLoad: 40,
      aethelPrice: null,
      lastBlockTime: 1_700_000_000_000,
    },
    health: mockNetworkHealth,
    formattedBlockHeight: '100,000',
    formattedTps: mockFormattedTps,
    formattedLoad: '40%',
    reconnect,
  }),
}));

function TestWrapper({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider initialLocale="en">
      <AppProvider>{children}</AppProvider>
    </I18nProvider>
  );
}

describe('SettingsPage', () => {
  beforeEach(() => {
    reconnect.mockClear();
    mockNetworkHealth = 'healthy';
    mockNetworkTps = 12.5;
    mockFormattedTps = '12.5';
    localStorage.clear();
    jest.restoreAllMocks();
  });

  it('renders the production account and security heading', () => {
    render(
      <TestWrapper>
        <SettingsPage />
      </TestWrapper>,
    );

    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByText(/authenticated wallet session/)).toBeInTheDocument();
    expect(screen.getByLabelText('Language')).toBeInTheDocument();
  });

  it('shows an unavailable wallet state without inventing an address', () => {
    render(
      <TestWrapper>
        <SettingsPage />
      </TestWrapper>,
    );

    expect(screen.getByText('Disconnected')).toBeInTheDocument();
    expect(screen.getAllByText('Unavailable').length).toBeGreaterThan(0);
    expect(
      screen.getByText(
        (_, element) =>
          element?.tagName === 'P' && element.textContent?.includes('Use Connect Wallet') === true,
      ),
    ).toBeInTheDocument();
  });

  it('disconnects an authenticated wallet and confirms the local action', async () => {
    localStorage.setItem(
      'shiora_wallet',
      JSON.stringify({
        connected: true,
        address: '0x0000000000000000000000000000000000000001',
        provider: 'aethelred',
        chainId: '7332',
      }),
    );
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        data: { address: '0x0000000000000000000000000000000000000001' },
      }),
    } as Response);

    render(
      <TestWrapper>
        <SettingsPage />
      </TestWrapper>,
    );

    const disconnect = await screen.findByRole('button', { name: 'Disconnect wallet' });
    fireEvent.click(disconnect);

    await waitFor(() => expect(localStorage.getItem('shiora_wallet')).toBeNull());
    expect(screen.getByText('Wallet disconnected')).toBeInTheDocument();
  });

  it('shows the pinned public-testnet configuration', () => {
    render(
      <TestWrapper>
        <SettingsPage />
      </TestWrapper>,
    );

    expect(screen.getByText('Aethelred Public Testnet')).toBeInTheDocument();
    expect(screen.getByText('7332')).toBeInTheDocument();
  });

  it('renders live network telemetry and refreshes it', () => {
    render(
      <TestWrapper>
        <SettingsPage />
      </TestWrapper>,
    );

    expect(screen.getAllByText('100,000').length).toBeGreaterThan(0);
    expect(screen.getAllByText('12.5 TPS').length).toBeGreaterThan(0);
    expect(screen.getAllByText('40%').length).toBeGreaterThan(0);

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Refresh telemetry',
      }),
    );
    expect(reconnect).toHaveBeenCalledTimes(1);
  });

  it.each(['degraded', 'critical', 'unavailable'] as const)(
    'renders the %s network health state',
    (health) => {
      mockNetworkHealth = health;
      render(
        <TestWrapper>
          <SettingsPage />
        </TestWrapper>,
      );
      expect(screen.getByText(health)).toBeInTheDocument();
    },
  );

  it('renders unavailable throughput without a unit suffix', () => {
    mockNetworkTps = null;
    mockFormattedTps = 'Unavailable';
    render(
      <TestWrapper>
        <SettingsPage />
      </TestWrapper>,
    );
    expect(screen.getAllByText('Unavailable').length).toBeGreaterThan(0);
    expect(screen.queryByText('Unavailable TPS')).not.toBeInTheDocument();
  });

  it('links only to production-backed data pages', () => {
    render(
      <TestWrapper>
        <SettingsPage />
      </TestWrapper>,
    );

    expect(screen.getByText('Health records').closest('a')).toHaveAttribute('href', '/records');
    expect(screen.getByText('Provider access').closest('a')).toHaveAttribute('href', '/access');
    expect(screen.getByText('FHIR bridge').closest('a')).toHaveAttribute('href', '/fhir');
  });

  it('exposes real operational endpoints', () => {
    render(
      <TestWrapper>
        <SettingsPage />
      </TestWrapper>,
    );

    expect(screen.getByText('Readiness').closest('a')).toHaveAttribute('href', '/api/health/ready');
    expect(screen.getByText('Service status').closest('a')).toHaveAttribute(
      'href',
      '/api/system/status',
    );
    expect(screen.getByText('API schema').closest('a')).toHaveAttribute('href', '/api/openapi');
    expect(screen.getByText('Security contact').closest('a')).toHaveAttribute(
      'href',
      '/.well-known/security.txt',
    );
  });

  it('renders the main navigation and footer', () => {
    render(
      <TestWrapper>
        <SettingsPage />
      </TestWrapper>,
    );

    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });
});
