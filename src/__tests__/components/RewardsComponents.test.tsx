// ============================================================
// Tests for src/components/rewards/RewardsComponents.tsx
// ============================================================

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppProvider } from '@/contexts/AppContext';
import {
  RewardCard,
  EarnChart,
  StreakIndicator,
  MilestoneProgress,
  RewardsSummary,
} from '@/components/rewards/RewardsComponents';
import type { RewardEntry, RewardStreak, RewardStats } from '@/types';

function TestWrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return React.createElement(QueryClientProvider, { client: qc },
    React.createElement(AppProvider, null, children));
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const mockReward: RewardEntry = {
  id: 'reward-1',
  action: 'data_upload',
  description: 'Earned reward for uploading health record',
  amount: 5,
  currency: 'AETHEL',
  earnedAt: Date.now() - 3600000,
};

const mockClaimedReward: RewardEntry = {
  ...mockReward,
  id: 'reward-2',
  action: 'wearable_sync',
  description: 'Earned reward for syncing wearable',
  amount: 2,
  claimedAt: Date.now() - 1800000,
  txHash: '0xabc123',
};

const mockStreak: RewardStreak = {
  action: 'data_upload',
  currentStreak: 14,
  longestStreak: 30,
  lastActionAt: Date.now() - 86400000,
  nextMilestone: 15,
  multiplier: 1.5,
};

const mockStreakNoMultiplier: RewardStreak = {
  ...mockStreak,
  action: 'health_checkup',
  currentStreak: 3,
  longestStreak: 5,
  multiplier: 1.0,
};

const mockStats: RewardStats = {
  totalEarned: 350,
  totalClaimed: 300,
  pendingRewards: 50,
  activeStreaks: 3,
  rank: 42,
  level: 5,
  nextLevelThreshold: 500,
};

const mockEarnData = Array.from({ length: 30 }, (_, i) => ({
  day: `Day ${i + 1}`,
  earned: Math.floor(Math.random() * 20),
}));

// ---------------------------------------------------------------------------
// RewardCard
// ---------------------------------------------------------------------------

