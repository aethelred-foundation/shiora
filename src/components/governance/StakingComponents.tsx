'use client';

import React, { useState, useMemo } from 'react';
import {
  Coins, TrendingUp, Clock, Lock, Unlock,
  Calculator, ArrowDown, Gift,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts';

import type { StakingStats } from '@/types';
import { MedicalCard } from '@/components/ui/PagePrimitives';
import { Badge } from '@/components/ui/SharedComponents';
import { ChartTooltip } from '@/components/ui/PagePrimitives';
import { BRAND } from '@/lib/constants';
import { formatNumber, seededRandom, seededInt, generateDayLabel } from '@/lib/utils';

// ============================================================
// StakePanel
// ============================================================

interface StakePanelProps {
  stats: StakingStats;
  onStake?: (amount: number) => void;
  isStaking?: boolean;
}

export function StakePanel({ stats, onStake, isStaking }: StakePanelProps) {
  const [amount, setAmount] = useState('');

  const handleStake = () => {
    const val = parseFloat(amount);
    if (val >= stats.minStakeAmount && onStake) {
      onStake(val);
      setAmount('');
    }
  };

  return (
    <MedicalCard>
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-semibold text-slate-900">Stake AETHEL</h4>
        <Badge variant="success">
          <TrendingUp className="w-3 h-3 mr-1" />
          {stats.currentAPY}% APY
        </Badge>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-xs text-slate-500 mb-1 block">Amount to Stake</label>
          <div className="relative">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={`Min: ${stats.minStakeAmount} AETHEL`}
              className="w-full px-3 py-2.5 pr-16 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400">AETHEL</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="p-2.5 bg-slate-50 rounded-xl text-center">
            <p className="text-2xs text-slate-400">Min Stake</p>
            <p className="text-sm font-bold text-slate-900">{stats.minStakeAmount}</p>
          </div>
          <div className="p-2.5 bg-slate-50 rounded-xl text-center">
            <p className="text-2xs text-slate-400">Cooldown</p>
            <p className="text-sm font-bold text-slate-900">{stats.unstakeCooldownDays}d</p>
          </div>
        </div>

        {amount && parseFloat(amount) >= stats.minStakeAmount && (
          <div className="p-3 bg-emerald-50 rounded-xl">
            <p className="text-xs text-emerald-700">
              Estimated yearly rewards: <span className="font-bold">{formatNumber(parseFloat(amount) * stats.currentAPY / 100)} AETHEL</span>
            </p>
          </div>
        )}

        <button
          onClick={handleStake}
          disabled={!amount || parseFloat(amount) < stats.minStakeAmount || isStaking}
          className="w-full py-2.5 text-sm font-medium rounded-xl bg-brand-500 text-white hover:bg-brand-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isStaking ? 'Staking...' : 'Stake AETHEL'}
        </button>
      </div>
    </MedicalCard>
  );
}

// ============================================================
// RewardCalculator
// ============================================================

interface RewardCalculatorProps {
  currentAPY: number;
}

export function RewardCalculator({ currentAPY }: RewardCalculatorProps) {
  const [amount, setAmount] = useState('1000');
  const [duration, setDuration] = useState('365');

  const estimated = useMemo(() => {
    const a = parseFloat(amount) ||
      /* istanbul ignore next -- amount defaults to '1000', always parseable */
      0;
    const d = parseFloat(duration) ||
      /* istanbul ignore next -- duration defaults to '365', always parseable */
      0;
    return a * (currentAPY / 100) * (d / 365);
  }, [amount, duration, currentAPY]);

  return (
    <MedicalCard>
      <div className="flex items-center gap-2 mb-4">
        <Calculator className="w-4 h-4 text-violet-500" />
        <h4 className="text-sm font-semibold text-slate-900">Reward Calculator</h4>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-xs text-slate-500 mb-1 block">Stake Amount (AETHEL)</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="text-xs text-slate-500 mb-1 block">Duration (days)</label>
          <input
            type="number"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          />
        </div>
        <div className="flex gap-2">
          {[30, 90, 180, 365].map((d) => (
            <button
              key={d}
              onClick={() => setDuration(d.toString())}
              className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                duration === d.toString() ? 'bg-brand-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {d}d
            </button>
          ))}
        </div>

        <div className="p-4 bg-gradient-to-br from-brand-50 to-brand-50 rounded-xl text-center">
          <p className="text-xs text-slate-500 mb-1">Estimated Rewards</p>
          <p className="text-2xl font-bold text-brand-700">{formatNumber(estimated, 1)} AETHEL</p>
          <p className="text-xs text-slate-400 mt-1">at {currentAPY}% APY</p>
        </div>
      </div>
    </MedicalCard>
  );
}

// ============================================================
// UnstakeTimer
// ============================================================

interface UnstakeTimerProps {
  unlockAt: number;
}

export function UnstakeTimer({ unlockAt }: UnstakeTimerProps) {
  const now = Date.now();
  const remaining = Math.max(0, unlockAt - now);
  const days = Math.floor(remaining / 86400000);
  const hours = Math.floor((remaining % 86400000) / 3600000);
  const minutes = Math.floor((remaining % 3600000) / 60000);

  const isReady = remaining <= 0;

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium ${
      isReady ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
    }`}>
      {isReady ? (
        <>
          <Unlock className="w-3.5 h-3.5" />
          Ready to withdraw
        </>
      ) : (
        <>
          <Lock className="w-3.5 h-3.5" />
          {days}d {hours}h {minutes}m remaining
        </>
      )}
    </div>
  );
}

// ============================================================
// StakingChart
// ============================================================

const CHART_SEED = 1460;

interface StakingChartProps {
  className?: string;
}

export function StakingChart({ className }: StakingChartProps) {
  const data = useMemo(() => {
    return Array.from({ length: 30 }, (_, i) => ({
      day: generateDayLabel(29 - i),
      staked: Math.round(7500000 + seededRandom(CHART_SEED + i * 3) * 2000000),
      rewards: Math.round(10000 + seededRandom(CHART_SEED + i * 5) * 8000),
    }));
  }, []);

  return (
    <MedicalCard className={className} padding={false}>
      <div className="p-5 pb-0">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Staking History</h3>
            <p className="text-xs text-slate-400 mt-0.5">Total staked AETHEL over 30 days</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: BRAND.sky }} />
              <span className="text-2xs text-slate-500">Total Staked</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#10b981' }} />
              <span className="text-2xs text-slate-500">Rewards</span>
            </div>
          </div>
        </div>
      </div>
      <div className="px-2 pb-4 pt-2">
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <defs>
              <linearGradient id="stakingGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={BRAND.sky} stopOpacity={0.2} />
                <stop offset="95%" stopColor={BRAND.sky} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="day" tick={{ fontSize: 9, fill: '#94a3b8' }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} interval={6} />
            <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
            <Tooltip content={<ChartTooltip />} />
            <Area
              type="monotone"
              dataKey="staked"
              stroke={BRAND.sky}
              fill="url(#stakingGrad)"
              strokeWidth={2}
              name="Total Staked"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </MedicalCard>
  );
}
