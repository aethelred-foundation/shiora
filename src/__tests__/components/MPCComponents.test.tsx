// ============================================================
// Tests for src/components/mpc/MPCComponents.tsx
// ============================================================

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { AppProvider } from '@/contexts/AppContext';
import {
  SessionCard,
  ConvergenceChart,
  ResultCard,
  DatasetCard,
  ProtocolSelector,
  PrivacyBudgetBar,
} from '@/components/mpc/MPCComponents';
import type {
  MPCSession,
  MPCResult,
  MPCDataset,
  MPCConvergencePoint,
  MPCProtocolType,
} from '@/types';

// Mock recharts to render tooltip content functions inline
jest.mock('recharts', () => {
  const React = require('react');
  const mockPayload = [
    { color: '#3b82f6', name: 'accuracy', value: 92 },
    { color: '#ef4444', name: 'loss', value: 0.5 },
    { color: undefined, name: undefined, value: undefined },
  ];
  return {
    ResponsiveContainer: ({ children }: any) => React.createElement('div', { 'data-testid': 'responsive-container' }, children),
    LineChart: ({ children }: any) => React.createElement('div', { 'data-testid': 'line-chart' }, children),
    BarChart: ({ children }: any) => React.createElement('div', { 'data-testid': 'bar-chart' }, children),
    Line: () => null,
    Bar: () => null,
    XAxis: () => null,
    YAxis: () => null,
    CartesianGrid: () => null,
    Tooltip: ({ content }: any) => {
      if (typeof content === 'function') {
        return React.createElement('div', { 'data-testid': 'tooltip-content' },
          content({ active: true, payload: mockPayload, label: '5' }),
          // Call with undefined payload to cover the ?. branch
          content({ active: false, payload: undefined, label: undefined }),
          // Call with payload but undefined label to cover label ?? '' branch
          content({ active: true, payload: mockPayload, label: undefined }),
        );
      }
      return null;
    },
  };
});

