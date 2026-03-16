// ============================================================
// Tests for src/app/mpc/page.tsx
// ============================================================

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppProvider } from '@/contexts/AppContext';

const mockSelectSession = jest.fn();
const mockCreateSession = jest.fn();
const mockRefetch = jest.fn();

let mockOverrides: Record<string, unknown> = {};

jest.mock('@/hooks/useMPC', () => ({
  useMPC: () => ({
    sessions: [
      {
        id: 'sess-1',
        name: 'Federated Biomarker Discovery',
        description: 'Cross-institutional biomarker analysis',
        protocol: 'federated_averaging',
        status: 'computing',
        creatorAddress: '0xcreator1',
        participants: [
          { id: 'p-1', anonymousId: 'anon-1', joinedAt: Date.now(), dataPointsContributed: 1200, roundsCompleted: 5, status: 'active' },
          { id: 'p-2', anonymousId: 'anon-2', joinedAt: Date.now(), dataPointsContributed: 800, roundsCompleted: 5, status: 'active' },
          { id: 'p-3', anonymousId: 'anon-3', joinedAt: Date.now(), dataPointsContributed: 600, roundsCompleted: 3, status: 'enrolled' },
        ],
        minParticipants: 3,
        maxParticipants: 10,
        currentRound: 5,
        totalRounds: 20,
        privacyBudgetTotal: 5.0,
        privacyBudgetRemaining: 3.2,
        createdAt: Date.now() - 86400000 * 7,
        startedAt: Date.now() - 86400000 * 5,
        attestation: '0xattestation1',
        txHash: '0xtxhash1',
      },
      {
        id: 'sess-2',
        name: 'Privacy-Preserving Drug Interaction',
        description: 'Multi-site drug interaction study',
        protocol: 'secure_sum',
        status: 'completed',
        creatorAddress: '0xcreator2',
        participants: [
          { id: 'p-4', anonymousId: 'anon-4', joinedAt: Date.now(), dataPointsContributed: 2000, roundsCompleted: 10, status: 'completed' },
          { id: 'p-5', anonymousId: 'anon-5', joinedAt: Date.now(), dataPointsContributed: 1500, roundsCompleted: 10, status: 'completed' },
        ],
        minParticipants: 2,
        maxParticipants: 5,
        currentRound: 10,
        totalRounds: 10,
        privacyBudgetTotal: 3.0,
        privacyBudgetRemaining: 0.5,
        createdAt: Date.now() - 86400000 * 30,
        startedAt: Date.now() - 86400000 * 25,
        completedAt: Date.now() - 86400000 * 10,
        attestation: '0xattestation2',
        txHash: '0xtxhash2',
      },
    ],
    results: [
      {
        id: 'res-1',
        sessionId: 'sess-2',
        query: 'Average HbA1c across cohorts',
        aggregatedResult: { mean: 5.8, stddev: 0.4, count: 3500 },
        participantCount: 2,
        roundsCompleted: 10,
        privacyBudgetUsed: 2.5,
        confidenceInterval: 95,
        noiseAdded: 0.02,
        attestation: '0xresatt1',
        commitmentHash: '0xcommit1',
        txHash: '0xrestx1',
        completedAt: Date.now() - 86400000 * 10,
      },
    ],
    datasets: [
      {
        id: 'ds-1',
        name: 'Cardiac Health Records',
        description: 'De-identified cardiac monitoring data',
        ownerAnonymousId: 'anon-owner-1',
        recordCount: 12000,
        dataTypes: ['vital_signs', 'lab_results'],
        qualityScore: 92,
        privacyLevel: 'enhanced',
        contributionReward: 150,
        participations: 3,
        createdAt: Date.now() - 86400000 * 60,
      },
      {
        id: 'ds-2',
        name: 'Genomic Variants Dataset',
        description: 'Anonymized genomic variant data',
        ownerAnonymousId: 'anon-owner-2',
        recordCount: 5000,
        dataTypes: ['genomic_data'],
        qualityScore: 88,
        privacyLevel: 'maximum',
        contributionReward: 300,
        participations: 1,
        createdAt: Date.now() - 86400000 * 30,
      },
    ],
    selectedSession: null,
    isLoadingSessions: false,
    isLoadingResults: false,
    isLoadingDatasets: false,
    isLoadingDetail: false,
    error: null,
    createSession: mockCreateSession,
    isCreating: false,
    selectSession: mockSelectSession,
    refetch: mockRefetch,
    ...mockOverrides,
  }),
}));

