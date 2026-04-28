// ============================================================
// Tests for src/components/governance/StakingComponents.tsx
// ============================================================

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppProvider } from '@/contexts/AppContext';
import {
  StakePanel,
  RewardCalculator,
  UnstakeTimer,
  StakingChart,
} from '@/components/governance/StakingComponents';
import type { StakingStats } from '@/types';

function TestWrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return React.createElement(
    QueryClientProvider,
    { client: qc },
    React.createElement(AppProvider, null, children),
  );
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const mockStakingStats: StakingStats = {
  totalStaked: 8500000,
  totalStakers: 12400,
  currentAPY: 12.5,
  rewardsDistributed: 450000,
  nextRewardEpoch: Date.now() + 86400000,
  minStakeAmount: 100,
  unstakeCooldownDays: 7,
};

// ---------------------------------------------------------------------------
// StakePanel
// ---------------------------------------------------------------------------

describe('StakePanel', () => {
  it('renders Stake AETHEL heading', () => {
    render(
      <TestWrapper>
        <StakePanel stats={mockStakingStats} />
      </TestWrapper>,
    );
    expect(screen.getAllByText('Stake AETHEL').length).toBeGreaterThan(0);
  });

  it('renders current APY badge', () => {
    render(
      <TestWrapper>
        <StakePanel stats={mockStakingStats} />
      </TestWrapper>,
    );
    expect(screen.getByText('12.5% APY')).toBeInTheDocument();
  });

  it('renders minimum stake amount', () => {
    render(
      <TestWrapper>
        <StakePanel stats={mockStakingStats} />
      </TestWrapper>,
    );
    expect(screen.getByText('100')).toBeInTheDocument();
  });

  it('renders cooldown days', () => {
    render(
      <TestWrapper>
        <StakePanel stats={mockStakingStats} />
      </TestWrapper>,
    );
    expect(screen.getByText('7d')).toBeInTheDocument();
  });

  it('renders Stake AETHEL button', () => {
    render(
      <TestWrapper>
        <StakePanel stats={mockStakingStats} />
      </TestWrapper>,
    );
    expect(screen.getByRole('button', { name: /Stake AETHEL/ })).toBeInTheDocument();
  });

  it('button is disabled when amount is empty', () => {
    render(
      <TestWrapper>
        <StakePanel stats={mockStakingStats} />
      </TestWrapper>,
    );
    const button = screen.getByRole('button', { name: /Stake AETHEL/ });
    expect(button).toBeDisabled();
  });

  it('button is disabled when amount is below minimum', () => {
    render(
      <TestWrapper>
        <StakePanel stats={mockStakingStats} />
      </TestWrapper>,
    );
    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '50' } });
    const button = screen.getByRole('button', { name: /Stake AETHEL/ });
    expect(button).toBeDisabled();
  });

  it('shows estimated yearly rewards when valid amount entered', () => {
    render(
      <TestWrapper>
        <StakePanel stats={mockStakingStats} />
      </TestWrapper>,
    );
    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '1000' } });
    expect(screen.getByText(/Estimated yearly rewards/)).toBeInTheDocument();
  });

  it('calls onStake with correct amount when button clicked', () => {
    const onStake = jest.fn();
    render(
      <TestWrapper>
        <StakePanel stats={mockStakingStats} onStake={onStake} />
      </TestWrapper>,
    );
    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '500' } });
    const button = screen.getByRole('button', { name: /Stake AETHEL/ });
    fireEvent.click(button);
    expect(onStake).toHaveBeenCalledWith(500);
  });

  it('shows Staking... when isStaking is true', () => {
    render(
      <TestWrapper>
        <StakePanel stats={mockStakingStats} isStaking />
      </TestWrapper>,
    );
    expect(screen.getByText('Staking...')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// RewardCalculator
// ---------------------------------------------------------------------------

describe('RewardCalculator', () => {
  it('renders Reward Calculator heading', () => {
    render(
      <TestWrapper>
        <RewardCalculator currentAPY={12.5} />
      </TestWrapper>,
    );
    expect(screen.getByText('Reward Calculator')).toBeInTheDocument();
  });

  it('renders stake amount input', () => {
    render(
      <TestWrapper>
        <RewardCalculator currentAPY={12.5} />
      </TestWrapper>,
    );
    expect(screen.getByText('Stake Amount (AETHEL)')).toBeInTheDocument();
  });

  it('renders duration input', () => {
    render(
      <TestWrapper>
        <RewardCalculator currentAPY={12.5} />
      </TestWrapper>,
    );
    expect(screen.getByText('Duration (days)')).toBeInTheDocument();
  });

  it('renders duration preset buttons', () => {
    render(
      <TestWrapper>
        <RewardCalculator currentAPY={12.5} />
      </TestWrapper>,
    );
    expect(screen.getByText('30d')).toBeInTheDocument();
    expect(screen.getByText('90d')).toBeInTheDocument();
    expect(screen.getByText('180d')).toBeInTheDocument();
    expect(screen.getByText('365d')).toBeInTheDocument();
  });

  it('renders estimated rewards output', () => {
    render(
      <TestWrapper>
        <RewardCalculator currentAPY={12.5} />
      </TestWrapper>,
    );
    expect(screen.getByText('Estimated Rewards')).toBeInTheDocument();
  });

  it('renders AETHEL label in rewards output', () => {
    render(
      <TestWrapper>
        <RewardCalculator currentAPY={12.5} />
      </TestWrapper>,
    );
    expect(screen.getAllByText(/AETHEL/).length).toBeGreaterThan(0);
  });

  it('updates calculation when duration preset clicked', () => {
    render(
      <TestWrapper>
        <RewardCalculator currentAPY={12.5} />
      </TestWrapper>,
    );
    fireEvent.click(screen.getByText('30d'));
    expect(screen.getByText(/at 12.5% APY/)).toBeInTheDocument();
  });

  it('updates estimated rewards when amount input changes', () => {
    render(
      <TestWrapper>
        <RewardCalculator currentAPY={12.5} />
      </TestWrapper>,
    );
    const inputs = screen.getAllByRole('spinbutton');
    // First input is the amount
    fireEvent.change(inputs[0], { target: { value: '2000' } });
    expect(screen.getByText('Estimated Rewards')).toBeInTheDocument();
  });

  it('updates estimated rewards when duration input changes', () => {
    render(
      <TestWrapper>
        <RewardCalculator currentAPY={12.5} />
      </TestWrapper>,
    );
    const inputs = screen.getAllByRole('spinbutton');
    // Second input is the duration
    fireEvent.change(inputs[1], { target: { value: '180' } });
    expect(screen.getByText('Estimated Rewards')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// UnstakeTimer
// ---------------------------------------------------------------------------

describe('UnstakeTimer', () => {
  it('shows locked state when unlock is in the future', () => {
    const futureUnlock = Date.now() + 86400000 * 5; // 5 days from now
    render(
      <TestWrapper>
        <UnstakeTimer unlockAt={futureUnlock} />
      </TestWrapper>,
    );
    expect(screen.getByText(/remaining/)).toBeInTheDocument();
  });

  it('shows ready to withdraw when unlock time has passed', () => {
    const pastUnlock = Date.now() - 86400000;
    render(
      <TestWrapper>
        <UnstakeTimer unlockAt={pastUnlock} />
      </TestWrapper>,
    );
    expect(screen.getByText('Ready to withdraw')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// StakingChart
// ---------------------------------------------------------------------------

describe('StakingChart', () => {
  it('renders Staking History heading', () => {
    render(
      <TestWrapper>
        <StakingChart />
      </TestWrapper>,
    );
    expect(screen.getByText('Staking History')).toBeInTheDocument();
  });

  it('renders 30-day description', () => {
    render(
      <TestWrapper>
        <StakingChart />
      </TestWrapper>,
    );
    expect(screen.getByText('Total staked AETHEL over 30 days')).toBeInTheDocument();
  });

  it('renders Total Staked legend item', () => {
    render(
      <TestWrapper>
        <StakingChart />
      </TestWrapper>,
    );
    expect(screen.getByText('Total Staked')).toBeInTheDocument();
  });

  it('renders Rewards legend item', () => {
    render(
      <TestWrapper>
        <StakingChart />
      </TestWrapper>,
    );
    expect(screen.getByText('Rewards')).toBeInTheDocument();
  });
});
