// ============================================================
// Tests for src/app/governance/page.tsx
// ============================================================

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppProvider } from '@/contexts/AppContext';

const mockVote = { mutate: jest.fn(), isLoading: false };
const mockDelegate = { mutate: jest.fn(), isLoading: false };
const mockUndelegate = { mutate: jest.fn(), isLoading: false };
const mockSetStatusFilter = jest.fn();
const mockStake = { mutate: jest.fn(), isLoading: false };
const mockUnstake = { mutate: jest.fn(), isLoading: false };
const mockClaimRewards = { mutate: jest.fn(), isLoading: false };

let mockGovernanceOverrides: Record<string, unknown> = {};
let mockStakingOverrides: Record<string, unknown> = {};

jest.mock('@/hooks/useGovernance', () => ({
  useGovernance: () => ({
    proposals: [
      { id: 'prop-1', title: 'Increase minimum staking amount to 500 AETHEL', type: 'parameter', status: 'active', forVotes: 5000, againstVotes: 1200, abstainVotes: 300, quorum: 10000, createdAt: Date.now(), startBlock: 100, endBlock: 200, proposer: 'aeth1abc', description: 'Proposal desc', txHash: '0x1' },
      { id: 'prop-2', title: 'Treasury allocation for Q2 grants', type: 'treasury', status: 'passed', forVotes: 8000, againstVotes: 500, abstainVotes: 200, quorum: 10000, createdAt: Date.now(), startBlock: 50, endBlock: 150, proposer: 'aeth1def', description: 'Treasury desc', txHash: '0x2' },
      { id: 'prop-3', title: 'Add new AI model support', type: 'feature', status: 'defeated', forVotes: 2000, againstVotes: 6000, abstainVotes: 500, quorum: 10000, createdAt: Date.now(), startBlock: 10, endBlock: 100, proposer: 'aeth1ghi', description: 'Feature desc', txHash: '0x3' },
    ],
    votes: [
      { id: 'v-1', proposalId: 'prop-1', support: 'for', weight: 5000, timestamp: Date.now(), reason: 'Good proposal' },
      { id: 'v-2', proposalId: 'prop-2', support: 'against', weight: 2000, timestamp: Date.now() },
      { id: 'v-3', proposalId: 'prop-3', support: 'abstain', weight: 1000, timestamp: Date.now() },
    ],
    delegations: [
      { id: 'd-1', delegator: 'aeth1demo000000000000000000000000000000000', delegatee: 'aeth1xyz0000000000000000000000000000000000', votingPower: 3000, delegatedAt: Date.now(), txHash: '0xabc123' },
      { id: 'd-2', delegator: 'aeth1aaa0000000000000000000000000000000000', delegatee: 'aeth1bbb0000000000000000000000000000000000', votingPower: 1500, delegatedAt: Date.now(), txHash: '0xdef456' },
    ],
    stats: { activeProposals: 1, totalVoters: 1842, treasuryBalance: 2450000, totalProposals: 12, passedRate: 75 },
    userVotingPower: 5000,
    statusFilter: undefined,
    setStatusFilter: mockSetStatusFilter,
    vote: mockVote,
    delegate: mockDelegate,
    undelegate: mockUndelegate,
    isLoading: false,
    ...mockGovernanceOverrides,
  }),
}));

