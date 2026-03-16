'use client';

import React, { useState } from 'react';
import {
  Users, Lock, Shield, ShieldCheck,
  Database, Star, ChevronRight, ChevronDown,
  Activity, CheckCircle, XCircle, Clock,
  Layers, Network, Zap,
} from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';

import { MedicalCard, TruncatedHash, StatusBadge, TEEBadge, ChartTooltip } from '@/components/ui/PagePrimitives';
import { Badge } from '@/components/ui/SharedComponents';
import { BRAND, MPC_PROTOCOL_TYPES, EXTENDED_STATUS_STYLES } from '@/lib/constants';
import { formatNumber, timeAgo } from '@/lib/utils';
import type {
  MPCSession,
  MPCResult,
  MPCDataset,
  MPCConvergencePoint,
  MPCProtocolType,
} from '@/types';

// ============================================================
// Protocol label / color helpers
// ============================================================

const PROTOCOL_LABELS: Record<MPCProtocolType, string> = {
  secure_sum: 'Secure Sum',
  federated_averaging: 'Federated Averaging',
  private_intersection: 'Private Intersection',
  garbled_circuits: 'Garbled Circuits',
  secret_sharing: 'Secret Sharing',
};

const PROTOCOL_COLORS: Record<MPCProtocolType, string> = {
  secure_sum: 'bg-blue-50 text-blue-700 border-blue-200',
  federated_averaging: 'bg-purple-50 text-purple-700 border-purple-200',
  private_intersection: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  garbled_circuits: 'bg-amber-50 text-amber-700 border-amber-200',
  secret_sharing: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

const STATUS_LABELS: Record<string, string> = {
  setup: 'Setup',
  enrolling: 'Enrolling',
  computing: 'Computing',
  converging: 'Converging',
  completed: 'Completed',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

const PRIVACY_LEVEL_STYLES: Record<string, string> = {
  standard: 'bg-slate-100 text-slate-600 border-slate-200',
  enhanced: 'bg-blue-50 text-blue-700 border-blue-200',
  maximum: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

// ============================================================
// SessionCard — Individual MPC session row
// ============================================================

interface SessionCardProps {
  session: MPCSession;
  onClick?: () => void;
}

export function SessionCard({ session, onClick }: SessionCardProps) {
  const roundProgress = session.totalRounds > 0
    ? (session.currentRound / session.totalRounds) * 100
    : 0;
  const participantRatio = `${session.participants.length}/${session.maxParticipants}`;
  const isActive = ['computing', 'converging', 'enrolling'].includes(session.status);

  return (
    <MedicalCard hover onClick={onClick} className="group">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-semibold text-slate-900 truncate">{session.name}</h3>
          </div>
          <p className="text-xs text-slate-500 line-clamp-1">{session.description}</p>
        </div>
        <StatusBadge status={STATUS_LABELS[session.status] ?? session.status} />
      </div>

      {/* Protocol + Participant count */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full border ${PROTOCOL_COLORS[session.protocol]}`}>
          <Network className="w-3 h-3" />
          {PROTOCOL_LABELS[session.protocol]}
        </span>
        <span className="inline-flex items-center gap-1 text-xs text-slate-500">
          <Users className="w-3 h-3" />
          {participantRatio} participants
        </span>
      </div>

      {/* Round progress bar */}
      {isActive && (
        <div className="mb-3">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Round {session.currentRound}/{session.totalRounds}</span>
            <span>{roundProgress.toFixed(0)}%</span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${roundProgress}%`,
                background: `linear-gradient(90deg, ${BRAND.sky}, ${BRAND.gold})`,
              }}
            />
          </div>
        </div>
      )}

      {/* Bottom row: TEE + timestamp */}
      <div className="flex items-center justify-between text-xs">
        <TEEBadge platform="Intel SGX" verified />
        <span className="text-slate-400">{timeAgo(session.createdAt)}</span>
      </div>
    </MedicalCard>
  );
}

// ============================================================
// ConvergenceChart — Line chart showing loss decreasing
// ============================================================

interface ConvergenceChartProps {
  data: MPCConvergencePoint[];
  height?: number;
}

