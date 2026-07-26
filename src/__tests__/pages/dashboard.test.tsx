// ============================================================
// Tests for src/app/page.tsx (Dashboard)
// ============================================================

// The dashboard reads the user's REAL data via useHealthRecords,
// and useAccessControl. Mock both with
// deterministic fixtures (populated + empty) so both the real-data render and
// the empty states are exercised; the live fetches are covered by each hook's
// own test.
const mockState = {
  records: [] as unknown[],
  grants: [] as unknown[],
  auditLog: [] as unknown[],
};
jest.mock('@/hooks/useHealthRecords', () => ({
  useHealthRecords: () => ({ records: mockState.records }),
}));
jest.mock('@/hooks/useAccessControl', () => ({
  useAccessControl: () => ({ grants: mockState.grants, auditLog: mockState.auditLog }),
}));
jest.mock('@/hooks/useNetwork', () => ({
  useNetwork: () => ({
    state: {
      blockHeight: 100000,
      tps: 1200,
      epoch: null,
      networkLoad: 65,
      aethelPrice: null,
      lastBlockTime: Date.now(),
    },
    formattedBlockHeight: '100,000',
    formattedTps: '1.2K',
    isConnected: true,
  }),
}));

import React from 'react';
import { render, screen } from '@testing-library/react';
import { AppProvider } from '@/contexts/AppContext';
import DashboardPage from '@/app/page';

function TestWrapper({ children }: { children: React.ReactNode }) {
  return <AppProvider>{children}</AppProvider>;
}

const now = Date.now();

function populate() {
  mockState.records = [
    {
      id: 'r1',
      type: 'lab_result',
      label: 'Complete Blood Count',
      date: now - 86400000,
      encrypted: true,
      size: 2048,
    },
    {
      id: 'r2',
      type: 'imaging',
      label: 'Pelvic Ultrasound',
      date: now - 2 * 86400000,
      encrypted: true,
      size: 4096,
    },
    {
      id: 'r3',
      type: 'unknown_type',
      label: 'Custom Import',
      date: now - 3 * 86400000,
      encrypted: false,
      size: 512,
    },
  ];
  mockState.grants = [
    { id: 'g1', status: 'Active' },
    { id: 'g2', status: 'Revoked' },
  ];
  mockState.auditLog = [
    {
      id: 'a1',
      provider: '0xprov1',
      action: 'Record accessed',
      timestamp: now - 3600000,
      type: 'access',
    },
    {
      id: 'a2',
      provider: '0xowner',
      action: 'Access granted',
      timestamp: now - 7200000,
      type: 'grant',
    },
    {
      id: 'a3',
      provider: '0xowner',
      action: 'Access revoked',
      timestamp: now - 9600000,
      type: 'revoke',
    },
    {
      id: 'a4',
      provider: '0xowner',
      action: 'Access modified',
      timestamp: now - 10800000,
      type: 'modify',
    },
    {
      id: 'a5',
      provider: '0xprov1',
      action: 'Data exported',
      timestamp: now - 12000000,
      type: 'download',
    },
  ];
}

function empty() {
  mockState.records = [];
  mockState.grants = [];
  mockState.auditLog = [];
}

describe('DashboardPage (populated)', () => {
  beforeEach(populate);

  it('renders the hero with honest security copy', () => {
    render(
      <TestWrapper>
        <DashboardPage />
      </TestWrapper>,
    );
    expect(screen.getByText(/Welcome back/)).toBeInTheDocument();
    expect(screen.getByText(/encrypted at rest with AES-256-GCM/)).toBeInTheDocument();
  });

  it('renders real key metrics from the mocked hooks', () => {
    render(
      <TestWrapper>
        <DashboardPage />
      </TestWrapper>,
    );
    expect(screen.getAllByText('Health Records').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Encrypted at Rest')).toBeInTheDocument();
    expect(screen.getByText('Storage Used')).toBeInTheDocument();
    expect(screen.getByText('Provider Access')).toBeInTheDocument();
    // 3 records total, 2 encrypted, 1 active grant.
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('renders real recent records incl. the unknown-type icon fallback', () => {
    render(
      <TestWrapper>
        <DashboardPage />
      </TestWrapper>,
    );
    expect(screen.getByText('Complete Blood Count')).toBeInTheDocument();
    expect(screen.getByText('Pelvic Ultrasound')).toBeInTheDocument();
    expect(screen.getByText('Custom Import')).toBeInTheDocument();
  });

  it('renders the real audit trail with all activity types', () => {
    render(
      <TestWrapper>
        <DashboardPage />
      </TestWrapper>,
    );
    expect(screen.getByText('Access Activity')).toBeInTheDocument();
    expect(screen.getByText('Record accessed')).toBeInTheDocument();
    expect(screen.getByText('Access granted')).toBeInTheDocument();
    expect(screen.getByText('Access revoked')).toBeInTheDocument();
    expect(screen.getByText('Access modified')).toBeInTheDocument();
    expect(screen.getByText('Data exported')).toBeInTheDocument();
  });

  it('renders storage breakdown from real record sizes (unknown type falls back to raw name)', () => {
    render(
      <TestWrapper>
        <DashboardPage />
      </TestWrapper>,
    );
    expect(screen.getByText('Storage Breakdown')).toBeInTheDocument();
    expect(screen.getAllByText('Lab Results').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Imaging').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('unknown_type').length).toBeGreaterThanOrEqual(1);
  });

  it('renders quick actions with honest descriptions', () => {
    render(
      <TestWrapper>
        <DashboardPage />
      </TestWrapper>,
    );
    expect(screen.getByText('AES-256-GCM encrypted at rest')).toBeInTheDocument();
    expect(screen.getByText('Granular provider permissions')).toBeInTheDocument();
    expect(screen.getByText('Import and map supported FHIR R4 resources')).toBeInTheDocument();
    expect(screen.getByText('Security, sessions, and recovery')).toBeInTheDocument();
  });

  it('contains no fabricated personal alerts, predictions, or compliance scores', () => {
    render(
      <TestWrapper>
        <DashboardPage />
      </TestWrapper>,
    );
    expect(screen.queryByText('Clinical Alerts')).not.toBeInTheDocument();
    expect(screen.queryByText(/Warfarin/)).not.toBeInTheDocument();
    expect(screen.queryByText('Digital Health Twin')).not.toBeInTheDocument();
    expect(screen.queryByText('Compliance Status')).not.toBeInTheDocument();
    expect(screen.queryByText('Health-to-Earn Rewards')).not.toBeInTheDocument();
    expect(screen.queryByText('Governance Activity')).not.toBeInTheDocument();
    expect(screen.queryByText('Marketplace Earnings')).not.toBeInTheDocument();
  });

  it('renders the production scope and footer', () => {
    render(
      <TestWrapper>
        <DashboardPage />
      </TestWrapper>,
    );
    expect(screen.getByText('Production Scope')).toBeInTheDocument();
    expect(screen.getByText(/only authenticated records/)).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });
});

describe('DashboardPage (empty / unauthenticated)', () => {
  beforeEach(empty);

  it('renders zeroed metrics and every empty state without fabricating data', () => {
    render(
      <TestWrapper>
        <DashboardPage />
      </TestWrapper>,
    );
    expect(screen.getByText('No records yet.')).toBeInTheDocument();
    expect(screen.getByText('No access activity yet.')).toBeInTheDocument();
    expect(screen.getByText('No records stored yet.')).toBeInTheDocument();
  });
});
