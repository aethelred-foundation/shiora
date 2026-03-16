/**
 * Shiora on Aethelred — Rewards Components
 *
 * Reusable UI components for the Health-to-Earn rewards system:
 * RewardCard, EarnChart, StreakIndicator, MilestoneProgress, RewardsSummary.
 */

'use client';

import React from 'react';
import {
  Upload, RefreshCw, MessageCircle, Stethoscope,
  Microscope, Flame, Trophy, Users, Gift,
  TrendingUp, Coins, Award, Star,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts';

import type { RewardEntry, RewardStreak, RewardStats } from '@/types';
import { REWARD_ACTIONS, BRAND } from '@/lib/constants';
import { MedicalCard, ChartTooltip } from '@/components/ui/PagePrimitives';
import { Badge } from '@/components/ui/SharedComponents';
import { formatDate, timeAgo } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Icon map for reward actions
// ---------------------------------------------------------------------------

const ACTION_ICON_MAP: Record<string, React.ReactNode> = {
  data_upload: <Upload className="w-4 h-4" />,
  wearable_sync: <RefreshCw className="w-4 h-4" />,
  community_post: <MessageCircle className="w-4 h-4" />,
  health_checkup: <Stethoscope className="w-4 h-4" />,
  data_contribution: <Microscope className="w-4 h-4" />,
  streak_bonus: <Flame className="w-4 h-4" />,
  milestone: <Trophy className="w-4 h-4" />,
  referral: <Users className="w-4 h-4" />,
};

const ACTION_COLORS: Record<string, string> = {
  data_upload: 'bg-brand-50 text-brand-600',
  wearable_sync: 'bg-cyan-50 text-cyan-600',
  community_post: 'bg-violet-50 text-violet-600',
  health_checkup: 'bg-emerald-50 text-emerald-600',
  data_contribution: 'bg-brand-50 text-brand-600',
  streak_bonus: 'bg-orange-50 text-orange-600',
  milestone: 'bg-amber-50 text-amber-600',
  referral: 'bg-pink-50 text-pink-600',
};

// ---------------------------------------------------------------------------
// RewardCard
// ---------------------------------------------------------------------------

export function RewardCard({
  reward,
  onClaim,
  isClaimLoading,
}: {
  reward: RewardEntry;
  onClaim?: (id: string) => void;
  isClaimLoading?: boolean;
}) {
  const actionDef = REWARD_ACTIONS.find((a) => a.id === reward.action);
  const iconBg = ACTION_COLORS[reward.action] ??
    /* istanbul ignore next */
    'bg-slate-50 text-slate-600';
  const icon = ACTION_ICON_MAP[reward.action] ??
    /* istanbul ignore next */
    <Gift className="w-4 h-4" />;
  const isClaimed = !!reward.claimedAt;

  return (
    <MedicalCard>
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center shrink-0`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h4 className="text-sm font-semibold text-slate-900 truncate">
              {actionDef?.label ??
                /* istanbul ignore next */
                reward.action}
            </h4>
            {isClaimed && (
              <Badge variant="success">Claimed</Badge>
            )}
          </div>
          <p className="text-xs text-slate-500 truncate">{reward.description}</p>
          <p className="text-xs text-slate-400 mt-1">{timeAgo(reward.earnedAt)}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-bold text-slate-900">+{reward.amount}</p>
          <p className="text-xs text-slate-400">AETHEL</p>
          {!isClaimed && onClaim && (
            <button
              onClick={() => onClaim(reward.id)}
              disabled={isClaimLoading}
              className="mt-2 px-3 py-1 text-xs font-medium bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors disabled:opacity-50"
            >
              {isClaimLoading ? 'Claiming...' : 'Claim'}
            </button>
          )}
        </div>
      </div>
    </MedicalCard>
  );
}

// ---------------------------------------------------------------------------
// EarnChart — AreaChart of daily AETHEL earned over 30 days
// ---------------------------------------------------------------------------

export function EarnChart({
  data,
}: {
  data: { day: string; earned: number }[];
}) {
  return (
    <MedicalCard padding={false}>
      <div className="p-5 pb-0">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-base font-semibold text-slate-900">Daily Earnings</h3>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: BRAND.sky }} />
            <span className="text-2xs text-slate-500">AETHEL Earned</span>
          </div>
        </div>
        <p className="text-xs text-slate-400 mb-4">Last 30 days</p>
      </div>
      <div className="px-2 pb-4">
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <defs>
              <linearGradient id="earnGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={BRAND.sky} stopOpacity={0.2} />
                <stop offset="95%" stopColor={BRAND.sky} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              dataKey="day"
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              tickLine={false}
              axisLine={{ stroke: '#e2e8f0' }}
              interval={6}
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<ChartTooltip formatValue={(v) => `${v} AETHEL`} />} />
            <Area
              type="monotone"
              dataKey="earned"
              stroke={BRAND.sky}
              fill="url(#earnGrad)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: BRAND.sky }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </MedicalCard>
  );
}

// ---------------------------------------------------------------------------
// StreakIndicator
// ---------------------------------------------------------------------------

export function StreakIndicator({
  streak,
}: {
  streak: RewardStreak;
}) {
  const actionDef = REWARD_ACTIONS.find((a) => a.id === streak.action);

  return (
    <div className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-orange-50 text-orange-500 flex items-center justify-center">
          <Flame className="w-4 h-4" />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-900">{actionDef?.label ??
            /* istanbul ignore next */
            streak.action}</p>
          <p className="text-xs text-slate-400">
            Longest: {streak.longestStreak} days
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {streak.multiplier > 1 && (
          <Badge variant="warning">{streak.multiplier.toFixed(1)}x</Badge>
        )}
        <div className="text-right">
          <p className="text-sm font-bold text-slate-900">{streak.currentStreak}</p>
          <p className="text-2xs text-slate-400">days</p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MilestoneProgress
// ---------------------------------------------------------------------------

export function MilestoneProgress({
  stats,
}: {
  stats: RewardStats;
}) {
  const progress = Math.min(100, (stats.totalEarned / stats.nextLevelThreshold) * 100);
  const remaining = Math.max(0, stats.nextLevelThreshold - stats.totalEarned);

  return (
    <MedicalCard>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Award className="w-5 h-5 text-amber-500" />
          <h3 className="text-base font-semibold text-slate-900">Level Progress</h3>
        </div>
        <Badge variant="medical">Level {stats.level}</Badge>
      </div>
      <div className="mb-3">
        <div className="flex justify-between text-xs text-slate-500 mb-1.5">
          <span>{stats.totalEarned} AETHEL earned</span>
          <span>{stats.nextLevelThreshold} AETHEL</span>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-3">
          <div
            className="bg-gradient-to-r from-amber-400 to-amber-500 h-3 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
      <p className="text-xs text-slate-400">
        {remaining > 0 ? `${remaining} AETHEL to Level ${stats.level + 1}` : 'Level up!'}
      </p>
    </MedicalCard>
  );
}

// ---------------------------------------------------------------------------
// RewardsSummary — compact widget for embedding in dashboard
// ---------------------------------------------------------------------------

export function RewardsSummary({
  stats,
  streakCount,
}: {
  stats: RewardStats;
  streakCount: number;
}) {
  return (
    <MedicalCard>
      <div className="flex items-center gap-2 mb-4">
        <Coins className="w-5 h-5 text-amber-500" />
        <h3 className="text-base font-semibold text-slate-900">Rewards Summary</h3>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-emerald-50 rounded-xl p-3">
          <p className="text-xs text-emerald-600 mb-0.5">Total Earned</p>
          <p className="text-lg font-bold text-emerald-700">{stats.totalEarned}</p>
          <p className="text-2xs text-emerald-500">AETHEL</p>
        </div>
        <div className="bg-amber-50 rounded-xl p-3">
          <p className="text-xs text-amber-600 mb-0.5">Pending</p>
          <p className="text-lg font-bold text-amber-700">{stats.pendingRewards}</p>
          <p className="text-2xs text-amber-500">AETHEL</p>
        </div>
        <div className="bg-orange-50 rounded-xl p-3">
          <p className="text-xs text-orange-600 mb-0.5">Active Streaks</p>
          <p className="text-lg font-bold text-orange-700">{streakCount}</p>
          <p className="text-2xs text-orange-500">actions</p>
        </div>
        <div className="bg-brand-50 rounded-xl p-3">
          <p className="text-xs text-brand-600 mb-0.5">Level</p>
          <p className="text-lg font-bold text-brand-700">{stats.level}</p>
          <p className="text-2xs text-brand-500">Rank #{stats.rank}</p>
        </div>
      </div>
    </MedicalCard>
  );
}