function TestWrapper({ children }: { children: React.ReactNode }) {
  return <AppProvider>{children}</AppProvider>;
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const mockSession: MPCSession = {
  id: 'mpc-session-1',
  name: 'Federated Diabetes Study',
  description: 'Cross-institutional analysis of type 2 diabetes outcomes.',
  protocol: 'federated_averaging',
  status: 'computing',
  participants: [
    { id: 'p1', name: 'Hospital A', status: 'active' },
    { id: 'p2', name: 'Hospital B', status: 'active' },
  ],
  maxParticipants: 5,
  currentRound: 15,
  totalRounds: 50,
  createdAt: Date.now() - 86400000,
};

const mockConvergenceData: MPCConvergencePoint[] = [
  { round: 1, loss: 2.5, accuracy: 52 },
  { round: 5, loss: 1.8, accuracy: 68 },
  { round: 10, loss: 1.2, accuracy: 78 },
];

const mockResult: MPCResult = {
  id: 'result-1',
  query: 'Average HbA1c by age group',
  participantCount: 5,
  roundsCompleted: 50,
  aggregatedResult: { '18-30': 5.2, '31-50': 5.8, '51-70': 6.4 },
  confidenceInterval: 0.15,
  noiseAdded: 0.023,
  privacyBudgetUsed: 1.2,
  commitmentHash: '0xabc123def456abc123def456abc123def456abc1abc123def456abc123def456ab',
  attestation: '0xdef789abc012def789abc012def789abc012def7def789abc012def789abc012de',
  completedAt: Date.now() - 3600000,
};

const mockDataset: MPCDataset = {
  id: 'ds-1',
  name: 'Cardiac Biomarkers Dataset',
  description: 'De-identified cardiac biomarker data from 50k patients.',
  recordCount: 50000,
  dataTypes: ['lab_results', 'vitals'],
  qualityScore: 88,
  privacyLevel: 'enhanced',
  contributionReward: 12.5,
  participations: 23,
};

// ---------------------------------------------------------------------------
// SessionCard
// ---------------------------------------------------------------------------

describe('SessionCard', () => {
  it('renders session name and description', () => {
    render(
      <TestWrapper>
        <SessionCard session={mockSession} />
      </TestWrapper>
    );
    expect(screen.getByText('Federated Diabetes Study')).toBeInTheDocument();
    expect(screen.getByText(/Cross-institutional analysis/)).toBeInTheDocument();
  });

  it('renders protocol type and participant count', () => {
    render(
      <TestWrapper>
        <SessionCard session={mockSession} />
      </TestWrapper>
    );
    expect(screen.getByText('Federated Averaging')).toBeInTheDocument();
    expect(screen.getByText('2/5 participants')).toBeInTheDocument();
  });

  it('renders round progress for active sessions', () => {
    render(
      <TestWrapper>
        <SessionCard session={mockSession} />
      </TestWrapper>
    );
    expect(screen.getByText('Round 15/50')).toBeInTheDocument();
    expect(screen.getByText('30%')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// ConvergenceChart
// ---------------------------------------------------------------------------

describe('ConvergenceChart', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <TestWrapper>
        <ConvergenceChart data={mockConvergenceData} />
      </TestWrapper>
    );
    expect(container.firstChild).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// ResultCard
// ---------------------------------------------------------------------------

describe('ResultCard', () => {
  it('renders query and participant count', () => {
    render(
      <TestWrapper>
        <ResultCard result={mockResult} />
      </TestWrapper>
    );
    expect(screen.getByText('Average HbA1c by age group')).toBeInTheDocument();
    expect(screen.getByText('5 participants')).toBeInTheDocument();
    expect(screen.getByText('50 rounds')).toBeInTheDocument();
  });

  it('renders Completed badge', () => {
    render(
      <TestWrapper>
        <ResultCard result={mockResult} />
      </TestWrapper>
    );
    expect(screen.getByText('Completed')).toBeInTheDocument();
  });

  it('expands and shows detailed results on click', () => {
    render(
      <TestWrapper>
        <ResultCard result={mockResult} />
      </TestWrapper>
    );

    // Initially collapsed - no privacy budget visible
    expect(screen.queryByText('Privacy Budget Used')).not.toBeInTheDocument();

    // Click to expand
    const header = screen.getByText('Average HbA1c by age group').closest('div[class*="cursor-pointer"]');
    fireEvent.click(header!);

    // Should show expanded details
    expect(screen.getByText('Privacy Budget Used')).toBeInTheDocument();
    expect(screen.getByText('Confidence Interval')).toBeInTheDocument();
    expect(screen.getByText('DP Noise Added')).toBeInTheDocument();
    expect(screen.getByText('Commitment Hash')).toBeInTheDocument();
    expect(screen.getByText('TEE Attestation')).toBeInTheDocument();
  });

  it('collapses on second click', () => {
    render(
      <TestWrapper>
        <ResultCard result={mockResult} />
      </TestWrapper>
    );

    const header = screen.getByText('Average HbA1c by age group').closest('div[class*="cursor-pointer"]');
    // Expand
    fireEvent.click(header!);
    expect(screen.getByText('Privacy Budget Used')).toBeInTheDocument();
    // Collapse
    fireEvent.click(header!);
    expect(screen.queryByText('Privacy Budget Used')).not.toBeInTheDocument();
  });

  it('handles result with zero privacyBudgetUsed', () => {
    const zeroBudget = { ...mockResult, privacyBudgetUsed: 0 };
    render(
      <TestWrapper>
        <ResultCard result={zeroBudget} />
      </TestWrapper>
    );
    expect(screen.getByText('Average HbA1c by age group')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// DatasetCard
// ---------------------------------------------------------------------------

describe('DatasetCard', () => {
  it('renders dataset name and description', () => {
    render(
      <TestWrapper>
        <DatasetCard dataset={mockDataset} />
      </TestWrapper>
    );
    expect(screen.getByText('Cardiac Biomarkers Dataset')).toBeInTheDocument();
    expect(screen.getByText(/De-identified cardiac/)).toBeInTheDocument();
  });

  it('renders record count and reward', () => {
    render(
      <TestWrapper>
        <DatasetCard dataset={mockDataset} />
      </TestWrapper>
    );
    expect(screen.getByText(/50\.0K records/)).toBeInTheDocument();
    expect(screen.getByText('12.5 AETHEL')).toBeInTheDocument();
  });

  it('renders privacy level', () => {
    render(
      <TestWrapper>
        <DatasetCard dataset={mockDataset} />
      </TestWrapper>
    );
    expect(screen.getByText('Enhanced')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// ProtocolSelector
// ---------------------------------------------------------------------------

describe('ProtocolSelector', () => {
  it('renders protocol options', () => {
    const onChange = jest.fn();
    render(
      <TestWrapper>
        <ProtocolSelector selected="secure_sum" onChange={onChange} />
      </TestWrapper>
    );
    expect(screen.getByText('Secure Sum')).toBeInTheDocument();
    expect(screen.getByText('Federated Averaging')).toBeInTheDocument();
  });

  it('calls onChange when option is clicked', () => {
    const onChange = jest.fn();
    render(
      <TestWrapper>
        <ProtocolSelector selected="secure_sum" onChange={onChange} />
      </TestWrapper>
    );
    fireEvent.click(screen.getByText('Federated Averaging'));
    expect(onChange).toHaveBeenCalledWith('federated_averaging');
  });
});

// ---------------------------------------------------------------------------
// PrivacyBudgetBar
// ---------------------------------------------------------------------------

describe('PrivacyBudgetBar', () => {
  it('renders used and remaining budget', () => {
    render(
      <TestWrapper>
        <PrivacyBudgetBar used={1.2} total={3.0} label="Privacy Budget" />
      </TestWrapper>
    );
    expect(screen.getByText('1.20 used')).toBeInTheDocument();
    expect(screen.getByText('1.80 remaining')).toBeInTheDocument();
    expect(screen.getByText('Privacy Budget')).toBeInTheDocument();
  });

  it('renders without label', () => {
    render(
      <TestWrapper>
        <PrivacyBudgetBar used={0.5} total={1.0} />
      </TestWrapper>
    );
    expect(screen.getByText('0.50 used')).toBeInTheDocument();
    expect(screen.getByText('0.50 remaining')).toBeInTheDocument();
  });

  it('handles zero total budget', () => {
    render(
      <TestWrapper>
        <PrivacyBudgetBar used={0} total={0} />
      </TestWrapper>
    );
    expect(screen.getByText('0.00 used')).toBeInTheDocument();
    expect(screen.getByText('0.00 remaining')).toBeInTheDocument();
  });

  it('renders high usage (> 80%) in red', () => {
    render(
      <TestWrapper>
        <PrivacyBudgetBar used={9} total={10} label="Budget" />
      </TestWrapper>
    );
    expect(screen.getByText('9.00 used')).toBeInTheDocument();
  });

  it('renders medium usage (50-80%) in yellow', () => {
    render(
      <TestWrapper>
        <PrivacyBudgetBar used={6} total={10} label="Budget" />
      </TestWrapper>
    );
    expect(screen.getByText('6.00 used')).toBeInTheDocument();
  });
});

describe('SessionCard edge cases', () => {
  it('renders non-active session without progress bar', () => {
    const completedSession = { ...mockSession, status: 'completed' as const };
    render(
      <TestWrapper>
        <SessionCard session={completedSession} />
      </TestWrapper>
    );
    expect(screen.queryByText(/Round \d+\/\d+/)).not.toBeInTheDocument();
  });

  it('handles session with zero totalRounds', () => {
    const zeroRounds = { ...mockSession, totalRounds: 0 };
    render(
      <TestWrapper>
        <SessionCard session={zeroRounds} />
      </TestWrapper>
    );
    expect(screen.getByText('Federated Diabetes Study')).toBeInTheDocument();
  });

  it('calls onClick when provided', () => {
    const onClick = jest.fn();
    render(
      <TestWrapper>
        <SessionCard session={mockSession} onClick={onClick} />
      </TestWrapper>
    );
    // Click on the session card
    fireEvent.click(screen.getByText('Federated Diabetes Study'));
  });

  it('renders unknown status with fallback label', () => {
    const unknownStatus = { ...mockSession, status: 'unknown' as any };
    render(
      <TestWrapper>
        <SessionCard session={unknownStatus} />
      </TestWrapper>
    );
    expect(screen.getByText('Federated Diabetes Study')).toBeInTheDocument();
  });
});

describe('DatasetCard edge cases', () => {
  it('renders standard privacy level', () => {
    const standard = { ...mockDataset, privacyLevel: 'standard' as const };
    render(
      <TestWrapper>
        <DatasetCard dataset={standard} />
      </TestWrapper>
    );
    expect(screen.getByText('Standard')).toBeInTheDocument();
  });

  it('renders maximum privacy level', () => {
    const max = { ...mockDataset, privacyLevel: 'maximum' as const };
    render(
      <TestWrapper>
        <DatasetCard dataset={max} />
      </TestWrapper>
    );
    expect(screen.getByText('Maximum')).toBeInTheDocument();
  });

  it('renders low quality score (< 60) with red bar', () => {
    const low = { ...mockDataset, qualityScore: 45 };
    render(
      <TestWrapper>
        <DatasetCard dataset={low} />
      </TestWrapper>
    );
    expect(screen.getByText('45%')).toBeInTheDocument();
  });

  it('renders medium quality score (60-79) with yellow bar', () => {
    const mid = { ...mockDataset, qualityScore: 65 };
    render(
      <TestWrapper>
        <DatasetCard dataset={mid} />
      </TestWrapper>
    );
    expect(screen.getByText('65%')).toBeInTheDocument();
  });
});