export function ConvergenceChart({ data, height = 240 }: ConvergenceChartProps) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis
            dataKey="round"
            tick={{ fontSize: 10, fill: '#94a3b8' }}
            tickLine={false}
            axisLine={{ stroke: '#e2e8f0' }}
            label={{ value: 'Round', position: 'insideBottomRight', offset: -5, fontSize: 10, fill: '#94a3b8' }}
          />
          <YAxis
            yAxisId="loss"
            tick={{ fontSize: 10, fill: '#94a3b8' }}
            tickLine={false}
            axisLine={false}
            label={{ value: 'Loss', angle: -90, position: 'insideLeft', fontSize: 10, fill: '#94a3b8' }}
          />
          <YAxis
            yAxisId="accuracy"
            orientation="right"
            tick={{ fontSize: 10, fill: '#94a3b8' }}
            tickLine={false}
            axisLine={false}
            domain={[40, 100]}
            label={{ value: 'Accuracy %', angle: 90, position: 'insideRight', fontSize: 10, fill: '#94a3b8' }}
          />
          <Tooltip
            content={({ active, payload, label }) => (
              <ChartTooltip
                active={active}
                payload={payload?.map((p) => ({
                  color: p.color ?? '#94a3b8',
                  name: String(p.name ?? ''),
                  value: p.name === 'accuracy' ? `${p.value}%` : Number(p.value ?? 0),
                }))}
                label={`Round ${label}`}
              />
            )}
          />
          <Line
            yAxisId="loss"
            type="monotone"
            dataKey="loss"
            stroke={BRAND.sky}
            strokeWidth={2}
            dot={false}
            name="Loss"
          />
          <Line
            yAxisId="accuracy"
            type="monotone"
            dataKey="accuracy"
            stroke={BRAND.gold}
            strokeWidth={2}
            dot={false}
            name="Accuracy"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ============================================================
// ResultCard — Completed MPC result with bar chart
// ============================================================

interface ResultCardProps {
  result: MPCResult;
}

export function ResultCard({ result }: ResultCardProps) {
  const [expanded, setExpanded] = useState(false);
  const chartData = Object.entries(result.aggregatedResult).map(([key, value]) => ({
    name: key,
    value,
  }));
  const budgetPercent = result.privacyBudgetUsed > 0
    ? Math.min(100, (result.privacyBudgetUsed / (result.privacyBudgetUsed + result.noiseAdded * 10)) * 100)
    : 0;

  return (
    <MedicalCard>
      {/* Header */}
      <div
        className="flex items-start justify-between gap-3 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            {expanded ? (
              <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
            ) : (
              <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
            )}
            <h3 className="text-sm font-semibold text-slate-900">{result.query}</h3>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500 ml-6">
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              {result.participantCount} participants
            </span>
            <span className="flex items-center gap-1">
              <Layers className="w-3 h-3" />
              {result.roundsCompleted} rounds
            </span>
            <span>{timeAgo(result.completedAt)}</span>
          </div>
        </div>
        <Badge variant="success" dot>Completed</Badge>
      </div>

      {expanded && (
        <div className="mt-4 space-y-4">
          {/* Bar chart for aggregated results */}
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  tickLine={false}
                  axisLine={{ stroke: '#e2e8f0' }}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  content={({ active, payload, label }) => (
                    <ChartTooltip
                      active={active}
                      payload={payload?.map((p) => ({
                        color: BRAND.sky,
                        name: String(label ?? ''),
                        value: Number(p.value ?? 0).toFixed(1),
                      }))}
                      label="Aggregated Value"
                    />
                  )}
                />
                <Bar dataKey="value" fill={BRAND.sky} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Privacy budget bar */}
          <div>
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
              <span className="flex items-center gap-1">
                <Lock className="w-3 h-3" />
                Privacy Budget Used
              </span>
              <span>{result.privacyBudgetUsed.toFixed(2)} / {(result.privacyBudgetUsed + result.noiseAdded * 10).toFixed(2)} epsilon</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-brand-500 rounded-full"
                style={{ width: `${budgetPercent}%` }}
              />
            </div>
          </div>

          {/* Confidence & noise */}
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-slate-500">Confidence Interval</span>
              <p className="text-sm font-semibold text-slate-900 mt-0.5">&plusmn;{result.confidenceInterval.toFixed(2)}</p>
            </div>
            <div>
              <span className="text-slate-500">DP Noise Added</span>
              <p className="text-sm font-semibold text-slate-900 mt-0.5">{result.noiseAdded.toFixed(3)} sigma</p>
            </div>
          </div>

          {/* Hashes */}
          <div className="space-y-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-500 w-28 shrink-0">Commitment Hash</span>
              <TruncatedHash hash={result.commitmentHash} startLen={10} endLen={6} />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-500 w-28 shrink-0">TEE Attestation</span>
              <TruncatedHash hash={result.attestation} startLen={10} endLen={6} />
            </div>
          </div>
        </div>
      )}
    </MedicalCard>
  );
}

