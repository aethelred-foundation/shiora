/**
 * Shiora on Aethelred — Digital Twin Components
 * Reusable components for the Digital Health Twin feature.
 */

'use client';

import React from 'react';
import {
  Heart, Wind, Brain, Zap, Bone, Apple, Droplets,
  CircleDot, Shield, Baby, TrendingUp, TrendingDown,
  Minus, Play, CheckCircle, Clock, AlertTriangle,
  Activity, RefreshCw, Cpu, FileText, Settings,
  Sliders, ChevronRight,
} from 'lucide-react';
import {
  LineChart, Line, AreaChart, Area,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine,
} from 'recharts';

import { MedicalCard, ChartTooltip, TEEBadge, TruncatedHash } from '@/components/ui/PagePrimitives';
import { Badge, ProgressRing } from '@/components/ui/SharedComponents';
import { BRAND, CHART_COLORS, ORGAN_SYSTEMS } from '@/lib/constants';
import { formatDate, formatDateTime, timeAgo } from '@/lib/utils';
import type {
  DigitalTwin,
  TwinSimulation,
  TwinParameter,
  TwinPrediction,
  TwinTimelineEvent,
  OrganSystem,
} from '@/types';

// ============================================================
// Organ system icon map
// ============================================================

const ORGAN_ICON_MAP: Record<string, React.ReactNode> = {
  cardiovascular: <Heart className="w-5 h-5" />,
  respiratory: <Wind className="w-5 h-5" />,
  neurological: <Brain className="w-5 h-5" />,
  endocrine: <Zap className="w-5 h-5" />,
  musculoskeletal: <Bone className="w-5 h-5" />,
  gastrointestinal: <Apple className="w-5 h-5" />,
  renal: <Droplets className="w-5 h-5" />,
  hepatic: <CircleDot className="w-5 h-5" />,
  immune: <Shield className="w-5 h-5" />,
  reproductive: <Baby className="w-5 h-5" />,
};

function getOrganMeta(systemId: string) {
  const organ = ORGAN_SYSTEMS.find((o) => o.id === systemId);
  return {
    label: organ?.label ?? systemId,
    color: organ?.color ?? '#94a3b8',
    icon: ORGAN_ICON_MAP[systemId] ?? <Activity className="w-5 h-5" />,
  };
}

function getScoreColor(score: number): string {
  if (score >= 85) return '#10b981';
  if (score >= 70) return '#06b6d4';
  if (score >= 55) return '#eab308';
  return '#ef4444';
}

// ============================================================
// OrganScoreCard
// ============================================================

