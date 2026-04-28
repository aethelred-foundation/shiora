/**
 * Shiora on Aethelred — Reputation Components
 *
 * Reusable UI components for the Provider Reputation system:
 * ReputationScore, StarRating, ReviewCard, TrustBadge,
 * ReputationHistory, ProviderProfile.
 */

'use client';

import React from 'react';
import {
  Shield,
  ShieldCheck,
  Star,
  User,
  Calendar,
  Activity,
  AlertTriangle,
  CheckCircle,
  Award,
  Building2,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';

import type { ProviderReputation, ProviderReview, TrustLevel } from '@/types';
import { BRAND } from '@/lib/constants';
import { MedicalCard, ChartTooltip } from '@/components/ui/PagePrimitives';
import { Badge } from '@/components/ui/SharedComponents';
import { formatDate, timeAgo } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Trust level config
// ---------------------------------------------------------------------------

const TRUST_CONFIG: Record<
  TrustLevel,
  { label: string; color: string; bg: string; border: string; icon: React.ReactNode }
> = {
  gold: {
    label: 'Gold',
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    icon: <Award className="w-3.5 h-3.5 text-amber-600" />,
  },
  silver: {
    label: 'Silver',
    color: 'text-slate-600',
    bg: 'bg-slate-100',
    border: 'border-slate-200',
    icon: <Shield className="w-3.5 h-3.5 text-slate-500" />,
  },
  bronze: {
    label: 'Bronze',
    color: 'text-orange-700',
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    icon: <Shield className="w-3.5 h-3.5 text-orange-600" />,
  },
  unrated: {
    label: 'Unrated',
    color: 'text-slate-400',
    bg: 'bg-slate-50',
    border: 'border-slate-200',
    icon: <Shield className="w-3.5 h-3.5 text-slate-300" />,
  },
};

// ---------------------------------------------------------------------------
// ReputationScore — circular score display
// ---------------------------------------------------------------------------

export function ReputationScore({
  score,
  trustLevel,
  size = 'md',
}: {
  score: number;
  trustLevel: TrustLevel;
  size?: 'sm' | 'md' | 'lg';
}) {
  const config = TRUST_CONFIG[trustLevel];
  const dims = size === 'lg' ? 96 : size === 'md' ? 72 : 56;
  const strokeW = size === 'lg' ? 6 : size === 'md' ? 5 : 4;
  const r = (dims - strokeW * 2) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (score / 100) * circumference;

  const scoreColor =
    score >= 90 ? '#f59e0b' : score >= 75 ? '#64748b' : score >= 60 ? '#f97316' : '#94a3b8';

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: dims, height: dims }}
    >
      <svg width={dims} height={dims} className="-rotate-90">
        <circle
          cx={dims / 2}
          cy={dims / 2}
          r={r}
          stroke="#e2e8f0"
          strokeWidth={strokeW}
          fill="none"
        />
        <circle
          cx={dims / 2}
          cy={dims / 2}
          r={r}
          stroke={scoreColor}
          strokeWidth={strokeW}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className={`font-bold ${size === 'lg' ? 'text-xl' : size === 'md' ? 'text-base' : 'text-sm'} text-slate-900`}
        >
          {score}
        </span>
        {size !== 'sm' && <span className="text-2xs text-slate-400">/ 100</span>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// StarRating — 5-star display with fractional stars
// ---------------------------------------------------------------------------

export function StarRating({
  rating,
  max = 5,
  size = 'sm',
}: {
  rating: number;
  max?: number;
  size?: 'sm' | 'md';
}) {
  const starSize = size === 'md' ? 'w-5 h-5' : 'w-4 h-4';

  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: max }, (_, i) => {
        const fillPercent = Math.min(1, Math.max(0, rating - i));
        return (
          <div key={i} className="relative">
            <Star className={`${starSize} text-slate-200`} fill="#e2e8f0" />
            {fillPercent > 0 && (
              <div
                className="absolute inset-0 overflow-hidden"
                style={{ width: `${fillPercent * 100}%` }}
              >
                <Star className={`${starSize} text-amber-400`} fill="#fbbf24" />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ReviewCard
// ---------------------------------------------------------------------------

export function ReviewCard({ review }: { review: ProviderReview }) {
  return (
    <MedicalCard>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
            <User className="w-4 h-4 text-slate-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-900">{review.reviewerAnonymousId}</p>
            <p className="text-xs text-slate-400">{timeAgo(review.timestamp)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StarRating rating={review.rating} />
          {review.verified && (
            <Badge variant="success">
              <CheckCircle className="w-3 h-3 mr-1" />
              Verified
            </Badge>
          )}
        </div>
      </div>

      {/* Category ratings */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        {Object.entries(review.categories).map(([key, value]) => (
          <div key={key} className="flex items-center justify-between text-xs">
            <span className="text-slate-500 capitalize">
              {key.replace(/([A-Z])/g, ' $1').trim()}
            </span>
            <StarRating rating={value} size="sm" />
          </div>
        ))}
      </div>

      <p className="text-sm text-slate-600">{review.comment}</p>
    </MedicalCard>
  );
}

// ---------------------------------------------------------------------------
// TrustBadge
// ---------------------------------------------------------------------------

export function TrustBadge({
  trustLevel,
  size = 'sm',
}: {
  trustLevel: TrustLevel;
  size?: 'sm' | 'md';
}) {
  const config = TRUST_CONFIG[trustLevel];

  return (
    <span
      className={`inline-flex items-center gap-1 ${
        size === 'md' ? 'px-2.5 py-1' : 'px-2 py-0.5'
      } ${config.bg} ${config.color} border ${config.border} rounded-full text-xs font-medium`}
    >
      {config.icon}
      {config.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// ReputationHistory — line chart of score over time
// ---------------------------------------------------------------------------

export function ReputationHistory({ data }: { data: { month: string; score: number }[] }) {
  return (
    <MedicalCard padding={false}>
      <div className="p-5 pb-0">
        <h3 className="text-base font-semibold text-slate-900">Reputation History</h3>
        <p className="text-xs text-slate-400 mt-0.5">Score trend over the past 12 months</p>
      </div>
      <div className="px-2 pb-4 pt-2">
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              tickLine={false}
              axisLine={{ stroke: '#e2e8f0' }}
            />
            <YAxis
              domain={[50, 100]}
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<ChartTooltip formatValue={(v) => `${v}/100`} />} />
            <Line
              type="monotone"
              dataKey="score"
              stroke={BRAND.sky}
              strokeWidth={2}
              dot={{ r: 3, fill: BRAND.sky }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </MedicalCard>
  );
}

// ---------------------------------------------------------------------------
// ProviderProfile — full provider card
// ---------------------------------------------------------------------------

export function ProviderProfile({
  provider,
  onClick,
}: {
  provider: ProviderReputation;
  onClick?: () => void;
}) {
  const daysSinceJoined = Math.floor((Date.now() - provider.registeredAt) / 86400000);

  return (
    <MedicalCard onClick={onClick} className={onClick ? 'cursor-pointer' : ''}>
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-100 to-brand-200 flex items-center justify-center shrink-0">
          <Building2 className="w-6 h-6 text-brand-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-sm font-semibold text-slate-900 truncate">{provider.name}</h4>
            <TrustBadge trustLevel={provider.trustLevel} />
          </div>
          <p className="text-xs text-slate-500 mb-2">{provider.specialty}</p>
          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <Star className="w-3 h-3" /> {provider.overallScore}/100
            </span>
            <span className="flex items-center gap-1">
              <User className="w-3 h-3" /> {provider.reviewCount} reviews
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" /> {daysSinceJoined}d member
            </span>
            {provider.dataBreaches > 0 && (
              <span className="flex items-center gap-1 text-red-500">
                <AlertTriangle className="w-3 h-3" /> {provider.dataBreaches} breach
                {provider.dataBreaches > 1 ? 'es' : ''}
              </span>
            )}
          </div>
        </div>
        <div className="shrink-0">
          <ReputationScore
            score={provider.overallScore}
            trustLevel={provider.trustLevel}
            size="sm"
          />
        </div>
      </div>
    </MedicalCard>
  );
}
