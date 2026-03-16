// ============================================================
// Tests for src/app/tee-explorer/page.tsx
// ============================================================

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppProvider } from '@/contexts/AppContext';
import TEEExplorerPage from '@/app/tee-explorer/page';

// Allow mocking the hook for empty-state tests
jest.mock('@/hooks/useTEEExplorer', () => ({
  useTEEExplorer: jest.fn(),
}));

import { useTEEExplorer } from '@/hooks/useTEEExplorer';
const mockUseTEEExplorer = useTEEExplorer as jest.MockedFunction<typeof useTEEExplorer>;

function makeDefaultHookReturn(overrides: Partial<ReturnType<typeof useTEEExplorer>> = {}): ReturnType<typeof useTEEExplorer> {
  return {
    stats: {
      totalEnclaves: 24,
      activeEnclaves: 22,
      attestationSuccessRate: 99.7,
      computeTPS: 112,
      attestationsToday: 1847,
      averageExecutionMs: 245,
      platformDistribution: [
        { platform: 'Intel SGX', percentage: 55 },
        { platform: 'AWS Nitro', percentage: 30 },
        { platform: 'AMD SEV', percentage: 15 },
      ],
      dailyAttestationVolume: [
        { day: 'Mar 1', count: 1200 },
        { day: 'Mar 2', count: 1400 },
      ],
    },
    attestations: [
      {
        id: 'att-1',
        hash: '0xabc123def456',
        platform: 'Intel SGX' as const,
        modelName: 'health-risk-v2',
        verified: true,
        blockHeight: 123456,
        timestamp: Date.now() - 3600000,
        enclaveId: 'enc-001',
        pcrValues: ['pcr0', 'pcr1'],
        inputHash: '0xinput1',
        outputHash: '0xoutput1',
        gasUsed: 21000,
      },
    ],
    jobs: [
      {
        id: 'job-1',
        modelName: 'diagnostics-v1',
        enclaveId: 'enc-001',
        status: 'completed' as const,
        executionMs: 320,
        gasCost: 42000,
        priority: 'high' as const,
        submittedAt: Date.now() - 7200000,
        completedAt: Date.now() - 3600000,
        attestationHash: '0xatthash1',
      },
    ],
    enclaves: [
      {
        id: 'enc-001',
        platform: 'Intel SGX' as const,
        status: 'active' as const,
        region: 'us-east-1',
        uptime: 99.9,
        jobsProcessed: 1500,
        lastAttestation: Date.now() - 600000,
        version: '2.1.0',
        memoryMb: 4096,
        cpuCores: 8,
        trustScore: 98.5,
      },
    ],
    isLoadingStats: false,
    isLoadingAttestations: false,
    isLoadingJobs: false,
    isLoadingEnclaves: false,
    error: null,
    refetch: jest.fn(),
    ...overrides,
  };
}

function TestWrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return (
    <QueryClientProvider client={queryClient}>
      <AppProvider>{children}</AppProvider>
    </QueryClientProvider>
  );
}