export function OrganScoreCard({
  system,
  score,
  trend,
  lastUpdated,
}: {
  system: OrganSystem;
  score: number;
  trend: 'improving' | 'stable' | 'declining';
  lastUpdated: number;
}) {
  const meta = getOrganMeta(system);
  const scoreColor = getScoreColor(score);

  const TrendIcon = trend === 'improving' ? TrendingUp : trend === 'declining' ? TrendingDown : Minus;
  const trendColor = trend === 'improving' ? 'text-emerald-600' : trend === 'declining' ? 'text-rose-600' : 'text-slate-400';
  const trendLabel = trend === 'improving' ? 'Improving' : trend === 'declining' ? 'Declining' : 'Stable';

  return (
    <MedicalCard>
      <div className="flex items-start justify-between mb-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
          style={{ backgroundColor: meta.color }}
        >
          {meta.icon}
        </div>
        <div className={`flex items-center gap-1 text-xs ${trendColor}`}>
          <TrendIcon className="w-3.5 h-3.5" />
          <span className="font-medium">{trendLabel}</span>
        </div>
      </div>

      <h4 className="text-sm font-semibold text-slate-900 mb-2">{meta.label}</h4>

      {/* Score bar */}
      <div className="mb-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-slate-500">Health Score</span>
          <span className="text-sm font-bold" style={{ color: scoreColor }}>{score}</span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${score}%`, backgroundColor: scoreColor }}
          />
        </div>
      </div>

      <p className="text-xs text-slate-400">Updated {timeAgo(lastUpdated)}</p>
    </MedicalCard>
  );
}

// ============================================================
// SimulationCard
// ============================================================

const SIM_STATUS_VARIANTS: Record<string, string> = {
  completed: 'success',
  simulating: 'warning',
  pending: 'neutral',
  failed: 'error',
};

export function SimulationCard({
  simulation,
  isSelected,
  onClick,
}: {
  simulation: TwinSimulation;
  isSelected?: boolean;
  onClick?: () => void;
}) {
  const statusVariant = SIM_STATUS_VARIANTS[simulation.status] ??
    /* istanbul ignore next */
    'neutral';

  // Calculate average metric change for completed simulations
  let avgChange: number | null = null;
  if (simulation.status === 'completed' && simulation.beforeMetrics?.length > 0) {
    const changes = simulation.beforeMetrics.map((bm, i) => {
      const am = simulation.afterMetrics[i];
      /* istanbul ignore next */
      if (!am) return 0;
      return ((am.value - bm.value) / bm.value) * 100;
    });
    avgChange = changes.reduce((s, c) => s + c, 0) / changes.length;
  }

  return (
    <MedicalCard
      onClick={onClick}
      className={isSelected ? 'ring-2 ring-brand-500 border-brand-300' : ''}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          {simulation.status === 'simulating' ? (
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
              <RefreshCw className="w-4 h-4 text-amber-600 animate-spin" />
            </div>
          ) : (
            <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center">
              <Play className="w-4 h-4 text-brand-600" />
            </div>
          )}
          <div>
            <h4 className="text-sm font-semibold text-slate-900">{simulation.scenario}</h4>
            <p className="text-xs text-slate-400">
              {simulation.status === 'completed'
                ? `Completed ${timeAgo(simulation.completedAt!)}`
                : simulation.status === 'simulating'
                ? 'Running...'
                : 'Pending'}
            </p>
          </div>
        </div>
        <Badge variant={statusVariant as any}>{simulation.status}</Badge>
      </div>

      <p className="text-xs text-slate-600 line-clamp-2 mb-3">{simulation.description}</p>

      {/* Metric comparison (completed only) */}
      {simulation.status === 'completed' && simulation.beforeMetrics.length > 0 && (
        <div className="border-t border-slate-100 pt-3 mt-2">
          <div className="grid grid-cols-2 gap-2">
            {simulation.beforeMetrics.slice(0, 2).map((bm, i) => {
              const am = simulation.afterMetrics[i];
              /* istanbul ignore next */
              if (!am) return null;
              const change = ((am.value - bm.value) / bm.value) * 100;
              const isImproving = Math.abs(am.value) < Math.abs(bm.value) || change < 0;
              return (
                <div key={i} className="text-center p-2 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500 truncate">{bm.metric}</p>
                  <p className={`text-sm font-bold ${isImproving ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {change > 0 ? '+' : ''}{change.toFixed(1)}%
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Confidence + TEE */}
      <div className="flex items-center justify-between mt-3">
        <span className="text-xs text-slate-400">
          Confidence: {simulation.confidenceInterval}%
        </span>
        <TEEBadge verified={simulation.status === 'completed'} />
      </div>
    </MedicalCard>
  );
}

// ============================================================
// SimulationDetailChart — Before/After trajectory line chart
// ============================================================

