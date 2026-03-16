'use client';

import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Cell,
  ReferenceLine,
} from 'recharts';
import {
  Brain, ShieldCheck, AlertTriangle, CheckCircle,
  Info, ChevronRight, FileText, Target,
} from 'lucide-react';

import type {
  SHAPValue,
  FeatureImportance,
  ModelCard,
  BiasReport,
} from '@/types';
import { MedicalCard, StatusBadge } from '@/components/ui/PagePrimitives';
import { Badge } from '@/components/ui/SharedComponents';
import { ChartTooltip } from '@/components/ui/PagePrimitives';
import { BRAND } from '@/lib/constants';
import { formatNumber, formatDate } from '@/lib/utils';

// ============================================================
// SHAPWaterfall
// ============================================================

interface SHAPWaterfallProps {
  shapValues: SHAPValue[];
  className?: string;
}

export function SHAPWaterfall({ shapValues, className }: SHAPWaterfallProps) {
  const sorted = [...shapValues].sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution)).slice(0, 10);
  const data = sorted.map((sv) => ({
    feature: sv.feature,
    contribution: parseFloat((sv.contribution * 100).toFixed(2)),
    fill: sv.contribution >= 0 ? '#8B1538' : '#f43f5e',
  }));

  return (
    <MedicalCard className={className} padding={false}>
      <div className="p-5 pb-0">
        <h3 className="text-base font-semibold text-slate-900">SHAP Feature Contributions</h3>
        <p className="text-xs text-slate-400 mt-0.5">Impact of each feature on the prediction</p>
      </div>
      <div className="px-2 pb-4 pt-2">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 100, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
            <YAxis type="category" dataKey="feature" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} width={95} />
            <Tooltip content={<ChartTooltip formatValue={/* istanbul ignore next -- formatter callback not invoked in test */ (v) => `${Number(v) > 0 ? '+' : ''}${v}%`} />} />
            <ReferenceLine x={0} stroke="#94a3b8" strokeWidth={1} />
            <Bar dataKey="contribution" radius={[0, 4, 4, 0]} barSize={14} name="Contribution">
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="px-5 pb-4 flex items-center gap-4 text-xs text-slate-400">
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm bg-[#8B1538]" />
          Positive contribution
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm bg-[#f43f5e]" />
          Negative contribution
        </span>
      </div>
    </MedicalCard>
  );
}

// ============================================================
// FeatureImportanceChart
// ============================================================

interface FeatureImportanceChartProps {
  features: FeatureImportance[];
  className?: string;
}

export function FeatureImportanceChart({ features, className }: FeatureImportanceChartProps) {
  const sorted = [...features].sort((a, b) => b.importance - a.importance).slice(0, 10);
  const data = sorted.map((f) => ({
    feature: f.feature,
    importance: parseFloat((f.importance * 100).toFixed(2)),
    fill: f.direction === 'positive' ? '#10b981' : f.direction === 'negative' ? '#f43f5e' : '#94a3b8',
  }));

  return (
    <MedicalCard className={className} padding={false}>
      <div className="p-5 pb-0">
        <h3 className="text-base font-semibold text-slate-900">Feature Importance</h3>
        <p className="text-xs text-slate-400 mt-0.5">Relative importance of each input feature</p>
      </div>
      <div className="px-2 pb-4 pt-2">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 100, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} domain={[0, 'auto']} />
            <YAxis type="category" dataKey="feature" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} width={95} />
            <Tooltip content={<ChartTooltip formatValue={/* istanbul ignore next -- formatter callback not invoked in JSDOM */ (v) => `${v}%`} />} />
            <Bar dataKey="importance" radius={[0, 4, 4, 0]} barSize={14} name="Importance">
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="px-5 pb-4 flex items-center gap-4 text-xs text-slate-400">
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
          Positive
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm bg-red-500" />
          Negative
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm bg-slate-400" />
          Neutral
        </span>
      </div>
    </MedicalCard>
  );
}

// ============================================================
// ModelCardViewer
// ============================================================

interface ModelCardViewerProps {
  card: ModelCard;
  className?: string;
}