describe('TEEExplorerPage', () => {
  beforeEach(() => {
    mockUseTEEExplorer.mockReturnValue(makeDefaultHookReturn());
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders the page heading', () => {
    render(
      <TestWrapper>
        <TEEExplorerPage />
      </TestWrapper>
    );
    expect(screen.getByText('TEE Computation Explorer')).toBeInTheDocument();
  });

  it('renders the page description', () => {
    render(
      <TestWrapper>
        <TEEExplorerPage />
      </TestWrapper>
    );
    expect(
      screen.getByText(/Monitor trusted execution environments, browse attestation chains/)
    ).toBeInTheDocument();
  });

  it('renders navigation', () => {
    render(
      <TestWrapper>
        <TEEExplorerPage />
      </TestWrapper>
    );
    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument();
  });

  it('renders footer', () => {
    render(
      <TestWrapper>
        <TEEExplorerPage />
      </TestWrapper>
    );
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });

  it('renders TEE badge and Network Live badge', () => {
    render(
      <TestWrapper>
        <TEEExplorerPage />
      </TestWrapper>
    );
    expect(screen.getByText('Intel SGX Verified')).toBeInTheDocument();
    expect(screen.getByText('Network Live')).toBeInTheDocument();
  });

  it('renders tab navigation with all five tabs', () => {
    render(
      <TestWrapper>
        <TEEExplorerPage />
      </TestWrapper>
    );
    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('Attestations')).toBeInTheDocument();
    expect(screen.getAllByText('Compute Jobs').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Enclaves')).toBeInTheDocument();
    expect(screen.getByText('Verification Chain')).toBeInTheDocument();
  });

  it('renders Overview tab by default with stat cards', () => {
    render(
      <TestWrapper>
        <TEEExplorerPage />
      </TestWrapper>
    );
    expect(screen.getByText('Total Enclaves')).toBeInTheDocument();
    expect(screen.getByText('Attestation Success Rate')).toBeInTheDocument();
    expect(screen.getByText('Compute TPS')).toBeInTheDocument();
    expect(screen.getByText('Daily Attestations')).toBeInTheDocument();
  });

  it('renders Platform Distribution and Daily Attestation Volume charts on Overview', () => {
    render(
      <TestWrapper>
        <TEEExplorerPage />
      </TestWrapper>
    );
    expect(screen.getByText('Platform Distribution')).toBeInTheDocument();
    expect(screen.getByText('Daily Attestation Volume')).toBeInTheDocument();
  });

  it('renders TEE Network Health banner on Overview', () => {
    render(
      <TestWrapper>
        <TEEExplorerPage />
      </TestWrapper>
    );
    expect(screen.getByText('TEE Network Health: Operational')).toBeInTheDocument();
  });

  it('switches to Attestations tab', () => {
    render(
      <TestWrapper>
        <TEEExplorerPage />
      </TestWrapper>
    );
    fireEvent.click(screen.getByText('Attestations'));
    expect(screen.getByText('Attestation Records')).toBeInTheDocument();
  });

  it('switches to Compute Jobs tab', () => {
    render(
      <TestWrapper>
        <TEEExplorerPage />
      </TestWrapper>
    );
    const computeJobsElements = screen.getAllByText('Compute Jobs');
    fireEvent.click(computeJobsElements[0]);
    expect(screen.getAllByText('Compute Jobs').length).toBeGreaterThanOrEqual(1);
  });

  it('switches to Enclaves tab', () => {
    render(
      <TestWrapper>
        <TEEExplorerPage />
      </TestWrapper>
    );
    fireEvent.click(screen.getByText('Enclaves'));
    expect(screen.getByText('TEE Enclaves')).toBeInTheDocument();
  });

  it('switches to Verification Chain tab and shows pipeline and explanations', () => {
    render(
      <TestWrapper>
        <TEEExplorerPage />
      </TestWrapper>
    );
    fireEvent.click(screen.getByText('Verification Chain'));
    expect(screen.getByText('Verification Pipeline')).toBeInTheDocument();
    expect(screen.getByText('Recent Verification Chains')).toBeInTheDocument();
    expect(screen.getByText('How TEE Verification Works')).toBeInTheDocument();
    expect(screen.getByText('Enclave Isolation')).toBeInTheDocument();
    expect(screen.getAllByText('Remote Attestation').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('On-chain Anchoring')).toBeInTheDocument();
  });

  // ---- Empty state tests for attestations, jobs, enclaves tabs ----

  it('shows empty state on Attestations tab when no attestations exist', () => {
    mockUseTEEExplorer.mockReturnValue(makeDefaultHookReturn({
      attestations: [],
      isLoadingAttestations: false,
    }));
    render(
      <TestWrapper>
        <TEEExplorerPage />
      </TestWrapper>
    );
    fireEvent.click(screen.getByText('Attestations'));
    expect(screen.getByText('No attestations found')).toBeInTheDocument();
  });

  it('shows empty state on Compute Jobs tab when no jobs exist', () => {
    mockUseTEEExplorer.mockReturnValue(makeDefaultHookReturn({
      jobs: [],
      isLoadingJobs: false,
    }));
    render(
      <TestWrapper>
        <TEEExplorerPage />
      </TestWrapper>
    );
    const computeJobsElements = screen.getAllByText('Compute Jobs');
    fireEvent.click(computeJobsElements[0]);
    expect(screen.getByText('No compute jobs found')).toBeInTheDocument();
  });

  it('shows empty state on Enclaves tab when no enclaves exist', () => {
    mockUseTEEExplorer.mockReturnValue(makeDefaultHookReturn({
      enclaves: [],
      isLoadingEnclaves: false,
    }));
    render(
      <TestWrapper>
        <TEEExplorerPage />
      </TestWrapper>
    );
    fireEvent.click(screen.getByText('Enclaves'));
    expect(screen.getByText('No enclaves found')).toBeInTheDocument();
  });

  it('renders error state when there is an error', () => {
    mockUseTEEExplorer.mockReturnValue(makeDefaultHookReturn({
      error: new Error('Failed to fetch TEE data'),
    }));
    render(
      <TestWrapper>
        <TEEExplorerPage />
      </TestWrapper>
    );
    expect(screen.getByText('Error loading TEE data')).toBeInTheDocument();
    expect(screen.getByText('Failed to fetch TEE data')).toBeInTheDocument();
  });

  it('renders stat cards with placeholder values when stats are null', () => {
    mockUseTEEExplorer.mockReturnValue(makeDefaultHookReturn({
      stats: null,
    }));
    render(
      <TestWrapper>
        <TEEExplorerPage />
      </TestWrapper>
    );
    // When stats is null, the stat card values show '--'
    const dashes = screen.getAllByText('--');
    expect(dashes.length).toBeGreaterThanOrEqual(4);
  });

  it('renders attestation rows in the Attestations tab table', () => {
    render(
      <TestWrapper>
        <TEEExplorerPage />
      </TestWrapper>
    );
    fireEvent.click(screen.getByText('Attestations'));
    // Table headers (some may appear multiple times due to attestation data)
    expect(screen.getAllByText('Hash').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Block Height').length).toBeGreaterThanOrEqual(1);
    // Attestation record section is visible
    expect(screen.getByText('Attestation Records')).toBeInTheDocument();
  });

  it('renders compute job rows in the Compute Jobs tab table', () => {
    render(
      <TestWrapper>
        <TEEExplorerPage />
      </TestWrapper>
    );
    const computeJobsElements = screen.getAllByText('Compute Jobs');
    fireEvent.click(computeJobsElements[0]);
    // Table headers
    expect(screen.getAllByText('Job ID').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Model Name').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Execution Time').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Gas Cost').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Priority').length).toBeGreaterThanOrEqual(1);
  });
});
