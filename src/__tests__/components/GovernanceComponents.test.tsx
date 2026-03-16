// ============================================================
// Tests for src/components/governance/GovernanceComponents.tsx
// ============================================================

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppProvider } from '@/contexts/AppContext';
import {
  ProposalCard,
  VotingBar,
  DelegationPanel,
  ProposalTimeline,
  QuorumMeter,
} from '@/components/governance/GovernanceComponents';
import type { Proposal, Delegation } from '@/types';

function TestWrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return React.createElement(QueryClientProvider, { client: qc },
    React.createElement(AppProvider, null, children));
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const mockActiveProposal: Proposal = {
  id: 'prop-1',
  proposer: 'aeth1proposer0000000000000000000000000001',
  type: 'feature',
  title: 'Enable Genomics Data Sharing',
  description: 'Allow users to share genomic data with research institutions.',
  forVotes: 75000,
  againstVotes: 15000,
  abstainVotes: 5000,
  quorum: 100000,
  status: 'active',
  createdAt: Date.now() - 86400000 * 3,
  endsAt: Date.now() + 86400000 * 4,
  txHash: '0xtx123abc',
};

const mockPassedProposal: Proposal = {
  ...mockActiveProposal,
  id: 'prop-2',
  title: 'Reduce Governance Threshold',
  status: 'passed',
};

const mockDefeatedProposal: Proposal = {
  ...mockActiveProposal,
  id: 'prop-3',
  status: 'defeated',
  title: 'Increase Staking Rewards',
};

const mockDelegations: Delegation[] = [
  {
    id: 'del-1',
    delegator: 'aeth1user0000000000000000000000000000001',
    delegatee: 'aeth1delegate000000000000000000000000001',
    votingPower: 5000,
    delegatedAt: Date.now() - 86400000,
    txHash: '0xtx456def',
  },
  {
    id: 'del-2',
    delegator: 'aeth1user0000000000000000000000000000002',
    delegatee: 'aeth1delegate000000000000000000000000002',
    votingPower: 3000,
    delegatedAt: Date.now() - 172800000,
    txHash: '0xtx789ghi',
  },
];

// ---------------------------------------------------------------------------
// ProposalCard
// ---------------------------------------------------------------------------

