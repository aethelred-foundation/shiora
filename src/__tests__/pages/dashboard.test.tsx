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
      </TestWrapper>
    );
    // "Shiora on Aethelred" appears in TopNav and hero; verify at least one
    expect(screen.getAllByText('Shiora on Aethelred').length).toBeGreaterThanOrEqual(1);
  });

  it('renders the hero section with welcome message', () => {
    render(
      <TestWrapper>
        <DashboardPage />
      </TestWrapper>
    );
    expect(screen.getByText(/Welcome back/)).toBeInTheDocument();
  });

  it('renders key metric cards', () => {
    render(
      <TestWrapper>
        <DashboardPage />
      </TestWrapper>
    );
    // These labels may appear in multiple places (metric cards + nav links)
    expect(screen.getAllByText('Health Records').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Encrypted at Rest').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Storage Used').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Provider Access').length).toBeGreaterThanOrEqual(1);
  });

  it('renders metric values', () => {
    render(
      <TestWrapper>
        <DashboardPage />
      </TestWrapper>
    );
    // Health records count is 147 (appears on Total + Encrypted-at-Rest cards)
    expect(screen.getAllByText('147').length).toBeGreaterThanOrEqual(1);
    // Provider access count is 3 — may appear in multiple places
    expect(screen.getAllByText('3').length).toBeGreaterThanOrEqual(1);
  });

  it('renders quick action cards', () => {
    render(
      <TestWrapper>
        <DashboardPage />
      </TestWrapper>
    );
    expect(screen.getByText('Upload Health Data')).toBeInTheDocument();
    expect(screen.getByText('Cycle Predictions')).toBeInTheDocument();
    expect(screen.getByText('Manage Access')).toBeInTheDocument();
  });

  it('renders quick actions with correct descriptions', () => {
    render(
      <TestWrapper>
        <DashboardPage />
      </TestWrapper>
    );
    expect(screen.getByText('AES-256-GCM encrypted at rest')).toBeInTheDocument();
    expect(screen.getByText('Statistical analysis of your data')).toBeInTheDocument();
    expect(screen.getByText('Granular provider permissions')).toBeInTheDocument();
    expect(screen.getByText('Verifier tooling (simulated)')).toBeInTheDocument();
  });

  it('renders chart sections (mocked)', () => {
    render(
      <TestWrapper>
        <DashboardPage />
      </TestWrapper>
    );
    expect(screen.getByText('Cycle Temperature Tracking')).toBeInTheDocument();
    expect(screen.getByText('Storage Breakdown')).toBeInTheDocument();
  });

  it('renders recent records section', () => {
    render(
      <TestWrapper>
        <DashboardPage />
      </TestWrapper>
    );
    expect(screen.getByText('Recent Records')).toBeInTheDocument();
    // Check "View All" link
    expect(screen.getByText('View All')).toBeInTheDocument();
  });

  it('renders access activity section', () => {
    render(
      <TestWrapper>
        <DashboardPage />
      </TestWrapper>
    );
    expect(screen.getByText('Access Activity')).toBeInTheDocument();
    expect(screen.getByText('Manage')).toBeInTheDocument();
  });

  it('renders View Records and AI Insights action buttons', () => {
    render(
      <TestWrapper>
        <DashboardPage />
      </TestWrapper>
    );
    expect(screen.getByText('View Records')).toBeInTheDocument();
    // "AI Insights" may appear in nav and hero
    expect(screen.getAllByText('AI Insights').length).toBeGreaterThanOrEqual(1);
  });

  it('renders navigation and footer', () => {
    render(
      <TestWrapper>
        <DashboardPage />
      </TestWrapper>
    );
    // TopNav renders navigation
    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument();
    // Footer renders
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });
});