export function ModelCardViewer({ card, className }: ModelCardViewerProps) {
  return (
    <MedicalCard className={className}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-violet-50 flex items-center justify-center">
            <Brain className="w-6 h-6 text-violet-600" />
          </div>
          <div>
            <h4 className="text-base font-semibold text-slate-900">{card.name}</h4>
            <p className="text-xs text-slate-400">{card.architecture} Architecture</p>
          </div>
        </div>
        <Badge variant="medical">{card.version}</Badge>
      </div>

      <p className="text-sm text-slate-600 mb-4">{card.description}</p>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-slate-50 rounded-xl p-3 text-center">
          <p className="text-2xs text-slate-400">Accuracy</p>
          <p className="text-lg font-bold text-emerald-600">{card.validationAccuracy}%</p>
        </div>
        <div className="bg-slate-50 rounded-xl p-3 text-center">
          <p className="text-2xs text-slate-400">Training Data</p>
          <p className="text-lg font-bold text-slate-900">{formatNumber(card.trainingDataSize)}</p>
        </div>
        <div className="bg-slate-50 rounded-xl p-3 text-center">
          <p className="text-2xs text-slate-400">Last Updated</p>
          <p className="text-xs font-bold text-slate-900 mt-1">{formatDate(card.lastUpdated)}</p>
        </div>
      </div>

      {/* Fairness metrics */}
      <div className="mb-4">
        <p className="text-xs font-medium text-slate-700 mb-2">Fairness Metrics</p>
        <div className="space-y-2">
          {[
            { label: 'Demographic Parity', value: card.fairnessMetrics.demographicParity },
            { label: 'Equalized Odds', value: card.fairnessMetrics.equalizedOdds },
            { label: 'Calibration', value: card.fairnessMetrics.calibration },
          ].map((metric) => (
            <div key={metric.label} className="flex items-center justify-between">
              <span className="text-xs text-slate-500">{metric.label}</span>
              <div className="flex items-center gap-2">
                <div className="w-20 bg-slate-100 rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full ${metric.value >= 0.9 ? 'bg-emerald-500' : metric.value >= 0.8 ? 'bg-amber-500' : 'bg-red-500'}`}
                    style={{ width: `${metric.value * 100}%` }}
                  />
                </div>
                <span className="text-xs font-medium text-slate-700 w-10 text-right">{(metric.value * 100).toFixed(1)}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Intended use */}
      <div className="mb-4">
        <p className="text-xs font-medium text-slate-700 mb-1">Intended Use</p>
        <p className="text-xs text-slate-500">{card.intendedUse}</p>
      </div>

      {/* Limitations */}
      <div>
        <p className="text-xs font-medium text-slate-700 mb-1">Known Limitations</p>
        <ul className="space-y-1">
          {card.limitations.map((lim, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-slate-500">
              <AlertTriangle className="w-3 h-3 text-amber-500 mt-0.5 shrink-0" />
              {lim}
            </li>
          ))}
        </ul>
      </div>
    </MedicalCard>
  );
}

// ============================================================
// BiasHeatmap
// ============================================================

interface BiasHeatmapProps {
  report: BiasReport;
  className?: string;
}

export function BiasHeatmap({ report, className }: BiasHeatmapProps) {
  const getColor = (score: number): string => {
    if (score < 0.05) return 'bg-emerald-100 text-emerald-800';
    if (score < 0.1) return 'bg-emerald-50 text-emerald-700';
    if (score < 0.15) return 'bg-amber-50 text-amber-700';
    return 'bg-red-50 text-red-700';
  };

  return (
    <MedicalCard className={className}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h4 className="text-sm font-semibold text-slate-900">Bias Analysis</h4>
          <p className="text-xs text-slate-400">Bias scores per demographic category</p>
        </div>
        <Badge variant={report.overallBiasScore < 0.1 ? 'success' : 'warning'}>
          Overall: {(report.overallBiasScore * 100).toFixed(1)}%
        </Badge>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {report.categories.map((cat) => (
          <div
            key={cat.category}
            className={`p-3 rounded-xl text-center ${getColor(cat.biasScore)}`}
          >
            <p className="text-2xs font-medium mb-1 truncate">{cat.category}</p>
            <p className="text-lg font-bold">{(cat.biasScore * 100).toFixed(1)}%</p>
            <p className="text-2xs opacity-70">n={cat.sampleSize}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 pt-3 border-t border-slate-100">
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-100" /> &lt;5% Low</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-50 border border-emerald-200" /> 5-10%</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-amber-50 border border-amber-200" /> 10-15%</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-red-50 border border-red-200" /> &gt;15% High</span>
        </div>
      </div>
    </MedicalCard>
  );
}

// ============================================================
// DecisionPath
// ============================================================

interface DecisionPathProps {
  steps: string[];
  className?: string;
}

export function DecisionPath({ steps, className }: DecisionPathProps) {
  return (
    <MedicalCard className={className}>
      <h4 className="text-sm font-semibold text-slate-900 mb-4">Decision Path</h4>
      <div className="space-y-0">
        {steps.map((step, i) => (
          <div key={i} className="flex items-start gap-3">
            <div className="flex flex-col items-center">
              <div className="w-6 h-6 rounded-full bg-brand-500 text-white flex items-center justify-center shrink-0">
                <span className="text-2xs font-bold">{i + 1}</span>
              </div>
              {i < steps.length - 1 && (
                <div className="w-0.5 h-6 bg-brand-200" />
              )}
            </div>
            <p className="text-xs text-slate-600 pt-1">{step}</p>
          </div>
        ))}
      </div>
    </MedicalCard>
  );
}