describe('ProposalCard', () => {
  it('renders proposal title and description', () => {
    render(
      <TestWrapper>
        <ProposalCard proposal={mockActiveProposal} />
      </TestWrapper>
    );
    expect(screen.getByText('Enable Genomics Data Sharing')).toBeInTheDocument();
    expect(screen.getByText(/Allow users to share genomic data/)).toBeInTheDocument();
  });

  it('renders proposal type badge', () => {
    render(
      <TestWrapper>
        <ProposalCard proposal={mockActiveProposal} />
      </TestWrapper>
    );
    expect(screen.getByText('Feature Proposal')).toBeInTheDocument();
  });

  it('renders status badge', () => {
    render(
      <TestWrapper>
        <ProposalCard proposal={mockActiveProposal} />
      </TestWrapper>
    );
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('renders quorum progress', () => {
    render(
      <TestWrapper>
        <ProposalCard proposal={mockActiveProposal} />
      </TestWrapper>
    );
    expect(screen.getByText('Quorum')).toBeInTheDocument();
  });

  it('shows voting buttons for active proposal with onVote', () => {
    render(
      <TestWrapper>
        <ProposalCard proposal={mockActiveProposal} onVote={jest.fn()} />
      </TestWrapper>
    );
    expect(screen.getByText('For')).toBeInTheDocument();
    expect(screen.getByText('Against')).toBeInTheDocument();
    expect(screen.getByText('Abstain')).toBeInTheDocument();
  });

  it('calls onVote with correct args when For clicked', () => {
    const onVote = jest.fn();
    render(
      <TestWrapper>
        <ProposalCard proposal={mockActiveProposal} onVote={onVote} />
      </TestWrapper>
    );
    fireEvent.click(screen.getByText('For'));
    expect(onVote).toHaveBeenCalledWith('prop-1', 'for');
  });

  it('calls onVote with against when Against clicked', () => {
    const onVote = jest.fn();
    render(
      <TestWrapper>
        <ProposalCard proposal={mockActiveProposal} onVote={onVote} />
      </TestWrapper>
    );
    fireEvent.click(screen.getByText('Against'));
    expect(onVote).toHaveBeenCalledWith('prop-1', 'against');
  });

  it('calls onVote with abstain when Abstain clicked', () => {
    const onVote = jest.fn();
    render(
      <TestWrapper>
        <ProposalCard proposal={mockActiveProposal} onVote={onVote} />
      </TestWrapper>
    );
    fireEvent.click(screen.getByText('Abstain'));
    expect(onVote).toHaveBeenCalledWith('prop-1', 'abstain');
  });

  it('does not show voting buttons for passed proposal', () => {
    render(
      <TestWrapper>
        <ProposalCard proposal={mockPassedProposal} onVote={jest.fn()} />
      </TestWrapper>
    );
    expect(screen.queryByText('For')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// VotingBar
// ---------------------------------------------------------------------------

describe('VotingBar', () => {
  it('renders vote percentages', () => {
    render(
      <TestWrapper>
        <VotingBar forVotes={75000} againstVotes={15000} abstainVotes={5000} />
      </TestWrapper>
    );
    // 75000/95000 = ~78.9% for
    expect(screen.getByText(/For/)).toBeInTheDocument();
    expect(screen.getByText(/Against/)).toBeInTheDocument();
    expect(screen.getByText(/Abstain/)).toBeInTheDocument();
  });

  it('renders no votes state', () => {
    render(
      <TestWrapper>
        <VotingBar forVotes={0} againstVotes={0} abstainVotes={0} />
      </TestWrapper>
    );
    expect(screen.getByText('No votes yet')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// DelegationPanel
// ---------------------------------------------------------------------------

describe('DelegationPanel', () => {
  it('renders Delegation heading', () => {
    render(
      <TestWrapper>
        <DelegationPanel
          delegations={mockDelegations}
          userVotingPower={10000}
        />
      </TestWrapper>
    );
    expect(screen.getByText('Delegation')).toBeInTheDocument();
  });

  it('renders user voting power badge', () => {
    render(
      <TestWrapper>
        <DelegationPanel
          delegations={mockDelegations}
          userVotingPower={10000}
        />
      </TestWrapper>
    );
    // formatNumber uses K abbreviation; text may be split across child nodes
    expect(screen.getByText(/10\.0K/)).toBeInTheDocument();
  });

  it('shows no active delegation message when user has not delegated', () => {
    render(
      <TestWrapper>
        <DelegationPanel
          delegations={mockDelegations}
          userVotingPower={5000}
        />
      </TestWrapper>
    );
    expect(screen.getByText(/No active delegation/)).toBeInTheDocument();
  });

  it('renders Recent Delegations section', () => {
    render(
      <TestWrapper>
        <DelegationPanel
          delegations={mockDelegations}
          userVotingPower={5000}
        />
      </TestWrapper>
    );
    expect(screen.getByText('Recent Delegations')).toBeInTheDocument();
  });

  it('renders delegation entries', () => {
    render(
      <TestWrapper>
        <DelegationPanel
          delegations={mockDelegations}
          userVotingPower={5000}
        />
      </TestWrapper>
    );
    // formatNumber abbreviates thousands — 5000 -> 5.0K
    expect(screen.getAllByText(/5\.0K/).length).toBeGreaterThan(0);
  });

  it('renders active delegation when a delegation matches the demo address', () => {
    const delegationsWithDemo: Delegation[] = [
      ...mockDelegations,
      {
        id: 'del-demo',
        delegator: 'aeth1demo000000000000000000000000000000000',
        delegatee: 'aeth1delegate000000000000000000000000001',
        votingPower: 8000,
        delegatedAt: Date.now() - 86400000,
        txHash: '0xtxdemo',
      },
    ];
    render(
      <TestWrapper>
        <DelegationPanel
          delegations={delegationsWithDemo}
          userVotingPower={8000}
          onUndelegate={jest.fn()}
        />
      </TestWrapper>
    );
    expect(screen.getByText('Delegated to')).toBeInTheDocument();
    expect(screen.getByText('Undelegate')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// ProposalTimeline
// ---------------------------------------------------------------------------

describe('ProposalTimeline', () => {
  it('renders timeline steps', () => {
    render(
      <TestWrapper>
        <ProposalTimeline proposal={mockActiveProposal} />
      </TestWrapper>
    );
    expect(screen.getByText('Created')).toBeInTheDocument();
    expect(screen.getByText('Voting')).toBeInTheDocument();
    expect(screen.getByText('Executed')).toBeInTheDocument();
  });

  it('renders Defeated label for defeated proposal', () => {
    render(
      <TestWrapper>
        <ProposalTimeline proposal={mockDefeatedProposal} />
      </TestWrapper>
    );
    expect(screen.getByText('Defeated')).toBeInTheDocument();
  });

  it('renders Passed label for passed proposal', () => {
    render(
      <TestWrapper>
        <ProposalTimeline proposal={mockPassedProposal} />
      </TestWrapper>
    );
    // Passed proposals show 'Passed' as the outcome step label
    expect(screen.getByText('Passed')).toBeInTheDocument();
  });

  it('renders Cancelled label for cancelled proposal', () => {
    const cancelledProposal: Proposal = {
      ...mockActiveProposal,
      id: 'prop-cancelled',
      status: 'cancelled',
      title: 'Cancelled Proposal',
    };
    render(
      <TestWrapper>
        <ProposalTimeline proposal={cancelledProposal} />
      </TestWrapper>
    );
    expect(screen.getByText('Cancelled')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// QuorumMeter
// ---------------------------------------------------------------------------

describe('QuorumMeter', () => {
  it('renders quorum progress label when not reached', () => {
    render(
      <TestWrapper>
        <QuorumMeter currentVotes={50000} quorum={100000} />
      </TestWrapper>
    );
    expect(screen.getByText('Quorum Progress')).toBeInTheDocument();
  });

  it('renders quorum reached label when met', () => {
    render(
      <TestWrapper>
        <QuorumMeter currentVotes={100000} quorum={100000} />
      </TestWrapper>
    );
    expect(screen.getByText('Quorum Reached')).toBeInTheDocument();
  });

  it('renders vote counts', () => {
    render(
      <TestWrapper>
        <QuorumMeter currentVotes={50000} quorum={100000} />
      </TestWrapper>
    );
    // formatNumber uses K abbreviation for thousands
    expect(screen.getByText(/50\.0K/)).toBeInTheDocument();
    expect(screen.getByText(/100\.0K/)).toBeInTheDocument();
  });

  it('renders percentage', () => {
    render(
      <TestWrapper>
        <QuorumMeter currentVotes={50000} quorum={100000} />
      </TestWrapper>
    );
    expect(screen.getByText('50%')).toBeInTheDocument();
  });
});