// ============================================================
// DatasetCard — Available dataset for MPC
// ============================================================

interface DatasetCardProps {
  dataset: MPCDataset;
}

export function DatasetCard({ dataset }: DatasetCardProps) {
  const qualityPercent = dataset.qualityScore;
  const stars = Math.round(dataset.qualityScore / 20);

  return (
    <MedicalCard>
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Database className="w-4 h-4 text-brand-500 shrink-0" />
            <h3 className="text-sm font-semibold text-slate-900 truncate">{dataset.name}</h3>
          </div>
          <p className="text-xs text-slate-500 line-clamp-2">{dataset.description}</p>
        </div>
      </div>

      {/* Record count + data types */}
      <div className="flex items-center gap-2 flex-wrap mb-3">
        <span className="text-xs text-slate-600 font-medium">
          {formatNumber(dataset.recordCount)} records
        </span>
        {dataset.dataTypes.map((dt) => (
          <span
            key={dt}
            className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-slate-100 text-slate-600 border border-slate-200"
          >
            {dt.replace('_', ' ')}
          </span>
        ))}
      </div>

      {/* Quality score */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
          <span>Quality Score</span>
          <span>{qualityPercent.toFixed(0)}%</span>
        </div>
        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{
              width: `${qualityPercent}%`,
              background: qualityPercent >= 80 ? '#10b981' : qualityPercent >= 60 ? '#f59e0b' : '#ef4444',
            }}
          />
        </div>
        <div className="flex items-center gap-0.5 mt-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              className={`w-3 h-3 ${i < stars ? 'text-amber-400 fill-amber-400' : 'text-slate-200'}`}
            />
          ))}
        </div>
      </div>

      {/* Privacy level + reward */}
      <div className="flex items-center justify-between gap-2">
        <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full border ${PRIVACY_LEVEL_STYLES[dataset.privacyLevel]}`}>
          {dataset.privacyLevel.charAt(0).toUpperCase() + dataset.privacyLevel.slice(1)}
        </span>
        <span className="text-xs font-semibold text-brand-600">
          {dataset.contributionReward.toFixed(1)} AETHEL
        </span>
      </div>

      {/* Participation count */}
      <div className="flex items-center gap-1 mt-2 text-xs text-slate-400">
        <Users className="w-3 h-3" />
        {dataset.participations} participations
      </div>
    </MedicalCard>
  );
}

// ============================================================
// ProtocolSelector — Protocol radio-style selector
// ============================================================

interface ProtocolSelectorProps {
  selected: MPCProtocolType;
  onChange: (protocol: MPCProtocolType) => void;
}

export function ProtocolSelector({ selected, onChange }: ProtocolSelectorProps) {
  return (
    <div className="space-y-2">
      {MPC_PROTOCOL_TYPES.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => onChange(p.id as MPCProtocolType)}
          className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
            selected === p.id
              ? 'border-brand-300 bg-brand-50 shadow-sm'
              : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
              selected === p.id ? 'border-brand-500' : 'border-slate-300'
            }`}>
              {selected === p.id && (
                <div className="w-2 h-2 rounded-full bg-brand-500" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-900">{p.label}</p>
              <p className="text-xs text-slate-500">{p.description}</p>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

// ============================================================
// PrivacyBudgetBar — Visual privacy budget indicator
// ============================================================

interface PrivacyBudgetBarProps {
  used: number;
  total: number;
  label?: string;
}

export function PrivacyBudgetBar({ used, total, label }: PrivacyBudgetBarProps) {
  const percent = total > 0 ? Math.min(100, (used / total) * 100) : 0;
  const remaining = Math.max(0, total - used);

  return (
    <div>
      {label && (
        <div className="flex items-center gap-1 text-xs text-slate-500 mb-1">
          <Lock className="w-3 h-3" />
          <span>{label}</span>
        </div>
      )}
      <div className="flex items-center justify-between text-xs text-slate-600 mb-1">
        <span>{used.toFixed(2)} used</span>
        <span>{remaining.toFixed(2)} remaining</span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${percent}%`,
            background: percent > 80 ? '#ef4444' : percent > 50 ? '#f59e0b' : BRAND.sky,
          }}
        />
      </div>
    </div>
  );
}