import MPCLabPage from '@/app/mpc/page';

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

beforeEach(() => {
  jest.clearAllMocks();
  mockOverrides = {};
});

describe('MPCLabPage', () => {
  it('renders the page heading', () => {
    render(<TestWrapper><MPCLabPage /></TestWrapper>);
    expect(screen.getByText('MPC Computation Lab')).toBeInTheDocument();
  });

  it('renders the page description', () => {
    render(<TestWrapper><MPCLabPage /></TestWrapper>);
    expect(screen.getByText(/Run privacy-preserving multi-party computations/)).toBeInTheDocument();
  });

  it('renders navigation', () => {
    render(<TestWrapper><MPCLabPage /></TestWrapper>);
    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument();
  });

  it('renders footer', () => {
    render(<TestWrapper><MPCLabPage /></TestWrapper>);
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });

  it('renders TEE badge and Network Live badge', () => {
    render(<TestWrapper><MPCLabPage /></TestWrapper>);
    expect(screen.getAllByText('Intel SGX Verified').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Network Live')).toBeInTheDocument();
  });

  it('renders tab navigation with Sessions, Create, Results, Datasets', () => {
    render(<TestWrapper><MPCLabPage /></TestWrapper>);
    expect(screen.getAllByText(/Sessions/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Create')).toBeInTheDocument();
    expect(screen.getByText('Results')).toBeInTheDocument();
    expect(screen.getByText('Datasets')).toBeInTheDocument();
  });

  // --- Sessions Tab ---

  it('renders Sessions tab by default with stat cards', () => {
    render(<TestWrapper><MPCLabPage /></TestWrapper>);
    expect(screen.getByText('Active Sessions')).toBeInTheDocument();
    expect(screen.getByText('Total Participants')).toBeInTheDocument();
    expect(screen.getByText('Avg Privacy Budget')).toBeInTheDocument();
    expect(screen.getByText('Completed Studies')).toBeInTheDocument();
  });

  it('renders MPC Sessions section heading', () => {
    render(<TestWrapper><MPCLabPage /></TestWrapper>);
    expect(screen.getByText('MPC Sessions')).toBeInTheDocument();
  });

  it('renders session cards', () => {
    render(<TestWrapper><MPCLabPage /></TestWrapper>);
    expect(screen.getByText('Federated Biomarker Discovery')).toBeInTheDocument();
    expect(screen.getByText('Privacy-Preserving Drug Interaction')).toBeInTheDocument();
  });

  it('clicks a session card to select it', () => {
    render(<TestWrapper><MPCLabPage /></TestWrapper>);
    fireEvent.click(screen.getByText('Federated Biomarker Discovery'));
    expect(mockSelectSession).toHaveBeenCalledWith('sess-1');
  });

  it('shows no sessions message when sessions is empty', () => {
    mockOverrides = { sessions: [] };
    render(<TestWrapper><MPCLabPage /></TestWrapper>);
    expect(screen.getByText('No MPC sessions found')).toBeInTheDocument();
  });

  it('shows convergence detail when a session is selected', () => {
    mockOverrides = {
      selectedSession: {
        id: 'sess-1',
        name: 'Federated Biomarker Discovery',
        currentRound: 5,
        totalRounds: 20,
        privacyBudgetTotal: 5.0,
        privacyBudgetRemaining: 3.2,
        convergence: [
          { round: 1, loss: 0.8, accuracy: 0.6, participantsActive: 3 },
          { round: 2, loss: 0.5, accuracy: 0.75, participantsActive: 3 },
          { round: 3, loss: 0.3, accuracy: 0.85, participantsActive: 3 },
        ],
      },
    };
    render(<TestWrapper><MPCLabPage /></TestWrapper>);
    expect(screen.getByText(/Convergence — Federated Biomarker Discovery/)).toBeInTheDocument();
    expect(screen.getByText('Privacy Budget (epsilon)')).toBeInTheDocument();
  });

  // --- Create Tab ---

  it('switches to Create tab and shows form elements', () => {
    render(<TestWrapper><MPCLabPage /></TestWrapper>);
    fireEvent.click(screen.getByText('Create'));
    expect(screen.getAllByText(/Create MPC Session/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Protocol')).toBeInTheDocument();
    expect(screen.getByText('Session Name')).toBeInTheDocument();
    expect(screen.getAllByText('Description').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Min Participants')).toBeInTheDocument();
    expect(screen.getByText('Max Participants')).toBeInTheDocument();
    expect(screen.getByText('Privacy Budget (epsilon)')).toBeInTheDocument();
    expect(screen.getByText('Required Data Types')).toBeInTheDocument();
  });

  it('shows protocol details panel on Create tab', () => {
    render(<TestWrapper><MPCLabPage /></TestWrapper>);
    fireEvent.click(screen.getByText('Create'));
    expect(screen.getByText('Protocol Details')).toBeInTheDocument();
    expect(screen.getByText('Budget Guide')).toBeInTheDocument();
  });

  it('shows privacy guarantees on Create tab', () => {
    render(<TestWrapper><MPCLabPage /></TestWrapper>);
    fireEvent.click(screen.getByText('Create'));
    expect(screen.getByText('Differential privacy noise injection')).toBeInTheDocument();
    expect(screen.getByText('TEE-verified computation')).toBeInTheDocument();
    expect(screen.getByText('Zero raw data exposure')).toBeInTheDocument();
  });

  it('fills in session name field', () => {
    render(<TestWrapper><MPCLabPage /></TestWrapper>);
    fireEvent.click(screen.getByText('Create'));
    const nameInput = screen.getByPlaceholderText('e.g. Federated Biomarker Discovery');
    fireEvent.change(nameInput, { target: { value: 'New Session' } });
    expect((nameInput as HTMLInputElement).value).toBe('New Session');
  });

  it('fills in description textarea', () => {
    render(<TestWrapper><MPCLabPage /></TestWrapper>);
    fireEvent.click(screen.getByText('Create'));
    const descInput = screen.getByPlaceholderText(/Describe the purpose and scope/);
    fireEvent.change(descInput, { target: { value: 'Test description' } });
    expect((descInput as HTMLTextAreaElement).value).toBe('Test description');
  });

  it('changes min participants field', () => {
    render(<TestWrapper><MPCLabPage /></TestWrapper>);
    fireEvent.click(screen.getByText('Create'));
    const inputs = screen.getAllByRole('spinbutton');
    // First number input is min, second is max
    fireEvent.change(inputs[0], { target: { value: '5' } });
    expect((inputs[0] as HTMLInputElement).value).toBe('5');
  });

  it('changes max participants field', () => {
    render(<TestWrapper><MPCLabPage /></TestWrapper>);
    fireEvent.click(screen.getByText('Create'));
    const inputs = screen.getAllByRole('spinbutton');
    fireEvent.change(inputs[1], { target: { value: '20' } });
    expect((inputs[1] as HTMLInputElement).value).toBe('20');
  });

  it('changes privacy budget slider', () => {
    render(<TestWrapper><MPCLabPage /></TestWrapper>);
    fireEvent.click(screen.getByText('Create'));
    const slider = screen.getByRole('slider');
    fireEvent.change(slider, { target: { value: '3.5' } });
    expect(screen.getByText(/3\.5/)).toBeInTheDocument();
  });

  it('toggles data type checkboxes', () => {
    render(<TestWrapper><MPCLabPage /></TestWrapper>);
    fireEvent.click(screen.getByText('Create'));
    const checkboxes = screen.getAllByRole('checkbox');
    // Toggle the first unchecked checkbox
    const uncheckedCheckbox = checkboxes.find((cb) => !(cb as HTMLInputElement).checked);
    if (uncheckedCheckbox) {
      fireEvent.click(uncheckedCheckbox);
    }
    // Toggle a checked checkbox
    const checkedCheckbox = checkboxes.find((cb) => (cb as HTMLInputElement).checked);
    if (checkedCheckbox) {
      fireEvent.click(checkedCheckbox);
    }
  });

  it('clicks Create MPC Session button', () => {
    render(<TestWrapper><MPCLabPage /></TestWrapper>);
    fireEvent.click(screen.getByText('Create'));
    const createBtn = screen.getByRole('button', { name: 'Create MPC Session' });
    fireEvent.click(createBtn);
    // Should trigger addNotification with demo mode message
  });

  // --- Results Tab ---

  it('switches to Results tab and shows results', () => {
    render(<TestWrapper><MPCLabPage /></TestWrapper>);
    fireEvent.click(screen.getByText('Results'));
    expect(screen.getByText('Computation Results')).toBeInTheDocument();
    expect(screen.getByText(/1 completed MPC results/)).toBeInTheDocument();
  });

  it('shows no results message when results is empty', () => {
    mockOverrides = { results: [] };
    render(<TestWrapper><MPCLabPage /></TestWrapper>);
    fireEvent.click(screen.getByText('Results'));
    expect(screen.getByText('No computation results yet')).toBeInTheDocument();
  });

  it('shows convergence chart on results tab when selectedSession has convergence data', () => {
    mockOverrides = {
      selectedSession: {
        id: 'sess-1',
        name: 'Federated Biomarker Discovery',
        currentRound: 5,
        totalRounds: 20,
        privacyBudgetTotal: 5.0,
        privacyBudgetRemaining: 3.2,
        convergence: [
          { round: 1, loss: 0.8, accuracy: 0.6, participantsActive: 3 },
          { round: 2, loss: 0.5, accuracy: 0.75, participantsActive: 3 },
        ],
      },
    };
    render(<TestWrapper><MPCLabPage /></TestWrapper>);
    fireEvent.click(screen.getByText('Results'));
    expect(screen.getByText('Convergence Trend')).toBeInTheDocument();
  });

  // --- Datasets Tab ---

  it('switches to Datasets tab and shows datasets', () => {
    render(<TestWrapper><MPCLabPage /></TestWrapper>);
    fireEvent.click(screen.getByText('Datasets'));
    expect(screen.getByText('Available Datasets')).toBeInTheDocument();
    expect(screen.getByText('Cardiac Health Records')).toBeInTheDocument();
    expect(screen.getByText('Genomic Variants Dataset')).toBeInTheDocument();
  });

  it('shows no datasets message when datasets is empty', () => {
    mockOverrides = { datasets: [] };
    render(<TestWrapper><MPCLabPage /></TestWrapper>);
    fireEvent.click(screen.getByText('Datasets'));
    expect(screen.getByText('No datasets available')).toBeInTheDocument();
  });

  // --- avgBudget when sessions is empty ---

  it('handles empty sessions for avgBudget calculation', () => {
    mockOverrides = { sessions: [] };
    render(<TestWrapper><MPCLabPage /></TestWrapper>);
    // Should render 0.0 for avg budget without crashing
    expect(screen.getByText('Avg Privacy Budget')).toBeInTheDocument();
  });
});
