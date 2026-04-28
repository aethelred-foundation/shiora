// ============================================================
// Tests for src/app/page.tsx (Dashboard)
// ============================================================

import React from 'react';
import { render, screen } from '@testing-library/react';
import { AppProvider } from '@/contexts/AppContext';
import DashboardPage from '@/app/page';

function TestWrapper({ children }: { children: React.ReactNode }) {
  return <AppProvider>{children}</AppProvider>;
}

describe('DashboardPage', () => {
  it('renders the dashboard page', () => {
    render(
      <TestWrapper>
        <DashboardPage />
      </TestWrapper>,
    );
    // "Shiora on Aethelred" appears in TopNav and hero; verify at least one
    expect(screen.getAllByText('Shiora on Aethelred').length).toBeGreaterThanOrEqual(1);
  });

  it('renders the hero section with welcome message', () => {
    render(
      <TestWrapper>
        <DashboardPage />
      </TestWrapper>,
    );
    expect(screen.getByText(/Welcome back/)).toBeInTheDocument();
  });

  it('renders key metric cards', () => {
    render(
      <TestWrapper>
        <DashboardPage />
      </TestWrapper>,
    );
    // These labels may appear in multiple places (metric cards + nav links)
    expect(screen.getAllByText('Health Records').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('AI Inferences').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('TEE Attestations').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Provider Access').length).toBeGreaterThanOrEqual(1);
  });

  it('renders metric values', () => {
    render(
      <TestWrapper>
        <DashboardPage />
      </TestWrapper>,
    );
    // Health records count is 147
    expect(screen.getByText('147')).toBeInTheDocument();
    // Provider access count is 3 — may appear in multiple places
    expect(screen.getAllByText('3').length).toBeGreaterThanOrEqual(1);
  });

  it('renders quick action cards', () => {
    render(
      <TestWrapper>
        <DashboardPage />
      </TestWrapper>,
    );
    expect(screen.getByText('Upload Health Data')).toBeInTheDocument();
    expect(screen.getByText('Cycle Predictions')).toBeInTheDocument();
    expect(screen.getByText('Manage Access')).toBeInTheDocument();
  });

  it('renders quick actions with correct descriptions', () => {
    render(
      <TestWrapper>
        <DashboardPage />
      </TestWrapper>,
    );
    expect(screen.getByText('AES-256 encrypted, IPFS-pinned')).toBeInTheDocument();
    expect(screen.getByText('TEE-verified AI analysis')).toBeInTheDocument();
    expect(screen.getByText('Granular provider permissions')).toBeInTheDocument();
    expect(screen.getByText('Explore enclave attestations')).toBeInTheDocument();
  });

  it('renders chart sections (mocked)', () => {
    render(
      <TestWrapper>
        <DashboardPage />
      </TestWrapper>,
    );
    expect(screen.getByText('Cycle Temperature Tracking')).toBeInTheDocument();
    expect(screen.getByText('Storage Breakdown')).toBeInTheDocument();
    expect(screen.getByText('Network Activity')).toBeInTheDocument();
  });

  it('renders TEE status card', () => {
    render(
      <TestWrapper>
        <DashboardPage />
      </TestWrapper>,
    );
    expect(screen.getByText('TEE Status')).toBeInTheDocument();
    // "Platform" may appear multiple times (TEE status card + quick actions area)
    expect(screen.getAllByText('Platform').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Enclave Uptime').length).toBeGreaterThanOrEqual(1);
  });

  it('renders recent records section', () => {
    render(
      <TestWrapper>
        <DashboardPage />
      </TestWrapper>,
    );
    expect(screen.getByText('Recent Records')).toBeInTheDocument();
    // Check "View All" link
    expect(screen.getByText('View All')).toBeInTheDocument();
  });

  it('renders access activity section', () => {
    render(
      <TestWrapper>
        <DashboardPage />
      </TestWrapper>,
    );
    expect(screen.getByText('Access Activity')).toBeInTheDocument();
    expect(screen.getByText('Manage')).toBeInTheDocument();
  });

  it('renders AI Models section', () => {
    render(
      <TestWrapper>
        <DashboardPage />
      </TestWrapper>,
    );
    expect(screen.getAllByText('AI Models').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Cycle LSTM')).toBeInTheDocument();
    expect(screen.getByText('Anomaly Detector')).toBeInTheDocument();
    expect(screen.getByText('Fertility XGBoost')).toBeInTheDocument();
    expect(screen.getByText('Health Transformer')).toBeInTheDocument();
  });

  it('renders the bottom network bar with real-time data', () => {
    render(
      <TestWrapper>
        <DashboardPage />
      </TestWrapper>,
    );
    // "Block", "TPS", etc. may appear in multiple places
    expect(screen.getAllByText('Block').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('TPS').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Epoch').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('$AETHEL').length).toBeGreaterThanOrEqual(1);
  });

  it('renders View Records and AI Insights action buttons', () => {
    render(
      <TestWrapper>
        <DashboardPage />
      </TestWrapper>,
    );
    expect(screen.getByText('View Records')).toBeInTheDocument();
    // "AI Insights" may appear in nav and hero
    expect(screen.getAllByText('AI Insights').length).toBeGreaterThanOrEqual(1);
  });

  it('renders navigation and footer', () => {
    render(
      <TestWrapper>
        <DashboardPage />
      </TestWrapper>,
    );
    // TopNav renders navigation
    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument();
    // Footer renders
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });
});