describe('RewardCard', () => {
  it('renders reward description and amount', () => {
    render(
      <TestWrapper>
        <RewardCard reward={mockReward} />
      </TestWrapper>
    );
    expect(screen.getByText('Earned reward for uploading health record')).toBeInTheDocument();
    expect(screen.getByText('+5')).toBeInTheDocument();
    expect(screen.getByText('AETHEL')).toBeInTheDocument();
  });

  it('renders action label from REWARD_ACTIONS constants', () => {
    render(
      <TestWrapper>
        <RewardCard reward={mockReward} />
      </TestWrapper>
    );
    expect(screen.getByText('Upload Health Record')).toBeInTheDocument();
  });

  it('shows Claimed badge when reward is claimed', () => {
    render(
      <TestWrapper>
        <RewardCard reward={mockClaimedReward} />
      </TestWrapper>
    );
    expect(screen.getByText('Claimed')).toBeInTheDocument();
  });

  it('does not show Claimed badge when reward is unclaimed', () => {
    render(
      <TestWrapper>
        <RewardCard reward={mockReward} />
      </TestWrapper>
    );
    expect(screen.queryByText('Claimed')).not.toBeInTheDocument();
  });

  it('renders Claim button for unclaimed rewards with onClaim handler', () => {
    const onClaim = jest.fn();
    render(
      <TestWrapper>
        <RewardCard reward={mockReward} onClaim={onClaim} />
      </TestWrapper>
    );
    expect(screen.getByText('Claim')).toBeInTheDocument();
  });

  it('calls onClaim with reward id when Claim is clicked', () => {
    const onClaim = jest.fn();
    render(
      <TestWrapper>
        <RewardCard reward={mockReward} onClaim={onClaim} />
      </TestWrapper>
    );
    fireEvent.click(screen.getByText('Claim'));
    expect(onClaim).toHaveBeenCalledWith('reward-1');
  });

  it('shows loading state when isClaimLoading is true', () => {
    render(
      <TestWrapper>
        <RewardCard reward={mockReward} onClaim={jest.fn()} isClaimLoading={true} />
      </TestWrapper>
    );
    expect(screen.getByText('Claiming...')).toBeInTheDocument();
  });

  it('does not render Claim button for already claimed reward', () => {
    render(
      <TestWrapper>
        <RewardCard reward={mockClaimedReward} onClaim={jest.fn()} />
      </TestWrapper>
    );
    expect(screen.queryByText('Claim')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// EarnChart
// ---------------------------------------------------------------------------

describe('EarnChart', () => {
  it('renders Daily Earnings heading', () => {
    render(
      <TestWrapper>
        <EarnChart data={mockEarnData} />
      </TestWrapper>
    );
    expect(screen.getByText('Daily Earnings')).toBeInTheDocument();
  });

  it('renders Last 30 days label', () => {
    render(
      <TestWrapper>
        <EarnChart data={mockEarnData} />
      </TestWrapper>
    );
    expect(screen.getByText('Last 30 days')).toBeInTheDocument();
  });

  it('renders without crashing with empty data', () => {
    const { container } = render(
      <TestWrapper>
        <EarnChart data={[]} />
      </TestWrapper>
    );
    expect(container.firstChild).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// StreakIndicator
// ---------------------------------------------------------------------------

describe('StreakIndicator', () => {
  it('renders action label from constants', () => {
    render(
      <TestWrapper>
        <StreakIndicator streak={mockStreak} />
      </TestWrapper>
    );
    expect(screen.getByText('Upload Health Record')).toBeInTheDocument();
  });

  it('renders current streak and longest streak', () => {
    render(
      <TestWrapper>
        <StreakIndicator streak={mockStreak} />
      </TestWrapper>
    );
    expect(screen.getByText('14')).toBeInTheDocument();
    expect(screen.getByText('Longest: 30 days')).toBeInTheDocument();
  });

  it('renders multiplier badge when multiplier > 1', () => {
    render(
      <TestWrapper>
        <StreakIndicator streak={mockStreak} />
      </TestWrapper>
    );
    expect(screen.getByText('1.5x')).toBeInTheDocument();
  });

  it('does not render multiplier badge when multiplier is 1', () => {
    render(
      <TestWrapper>
        <StreakIndicator streak={mockStreakNoMultiplier} />
      </TestWrapper>
    );
    expect(screen.queryByText('1.0x')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// MilestoneProgress
// ---------------------------------------------------------------------------

describe('MilestoneProgress', () => {
  it('renders Level Progress heading', () => {
    render(
      <TestWrapper>
        <MilestoneProgress stats={mockStats} />
      </TestWrapper>
    );
    expect(screen.getByText('Level Progress')).toBeInTheDocument();
  });

  it('renders current level badge', () => {
    render(
      <TestWrapper>
        <MilestoneProgress stats={mockStats} />
      </TestWrapper>
    );
    expect(screen.getByText('Level 5')).toBeInTheDocument();
  });

  it('renders earned and threshold amounts', () => {
    render(
      <TestWrapper>
        <MilestoneProgress stats={mockStats} />
      </TestWrapper>
    );
    expect(screen.getByText('350 AETHEL earned')).toBeInTheDocument();
    expect(screen.getByText('500 AETHEL')).toBeInTheDocument();
  });

  it('renders remaining AETHEL to next level', () => {
    render(
      <TestWrapper>
        <MilestoneProgress stats={mockStats} />
      </TestWrapper>
    );
    expect(screen.getByText('150 AETHEL to Level 6')).toBeInTheDocument();
  });

  it('renders Level up! when threshold is reached', () => {
    const maxedStats: RewardStats = { ...mockStats, totalEarned: 500, nextLevelThreshold: 500 };
    render(
      <TestWrapper>
        <MilestoneProgress stats={maxedStats} />
      </TestWrapper>
    );
    expect(screen.getByText('Level up!')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// RewardsSummary
// ---------------------------------------------------------------------------

describe('RewardsSummary', () => {
  it('renders Rewards Summary heading', () => {
    render(
      <TestWrapper>
        <RewardsSummary stats={mockStats} streakCount={3} />
      </TestWrapper>
    );
    expect(screen.getByText('Rewards Summary')).toBeInTheDocument();
  });

  it('renders total earned value', () => {
    render(
      <TestWrapper>
        <RewardsSummary stats={mockStats} streakCount={3} />
      </TestWrapper>
    );
    expect(screen.getByText('Total Earned')).toBeInTheDocument();
    expect(screen.getByText('350')).toBeInTheDocument();
  });

  it('renders pending rewards', () => {
    render(
      <TestWrapper>
        <RewardsSummary stats={mockStats} streakCount={3} />
      </TestWrapper>
    );
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByText('50')).toBeInTheDocument();
  });

  it('renders active streaks count', () => {
    render(
      <TestWrapper>
        <RewardsSummary stats={mockStats} streakCount={3} />
      </TestWrapper>
    );
    expect(screen.getByText('Active Streaks')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('renders level and rank', () => {
    render(
      <TestWrapper>
        <RewardsSummary stats={mockStats} streakCount={3} />
      </TestWrapper>
    );
    expect(screen.getByText('Level')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('Rank #42')).toBeInTheDocument();
  });
});