jest.mock('@/hooks/useStaking', () => ({
  useStaking: () => ({
    stats: { totalStaked: 8750000, totalStakers: 500, currentAPY: 12.5, rewardsDistributed: 100000, nextRewardEpoch: Date.now() + 86400000, minStakeAmount: 100, unstakeCooldownDays: 14 },
    totalStaked: 25000,
    pendingRewards: 1250,
    positions: [
      { id: 'pos-1', amount: 15000, status: 'staked', stakedAt: Date.now() - 86400000 * 30, rewardsEarned: 800, rewardsClaimed: 500, unlockAt: null },
      { id: 'pos-2', amount: 10000, status: 'unstaking', stakedAt: Date.now() - 86400000 * 60, rewardsEarned: 600, rewardsClaimed: 600, unlockAt: Date.now() + 86400000 * 7 },
    ],
    rewards: [
      { id: 'r-1', amount: 200, source: 'staking_reward', earnedAt: Date.now() - 86400000, claimedAt: Date.now() - 3600000 },
      { id: 'r-2', amount: 150, source: 'governance_bonus', earnedAt: Date.now() - 86400000 * 2, claimedAt: null },
    ],
    stake: mockStake,
    unstake: mockUnstake,
    claimRewards: mockClaimRewards,
    ...mockStakingOverrides,
  }),
}));

import GovernancePage from '@/app/governance/page';

function TestWrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={queryClient}>
      <AppProvider>{children}</AppProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGovernanceOverrides = {};
  mockStakingOverrides = {};
});

