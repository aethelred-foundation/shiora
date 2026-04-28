/**
 * Shiora on Aethelred — Governance & Staking Page
 *
 * Protocol governance: proposals, voting, staking, delegation,
 * and treasury management on the Aethelred blockchain.
 */

'use client';

import { useState, useMemo } from 'react';
import {
  Vote,
  Coins,
  Shield,
  Users,
  Wallet,
  Plus,
  TrendingUp,
  Clock,
  CheckCircle,
  Gift,
  ArrowUpRight,
  Lock,
  Unlock,
  BarChart3,
  PieChart as PieChartIcon,
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

import { useApp } from '@/contexts/AppContext';
import {
  TopNav,
  Footer,
  ToastContainer,
  SearchOverlay,
  Badge,
  Tabs,
} from '@/components/ui/SharedComponents';
import {
  MedicalCard,
  SectionHeader,
  StatusBadge,
  HealthMetricCard,
} from '@/components/ui/PagePrimitives';
import { ChartTooltip } from '@/components/ui/PagePrimitives';
import {
  ProposalCard,
  VotingBar,
  DelegationPanel,
  ProposalTimeline,
  QuorumMeter,
} from '@/components/governance/GovernanceComponents';
import {
  StakePanel,
  RewardCalculator,
  UnstakeTimer,
  StakingChart,
} from '@/components/governance/StakingComponents';
import { useGovernance } from '@/hooks/useGovernance';
import { useStaking } from '@/hooks/useStaking';
import { BRAND, CHART_COLORS } from '@/lib/constants';
import { seededRandom, seededInt, seededHex, formatNumber, formatDate, timeAgo } from '@/lib/utils';

import type { ProposalStatus } from '@/types';

// ============================================================
// Mock Data
// ============================================================

const SEED = 1410;

function generateTreasuryBreakdown() {
  return [
    { name: 'Research Grants', value: 35, color: CHART_COLORS[0] },
    { name: 'Development', value: 25, color: CHART_COLORS[1] },
    { name: 'Community Rewards', value: 20, color: CHART_COLORS[4] },
    { name: 'Operations', value: 12, color: CHART_COLORS[5] },
    { name: 'Reserve', value: 8, color: CHART_COLORS[6] },
  ];
}

// ============================================================
// Main Page
// ============================================================

export default function GovernancePage() {
  const { wallet } = useApp();
  const governance = useGovernance();
  const staking = useStaking();

  const [activeTab, setActiveTab] = useState('proposals');
  const [delegateAddress, setDelegateAddress] = useState('');

  const treasuryBreakdown = useMemo(() => generateTreasuryBreakdown(), []);

  const tabs = [
    { id: 'proposals', label: 'Proposals' },
    { id: 'my-votes', label: 'My Votes' },
    { id: 'staking', label: 'Staking' },
    { id: 'delegation', label: 'Delegation' },
    { id: 'treasury', label: 'Treasury' },
  ];

  const STATUS_FILTERS: Array<{ value: ProposalStatus | undefined; label: string }> = [
    { value: undefined, label: 'All' },
    { value: 'active', label: 'Active' },
    { value: 'passed', label: 'Passed' },
    { value: 'defeated', label: 'Defeated' },
    { value: 'executed', label: 'Executed' },
    { value: 'cancelled', label: 'Cancelled' },
  ];

  const handleVote = (proposalId: string, support: 'for' | 'against' | 'abstain') => {
    governance.vote.mutate({ proposalId, support });
  };

  const handleDelegate = () => {
    if (delegateAddress.startsWith('aeth1') && delegateAddress.length === 43) {
      governance.delegate.mutate(delegateAddress);
      setDelegateAddress('');
    }
  };

  return (
    <>
      <TopNav />
      <SearchOverlay />
      <ToastContainer />

      <main id="main-content" className="flex-1">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Vote className="w-6 h-6 text-brand-500" />
                <h1 className="text-2xl font-bold text-slate-900">Governance & Staking</h1>
              </div>
              <p className="text-sm text-slate-500">
                Participate in protocol governance, stake AETHEL tokens, and delegate voting power
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="brand">
                <Coins className="w-3 h-3 mr-1" />
                {formatNumber(governance.userVotingPower)} Voting Power
              </Badge>
            </div>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
            <HealthMetricCard
              icon={<Vote className="w-5 h-5" />}
              label="Active Proposals"
              value={governance.stats.activeProposals.toString()}
              unit="open"
              trend={0}
              trendLabel="this period"
              sparklineData={[2, 3, 2, 4, 3, 3, 2, 3]}
              sparklineColor={BRAND.sky}
            />
            <HealthMetricCard
              icon={<Users className="w-5 h-5" />}
              label="Total Voters"
              value={formatNumber(governance.stats.totalVoters)}
              trend={5.2}
              trendLabel="this month"
              sparklineData={[1500, 1600, 1650, 1700, 1750, 1780, 1800, 1842]}
              sparklineColor="#a78bfa"
            />
            <HealthMetricCard
              icon={<Coins className="w-5 h-5" />}
              label="Total Staked"
              value={formatNumber(staking.stats.totalStaked)}
              unit="AETHEL"
              trend={3.8}
              trendLabel="this week"
              sparklineData={[
                7800000, 7900000, 8000000, 8100000, 8200000, 8400000, 8600000, 8750000,
              ]}
              sparklineColor="#10b981"
            />
            <HealthMetricCard
              icon={<Wallet className="w-5 h-5" />}
              label="Treasury"
              value={formatNumber(governance.stats.treasuryBalance)}
              unit="AETHEL"
              trend={1.2}
              trendLabel="net inflow"
              sparklineData={[
                2200000, 2250000, 2300000, 2350000, 2380000, 2400000, 2430000, 2450000,
              ]}
              sparklineColor="#fb923c"
            />
          </div>

          {/* Tabs */}
          <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} className="mb-8" />

          {/* Proposals Tab */}
          {activeTab === 'proposals' && (
            <div className="space-y-6">
              {/* Status filter */}
              <div className="flex flex-wrap items-center gap-2">
                {STATUS_FILTERS.map((f) => (
                  <button
                    key={f.label}
                    onClick={() => governance.setStatusFilter(f.value)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                      governance.statusFilter === f.value
                        ? 'bg-brand-500 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Proposal grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {governance.proposals.map((proposal) => (
                  <ProposalCard key={proposal.id} proposal={proposal} onVote={handleVote} />
                ))}
              </div>

              {governance.proposals.length === 0 && !governance.isLoading && (
                <div className="text-center py-12">
                  <Vote className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-sm text-slate-500">
                    No proposals found with the selected filter.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* My Votes Tab */}
          {activeTab === 'my-votes' && (
            <div className="space-y-4">
              <SectionHeader
                title="Voting History"
                subtitle="Your past votes on protocol proposals"
                size="sm"
              />
              {governance.votes.slice(0, 10).map((vote) => {
                const proposal = governance.proposals.find((p) => p.id === vote.proposalId);
                return (
                  <MedicalCard key={vote.id}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-semibold text-slate-900 truncate">
                          {proposal?.title ?? vote.proposalId}
                        </h4>
                        <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                          <Badge
                            variant={
                              vote.support === 'for'
                                ? 'success'
                                : vote.support === 'against'
                                  ? 'error'
                                  : 'neutral'
                            }
                          >
                            {vote.support === 'for'
                              ? 'Voted For'
                              : vote.support === 'against'
                                ? 'Voted Against'
                                : 'Abstained'}
                          </Badge>
                          <span>{formatNumber(vote.weight)} VP</span>
                          <span>{timeAgo(vote.timestamp)}</span>
                        </div>
                        {vote.reason && (
                          <p className="text-xs text-slate-500 mt-2">{vote.reason}</p>
                        )}
                      </div>
                    </div>
                  </MedicalCard>
                );
              })}
            </div>
          )}

          {/* Staking Tab */}
          {activeTab === 'staking' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <StakePanel
                  stats={staking.stats}
                  onStake={(amount) => staking.stake.mutate(amount)}
                  isStaking={staking.stake.isLoading}
                />
                <RewardCalculator currentAPY={staking.stats.currentAPY} />
                <MedicalCard>
                  <h4 className="text-sm font-semibold text-slate-900 mb-4">
                    Your Staking Summary
                  </h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between py-2 border-b border-slate-100">
                      <span className="text-xs text-slate-500">Total Staked</span>
                      <span className="text-sm font-bold text-slate-900">
                        {formatNumber(staking.totalStaked)} AETHEL
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-slate-100">
                      <span className="text-xs text-slate-500">Pending Rewards</span>
                      <span className="text-sm font-bold text-emerald-600">
                        {formatNumber(staking.pendingRewards)} AETHEL
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-slate-100">
                      <span className="text-xs text-slate-500">Active Positions</span>
                      <span className="text-sm font-bold text-slate-900">
                        {staking.positions.filter((p) => p.status === 'staked').length}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <span className="text-xs text-slate-500">Current APY</span>
                      <span className="text-sm font-bold text-brand-600">
                        {staking.stats.currentAPY}%
                      </span>
                    </div>
                  </div>
                </MedicalCard>
              </div>

              {/* Positions */}
              <SectionHeader title="Staking Positions" size="sm" />
              <div className="space-y-3">
                {staking.positions.map((pos) => (
                  <MedicalCard key={pos.id}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                            pos.status === 'staked'
                              ? 'bg-emerald-50 text-emerald-600'
                              : pos.status === 'unstaking'
                                ? 'bg-amber-50 text-amber-600'
                                : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {pos.status === 'staked' ? (
                            <Lock className="w-5 h-5" />
                          ) : pos.status === 'unstaking' ? (
                            <Clock className="w-5 h-5" />
                          ) : (
                            <Unlock className="w-5 h-5" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {formatNumber(pos.amount)} AETHEL
                          </p>
                          <p className="text-xs text-slate-400">
                            Staked {formatDate(pos.stakedAt)} &middot; Earned{' '}
                            {formatNumber(pos.rewardsEarned)} AETHEL
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {pos.status === 'unstaking' && pos.unlockAt && (
                          <UnstakeTimer unlockAt={pos.unlockAt} />
                        )}
                        <StatusBadge
                          status={
                            pos.status === 'staked'
                              ? 'Active'
                              : pos.status === 'unstaking'
                                ? 'Pending'
                                : 'Expired'
                          }
                        />
                        {pos.status === 'staked' && (
                          <button
                            onClick={() => staking.unstake.mutate(pos.id)}
                            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
                          >
                            Unstake
                          </button>
                        )}
                        {pos.rewardsEarned > pos.rewardsClaimed && (
                          <button
                            onClick={() => staking.claimRewards.mutate(pos.id)}
                            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
                          >
                            <Gift className="w-3 h-3 inline mr-1" />
                            Claim
                          </button>
                        )}
                      </div>
                    </div>
                  </MedicalCard>
                ))}
              </div>

              {/* Staking chart */}
              <StakingChart />

              {/* Rewards history */}
              <SectionHeader title="Rewards History" size="sm" />
              <MedicalCard padding={false}>
                <div className="divide-y divide-slate-100">
                  {staking.rewards.slice(0, 8).map((reward) => (
                    <div
                      key={reward.id}
                      className="px-5 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors"
                    >
                      <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                        <Gift className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900">
                          +{reward.amount} AETHEL
                        </p>
                        <p className="text-xs text-slate-400">{reward.source.replace(/_/g, ' ')}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-slate-400">{timeAgo(reward.earnedAt)}</p>
                        {reward.claimedAt ? (
                          <Badge variant="success">Claimed</Badge>
                        ) : (
                          <Badge variant="warning">Pending</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </MedicalCard>
            </div>
          )}

          {/* Delegation Tab */}
          {activeTab === 'delegation' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <DelegationPanel
                  delegations={governance.delegations}
                  userVotingPower={governance.userVotingPower}
                  onUndelegate={governance.undelegate.mutate}
                />

                <MedicalCard>
                  <h4 className="text-sm font-semibold text-slate-900 mb-4">
                    Delegate Voting Power
                  </h4>
                  <p className="text-xs text-slate-500 mb-4">
                    Delegate your voting power to a trusted address. You retain your staking
                    rewards.
                  </p>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-slate-500 mb-1 block">Delegatee Address</label>
                      <input
                        type="text"
                        value={delegateAddress}
                        onChange={(e) => setDelegateAddress(e.target.value)}
                        placeholder="aeth1..."
                        className="w-full px-3 py-2.5 text-sm font-mono border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                      />
                    </div>
                    <button
                      onClick={handleDelegate}
                      disabled={
                        !delegateAddress.startsWith('aeth1') || delegateAddress.length !== 43
                      }
                      className="w-full py-2.5 text-sm font-medium rounded-xl bg-brand-500 text-white hover:bg-brand-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Delegate
                    </button>
                  </div>
                </MedicalCard>
              </div>
            </div>
          )}

          {/* Treasury Tab */}
          {activeTab === 'treasury' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Balance card */}
                <MedicalCard>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center">
                      <Wallet className="w-6 h-6 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Treasury Balance</p>
                      <p className="text-2xl font-bold text-slate-900">
                        {formatNumber(governance.stats.treasuryBalance)} AETHEL
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">Inflows (30d)</span>
                      <span className="text-emerald-600 font-medium">
                        +{formatNumber(seededInt(SEED, 50000, 120000))} AETHEL
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">Outflows (30d)</span>
                      <span className="text-red-600 font-medium">
                        -{formatNumber(seededInt(SEED + 1, 30000, 80000))} AETHEL
                      </span>
                    </div>
                  </div>
                </MedicalCard>

                {/* Spending breakdown pie */}
                <MedicalCard className="lg:col-span-2" padding={false}>
                  <div className="p-5 pb-0">
                    <h3 className="text-base font-semibold text-slate-900">Treasury Allocation</h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Distribution of treasury spending
                    </p>
                  </div>
                  <div className="flex items-center gap-8 p-5">
                    <ResponsiveContainer width={180} height={180}>
                      <PieChart>
                        <Pie
                          data={treasuryBreakdown}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {treasuryBreakdown.map((entry, i) => (
                            <Cell key={i} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip content={<ChartTooltip formatValue={(v) => `${v}%`} />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-2.5 flex-1">
                      {treasuryBreakdown.map((item) => (
                        <div key={item.name} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-2.5 h-2.5 rounded-full"
                              style={{ backgroundColor: item.color }}
                            />
                            <span className="text-slate-600">{item.name}</span>
                          </div>
                          <span className="text-slate-900 font-medium">{item.value}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </MedicalCard>
              </div>

              {/* Treasury proposals */}
              <SectionHeader
                title="Spending Proposals"
                subtitle="Recent treasury allocation proposals"
                size="sm"
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {governance.proposals
                  .filter((p) => p.type === 'treasury')
                  .slice(0, 4)
                  .map((proposal) => (
                    <ProposalCard key={proposal.id} proposal={proposal} onVote={handleVote} />
                  ))}
              </div>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </>
  );
}