export function SimulationDetailChart({ simulation }: { simulation: TwinSimulation }) {
  const { trajectoryData } = simulation;
  if (trajectoryData.length === 0) return null;

  const metric = trajectoryData[0]?.metric ??
    /* istanbul ignore next */
    'Metric';

  return (
    <MedicalCard>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{metric} Trajectory</h3>
          <p className="text-xs text-slate-500">Before vs. After simulation over 90 days</p>
        </div>
        <Badge variant="info">{simulation.confidenceInterval}% CI</Badge>
      </div>

      <div className="h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={trajectoryData} margin={{ top: 5, right: 15, bottom: 5, left: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              dataKey="day"
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              tickLine={false}
              axisLine={{ stroke: '#e2e8f0' }}
              label={{ value: 'Days', position: 'insideBottom', offset: -2, fontSize: 10, fill: '#94a3b8' }}
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              tickLine={false}
              axisLine={{ stroke: '#e2e8f0' }}
              width={40}
            />
            <Tooltip content={<ChartTooltip />} />
            <Line
              type="monotone"
              dataKey="before"
              name="Before"
              stroke="#94a3b8"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="after"
              name="After"
              stroke={BRAND.sky}
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 4, fill: BRAND.sky, strokeWidth: 2, stroke: '#fff' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Metric comparison table */}
      {simulation.beforeMetrics.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/50">
                <th className="py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Metric</th>
                <th className="py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Before</th>
                <th className="py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">After</th>
                <th className="py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Change</th>
              </tr>
            </thead>
            <tbody>
              {simulation.beforeMetrics.map((bm, i) => {
                const am = simulation.afterMetrics[i];
                /* istanbul ignore next */
                if (!am) return null;
                const change = ((am.value - bm.value) / bm.value) * 100;
                return (
                  <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td className="py-2 px-3 text-sm font-medium text-slate-900">{bm.metric}</td>
                    <td className="py-2 px-3 text-sm text-slate-600">
                      {bm.value} <span className="text-xs text-slate-400">{bm.unit}</span>
                    </td>
                    <td className="py-2 px-3 text-sm text-slate-600">
                      {am.value} <span className="text-xs text-slate-400">{am.unit}</span>
                    </td>
                    <td className="py-2 px-3">
                      <span className={`text-sm font-bold ${change < 0 ? 'text-emerald-600' : change > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                        {change > 0 ? '+' : ''}{change.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Attestation */}
      <div className="flex items-center gap-3 mt-4 pt-3 border-t border-slate-100">
        <TEEBadge verified={simulation.status === 'completed'} />
        <TruncatedHash hash={simulation.attestation} />
      </div>
    </MedicalCard>
  );
}

// ============================================================
// ParameterSlider
// ============================================================

export function ParameterSlider({
  parameter,
  overrideValue,
  onChange,
}: {
  parameter: TwinParameter;
  overrideValue?: number;
  onChange?: (value: number) => void;
}) {
  const displayValue = overrideValue ?? parameter.currentValue;
  const isModified = overrideValue !== undefined && overrideValue !== parameter.currentValue;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 hover:border-slate-300 transition-all">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h4 className="text-sm font-semibold text-slate-900">{parameter.name}</h4>
          <span className="text-xs text-slate-400">{parameter.category}</span>
        </div>
        <div className="text-right">
          <span className={`text-lg font-bold ${isModified ? 'text-brand-600' : 'text-slate-900'}`}>
            {displayValue}
          </span>
          <span className="text-xs text-slate-400 ml-1">{parameter.unit}</span>
        </div>
      </div>

      <input
        type="range"
        min={parameter.min}
        max={parameter.max}
        step={parameter.step}
        value={displayValue}
        onChange={(e) => onChange?.(parseFloat(e.target.value))}
        className="w-full h-1.5 bg-slate-200 rounded-full appearance-none cursor-pointer accent-brand-600
          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
          [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-brand-600 [&::-webkit-slider-thumb]:shadow-sm
          [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white"
      />

      <div className="flex items-center justify-between mt-1">
        <span className="text-xs text-slate-400">{parameter.min}</span>
        {isModified && (
          <span className="text-xs text-brand-600 font-medium">
            Modified (was {parameter.currentValue})
          </span>
        )}
        <span className="text-xs text-slate-400">{parameter.max}</span>
      </div>
    </div>
  );
}

// ============================================================
// PredictionCard
// ============================================================

const RISK_VARIANTS: Record<string, string> = {
  low: 'success',
  moderate: 'warning',
  high: 'error',
};

export function PredictionCard({ prediction }: { prediction: TwinPrediction }) {
  const riskVariant = RISK_VARIANTS[prediction.riskLevel] ?? 'neutral';

  // Build mini trend data for area chart
  const trendData = [
    { label: 'Now', value: prediction.currentValue },
    { label: '30d', value: prediction.predicted30d },
    { label: '60d', value: prediction.predicted60d },
    { label: '90d', value: prediction.predicted90d },
  ];

  const allValues = trendData.map((d) => d.value);
  const minVal = Math.min(...allValues);
  const maxVal = Math.max(...allValues);
  const padding = (maxVal - minVal) * 0.2 ||
    /* istanbul ignore next */
    1;

  // Determine trend direction
  const trend90 = prediction.predicted90d - prediction.currentValue;
  const isRising = trend90 > 0;

  return (
    <MedicalCard>
      <div className="flex items-start justify-between mb-3">
        <div>
          <h4 className="text-sm font-semibold text-slate-900">{prediction.metric}</h4>
          <p className="text-xs text-slate-400">90-day forecast</p>
        </div>
        <Badge variant={riskVariant as any}>{prediction.riskLevel} risk</Badge>
      </div>

      {/* Current + predicted values */}
      <div className="grid grid-cols-4 gap-2 mb-3">
        <div className="text-center p-2 bg-slate-50 rounded-lg">
          <p className="text-xs text-slate-500">Now</p>
          <p className="text-sm font-bold text-slate-900">{prediction.currentValue}</p>
        </div>
        <div className="text-center p-2 bg-slate-50 rounded-lg">
          <p className="text-xs text-slate-500">30d</p>
          <p className="text-sm font-bold text-slate-700">{prediction.predicted30d}</p>
        </div>
        <div className="text-center p-2 bg-slate-50 rounded-lg">
          <p className="text-xs text-slate-500">60d</p>
          <p className="text-sm font-bold text-slate-700">{prediction.predicted60d}</p>
        </div>
        <div className="text-center p-2 bg-slate-50 rounded-lg">
          <p className="text-xs text-slate-500">90d</p>
          <p className={`text-sm font-bold ${prediction.riskLevel === 'high' ? 'text-rose-600' : prediction.riskLevel === 'moderate' ? 'text-amber-600' : 'text-emerald-600'}`}>
            {prediction.predicted90d}
          </p>
        </div>
      </div>

      {/* Mini area chart */}
      <div className="h-[100px] mb-3">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={trendData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
            <defs>
              <linearGradient id={`predGrad-${prediction.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={prediction.riskLevel === 'high' ? '#ef4444' : prediction.riskLevel === 'moderate' ? '#f59e0b' : '#10b981'} stopOpacity={0.3} />
                <stop offset="100%" stopColor={prediction.riskLevel === 'high' ? '#ef4444' : prediction.riskLevel === 'moderate' ? '#f59e0b' : '#10b981'} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="label"
              tick={{ fontSize: 9, fill: '#94a3b8' }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              domain={[Math.floor(minVal - padding), Math.ceil(maxVal + padding)]}
              hide
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={prediction.riskLevel === 'high' ? '#ef4444' : prediction.riskLevel === 'moderate' ? '#f59e0b' : '#10b981'}
              strokeWidth={2}
              fill={`url(#predGrad-${prediction.id})`}
              dot={{ r: 3, strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Confidence band + unit */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-slate-500">
          {prediction.unit} &middot; CI: {prediction.confidenceBand}%
        </span>
        <div className={`flex items-center gap-1 text-xs ${isRising ? 'text-rose-500' : 'text-emerald-500'}`}>
          {isRising ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
          <span className="font-medium">{isRising ? '+' : ''}{trend90.toFixed(1)}</span>
        </div>
      </div>

      {/* Recommendations */}
      <div className="border-t border-slate-100 pt-3">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">Recommendations</p>
        <ul className="space-y-1">
          {prediction.recommendations.map((rec, i) => (
            <li key={i} className="text-xs text-slate-600 flex items-start gap-1.5">
              <CheckCircle className="w-3 h-3 text-emerald-500 shrink-0 mt-0.5" />
              {rec}
            </li>
          ))}
        </ul>
      </div>
    </MedicalCard>
  );
}

// ============================================================
// TimelineEventItem
// ============================================================

const EVENT_ICON_MAP: Record<string, { icon: React.ReactNode; bg: string }> = {
  creation: { icon: <Activity className="w-4 h-4 text-brand-600" />, bg: 'bg-brand-50' },
  simulation: { icon: <Play className="w-4 h-4 text-violet-600" />, bg: 'bg-violet-50' },
  parameter_update: { icon: <Settings className="w-4 h-4 text-amber-600" />, bg: 'bg-amber-50' },
  prediction: { icon: <TrendingUp className="w-4 h-4 text-emerald-600" />, bg: 'bg-emerald-50' },
  data_sync: { icon: <RefreshCw className="w-4 h-4 text-sky-600" />, bg: 'bg-sky-50' },
};

const EVENT_TYPE_VARIANTS: Record<string, string> = {
  creation: 'brand',
  simulation: 'medical',
  parameter_update: 'warning',
  prediction: 'success',
  data_sync: 'info',
};

export function TimelineEventItem({ event }: { event: TwinTimelineEvent }) {
  const eventStyle = EVENT_ICON_MAP[event.type] ?? EVENT_ICON_MAP.creation;
  const typeVariant = EVENT_TYPE_VARIANTS[event.type] ?? 'neutral';

  return (
    <div className="flex gap-4 py-4 border-b border-slate-100 last:border-0">
      {/* Icon */}
      <div className={`w-10 h-10 rounded-xl ${eventStyle.bg} flex items-center justify-center shrink-0`}>
        {eventStyle.icon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h4 className="text-sm font-semibold text-slate-900 truncate">{event.title}</h4>
          <Badge variant={typeVariant as any}>{event.type.replace('_', ' ')}</Badge>
        </div>
        <p className="text-xs text-slate-600 line-clamp-2 mb-2">{event.description}</p>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400">
            <Clock className="w-3 h-3 inline mr-1" />
            {formatDateTime(event.timestamp)}
          </span>
          {event.attestation && (
            <TruncatedHash hash={event.attestation} startLen={8} endLen={4} />
          )}
        </div>
      </div>
    </div>
  );
}