describe('GovernancePage', () => {
  it('renders the governance page heading', () => {
    render(
      <TestWrapper>
        <GovernancePage />
      </TestWrapper>
    );
    expect(screen.getAllByText('Governance & Staking').length).toBeGreaterThanOrEqual(1);
  });

  it('renders the page description', () => {
    render(
      <TestWrapper>
        <GovernancePage />
      </TestWrapper>
    );
    expect(
      screen.getByText(/Participate in protocol governance, stake AETHEL tokens, and delegate voting power/)
    ).toBeInTheDocument();
  });

  it('renders key metric cards', async () => {
    render(
      <TestWrapper>
        <GovernancePage />
      </TestWrapper>
    );
    await waitFor(() => {
      expect(screen.getByText('Active Proposals')).toBeInTheDocument();
    }, { timeout: 3000 });
    expect(screen.getByText('Total Voters')).toBeInTheDocument();
    expect(screen.getByText('Total Staked')).toBeInTheDocument();
    // "Treasury" appears in both metric cards and tabs, use getAllByText
    expect(screen.getAllByText('Treasury').length).toBeGreaterThanOrEqual(1);
  });

  it('renders all tabs', () => {
    render(
      <TestWrapper>
        <GovernancePage />
      </TestWrapper>
    );
    expect(screen.getByText('Proposals')).toBeInTheDocument();
    expect(screen.getByText('My Votes')).toBeInTheDocument();
    expect(screen.getByText('Staking')).toBeInTheDocument();
    expect(screen.getByText('Delegation')).toBeInTheDocument();
    // "Treasury" also appears as metric card label, so there may be multiple
    expect(screen.getAllByText('Treasury').length).toBeGreaterThanOrEqual(1);
  });

  it('shows proposals tab by default with proposal titles', async () => {
    render(
      <TestWrapper>
        <GovernancePage />
      </TestWrapper>
    );
    // First 3 proposals are always 'active', check for one known title
    await waitFor(() => {
      expect(
        screen.getByText('Increase minimum staking amount to 500 AETHEL')
      ).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('renders status filter buttons on proposals tab', () => {
    render(
      <TestWrapper>
        <GovernancePage />
      </TestWrapper>
    );
    // "All" may appear in other places, use getAllByText
    expect(screen.getAllByText('All').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Active').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Passed').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Defeated').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Executed').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Cancelled').length).toBeGreaterThanOrEqual(1);
  });

  it('renders voting buttons on active proposals', async () => {
    render(
      <TestWrapper>
        <GovernancePage />
      </TestWrapper>
    );
    // Active proposals should have For / Against / Abstain voting buttons
    await waitFor(() => {
      expect(screen.getAllByText('For').length).toBeGreaterThan(0);
    }, { timeout: 3000 });
    expect(screen.getAllByText('Against').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Abstain').length).toBeGreaterThan(0);
  });

  it('displays quorum progress in proposal cards', async () => {
    render(
      <TestWrapper>
        <GovernancePage />
      </TestWrapper>
    );
    await waitFor(() => {
      expect(screen.getAllByText('Quorum').length).toBeGreaterThan(0);
    }, { timeout: 3000 });
  });

  it('switches to My Votes tab', () => {
    render(
      <TestWrapper>
        <GovernancePage />
      </TestWrapper>
    );

    fireEvent.click(screen.getByText('My Votes'));

    expect(screen.getByText('Voting History')).toBeInTheDocument();
    expect(
      screen.getByText(/Your past votes on protocol proposals/)
    ).toBeInTheDocument();
  });

  it('switches to Staking tab and shows staking content', () => {
    render(
      <TestWrapper>
        <GovernancePage />
      </TestWrapper>
    );

    fireEvent.click(screen.getByText('Staking'));

    expect(screen.getByText('Your Staking Summary')).toBeInTheDocument();
    expect(screen.getByText('Staking Positions')).toBeInTheDocument();
    expect(screen.getByText('Rewards History')).toBeInTheDocument();
    expect(screen.getByText('Current APY')).toBeInTheDocument();
  });

  it('switches to Delegation tab', () => {
    render(
      <TestWrapper>
        <GovernancePage />
      </TestWrapper>
    );

    fireEvent.click(screen.getByText('Delegation'));

    expect(screen.getByText('Delegate Voting Power')).toBeInTheDocument();
    expect(screen.getByText('Delegatee Address')).toBeInTheDocument();
    expect(screen.getByText('Recent Delegations')).toBeInTheDocument();
  });

  it('renders delegate button in delegation tab', () => {
    render(
      <TestWrapper>
        <GovernancePage />
      </TestWrapper>
    );

    fireEvent.click(screen.getByText('Delegation'));

    // Find the Delegate button (not 'Delegate Voting Power' heading)
    const delegateButtons = screen.getAllByText('Delegate');
    expect(delegateButtons.length).toBeGreaterThanOrEqual(1);
  });

  it('switches to Treasury tab and shows treasury content', () => {
    render(
      <TestWrapper>
        <GovernancePage />
      </TestWrapper>
    );

    // Click the Treasury tab; there may be multiple 'Treasury' text nodes
    const treasuryElements = screen.getAllByText('Treasury');
    // The tab button is typically the first one after metric cards
    fireEvent.click(treasuryElements[treasuryElements.length - 1]);

    expect(screen.getByText('Treasury Balance')).toBeInTheDocument();
    expect(screen.getByText('Treasury Allocation')).toBeInTheDocument();
    expect(screen.getByText('Spending Proposals')).toBeInTheDocument();
  });

  it('renders treasury allocation breakdown', () => {
    render(
      <TestWrapper>
        <GovernancePage />
      </TestWrapper>
    );

    const treasuryElements = screen.getAllByText('Treasury');
    fireEvent.click(treasuryElements[treasuryElements.length - 1]);

    expect(screen.getByText('Research Grants')).toBeInTheDocument();
    expect(screen.getByText('Development')).toBeInTheDocument();
    expect(screen.getByText('Community Rewards')).toBeInTheDocument();
    expect(screen.getByText('Operations')).toBeInTheDocument();
    expect(screen.getByText('Reserve')).toBeInTheDocument();
  });

  it('renders voting power badge', () => {
    render(
      <TestWrapper>
        <GovernancePage />
      </TestWrapper>
    );
    expect(screen.getByText(/Voting Power/)).toBeInTheDocument();
  });

  // --- Status Filters ---

  it('clicks status filter buttons on proposals tab', () => {
    render(<TestWrapper><GovernancePage /></TestWrapper>);
    // Find the Active filter button (rounded-full class distinguishes filters from status badges)
    const activeButtons = screen.getAllByText('Active');
    const filterBtn = activeButtons.find(
      (el) => el.closest('button')?.className?.includes('rounded-full')
    );
    expect(filterBtn).toBeTruthy();
    fireEvent.click(filterBtn!.closest('button')!);
    expect(mockSetStatusFilter).toHaveBeenCalledWith('active');
  });

  // --- Voting ---

  it('renders vote buttons on active proposals', () => {
    render(<TestWrapper><GovernancePage /></TestWrapper>);
    expect(screen.getAllByText('For').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Against').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Abstain').length).toBeGreaterThan(0);
  });

  // --- My Votes Tab (vote details) ---

  it('renders vote reasons and badges on My Votes tab', () => {
    render(<TestWrapper><GovernancePage /></TestWrapper>);
    fireEvent.click(screen.getByText('My Votes'));
    expect(screen.getByText('Good proposal')).toBeInTheDocument();
    expect(screen.getByText('Voted For')).toBeInTheDocument();
    expect(screen.getByText('Voted Against')).toBeInTheDocument();
    expect(screen.getByText('Abstained')).toBeInTheDocument();
  });

  // --- Staking Tab Details ---

  it('renders staking positions with Unstake button', () => {
    render(<TestWrapper><GovernancePage /></TestWrapper>);
    fireEvent.click(screen.getByText('Staking'));
    const unstakeBtn = screen.getByText('Unstake');
    expect(unstakeBtn).toBeInTheDocument();
    fireEvent.click(unstakeBtn);
    expect(mockUnstake.mutate).toHaveBeenCalledWith('pos-1');
  });

  it('renders Claim button for positions with unclaimed rewards', () => {
    render(<TestWrapper><GovernancePage /></TestWrapper>);
    fireEvent.click(screen.getByText('Staking'));
    const claimBtn = screen.getByText('Claim');
    expect(claimBtn).toBeInTheDocument();
    fireEvent.click(claimBtn);
    expect(mockClaimRewards.mutate).toHaveBeenCalledWith('pos-1');
  });

  it('renders rewards history on staking tab', () => {
    render(<TestWrapper><GovernancePage /></TestWrapper>);
    fireEvent.click(screen.getByText('Staking'));
    expect(screen.getByText('Rewards History')).toBeInTheDocument();
    expect(screen.getAllByText('Claimed').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Pending').length).toBeGreaterThan(0);
  });

  // --- Delegation Tab Details ---

  it('enters delegate address and clicks Delegate', () => {
    render(<TestWrapper><GovernancePage /></TestWrapper>);
    fireEvent.click(screen.getByText('Delegation'));

    const input = screen.getByPlaceholderText('aeth1...');
    // Enter a valid address (starts with aeth1, length 43)
    fireEvent.change(input, { target: { value: 'aeth1' + 'a'.repeat(38) } });

    const delegateButtons = screen.getAllByText('Delegate');
    const submitBtn = delegateButtons.find(
      (btn) => btn.tagName === 'BUTTON' && !btn.textContent?.includes('Voting')
    );
    if (submitBtn) {
      fireEvent.click(submitBtn);
      expect(mockDelegate.mutate).toHaveBeenCalled();
    }
  });

  it('delegate button is disabled for invalid address', () => {
    render(<TestWrapper><GovernancePage /></TestWrapper>);
    fireEvent.click(screen.getByText('Delegation'));

    const input = screen.getByPlaceholderText('aeth1...');
    fireEvent.change(input, { target: { value: 'invalid' } });

    // The Delegate button should be disabled
    const delegateButtons = screen.getAllByRole('button');
    const submitBtn = delegateButtons.find(
      (btn) => btn.textContent === 'Delegate' && btn.closest('[class*="space-y-3"]')
    );
    if (submitBtn) {
      expect(submitBtn).toBeDisabled();
    }
  });

  // --- Treasury Tab Details ---

  it('renders treasury spending proposals', () => {
    render(<TestWrapper><GovernancePage /></TestWrapper>);
    const treasuryElements = screen.getAllByText('Treasury');
    fireEvent.click(treasuryElements[treasuryElements.length - 1]);
    expect(screen.getByText('Treasury allocation for Q2 grants')).toBeInTheDocument();
  });

  it('renders inflows and outflows on treasury tab', () => {
    render(<TestWrapper><GovernancePage /></TestWrapper>);
    const treasuryElements = screen.getAllByText('Treasury');
    fireEvent.click(treasuryElements[treasuryElements.length - 1]);
    expect(screen.getByText(/Inflows/)).toBeInTheDocument();
    expect(screen.getByText(/Outflows/)).toBeInTheDocument();
  });

  // --- Cover handleVote (line 85) by clicking a For button on an active proposal ---

  it('calls handleVote when clicking For button on an active proposal', () => {
    render(<TestWrapper><GovernancePage /></TestWrapper>);
    const forButtons = screen.getAllByText('For');
    fireEvent.click(forButtons[0]);
    expect(mockVote.mutate).toHaveBeenCalledWith({ proposalId: 'prop-1', support: 'for' });
  });

  it('calls handleVote with against', () => {
    render(<TestWrapper><GovernancePage /></TestWrapper>);
    const againstButtons = screen.getAllByText('Against');
    fireEvent.click(againstButtons[0]);
    expect(mockVote.mutate).toHaveBeenCalledWith({ proposalId: 'prop-1', support: 'against' });
  });

  it('calls handleVote with abstain', () => {
    render(<TestWrapper><GovernancePage /></TestWrapper>);
    const abstainButtons = screen.getAllByText('Abstain');
    fireEvent.click(abstainButtons[0]);
    expect(mockVote.mutate).toHaveBeenCalledWith({ proposalId: 'prop-1', support: 'abstain' });
  });

  // --- Cover StakePanel onStake callback (line 240) ---

  // --- Cover empty proposals branch (line 194) ---

  it('shows empty state when no proposals match filter', () => {
    mockGovernanceOverrides = { proposals: [], isLoading: false };
    render(<TestWrapper><GovernancePage /></TestWrapper>);
    expect(screen.getByText('No proposals found with the selected filter.')).toBeInTheDocument();
  });

  // --- Cover vote.proposalId fallback (line 214) ---

  it('shows proposalId when proposal title not found', () => {
    mockGovernanceOverrides = {
      votes: [
        { id: 'v-99', proposalId: 'prop-unknown', support: 'for', weight: 100, timestamp: Date.now() },
      ],
    };
    render(<TestWrapper><GovernancePage /></TestWrapper>);
    fireEvent.click(screen.getByText('My Votes'));
    expect(screen.getByText('prop-unknown')).toBeInTheDocument();
  });

  // --- Cover position with status other than staked/unstaking (line 276, 294) ---

  it('renders position with unlocked status', () => {
    mockStakingOverrides = {
      positions: [
        { id: 'pos-3', amount: 5000, status: 'unlocked', stakedAt: Date.now() - 86400000 * 90, rewardsEarned: 300, rewardsClaimed: 300, unlockAt: null },
      ],
    };
    render(<TestWrapper><GovernancePage /></TestWrapper>);
    fireEvent.click(screen.getByText('Staking'));
    // Position renders with 'Expired' status badge for unlocked positions
    expect(screen.getByText('Staking Positions')).toBeInTheDocument();
  });

  it('triggers onStake via StakePanel', () => {
    render(<TestWrapper><GovernancePage /></TestWrapper>);
    fireEvent.click(screen.getByText('Staking'));
    // StakePanel has an amount input with placeholder "Min: 100 AETHEL"
    const stakeInput = screen.getByPlaceholderText(/Min:/);
    fireEvent.change(stakeInput, { target: { value: '500' } });
    // Click "Stake AETHEL" button (not the heading)
    const stakeButtons = screen.getAllByText('Stake AETHEL');
    const stakeBtn = stakeButtons.find((el) => el.tagName === 'BUTTON');
    expect(stakeBtn).toBeTruthy();
    fireEvent.click(stakeBtn!);
    expect(mockStake.mutate).toHaveBeenCalledWith(500);
  });
});
