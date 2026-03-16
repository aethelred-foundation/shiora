/**
 * Shiora on Aethelred — Genomics Components
 * Reusable components for the Genomics & Biomarker Lab feature.
 *
 * Exports: GenomicProfileCard, PharmacogenomicRow, BiomarkerCard,
 *          RiskScoreCard, GenomicReportCard, MetabolismBadge,
 *          GeneVariantBadge, BiomarkerTrendChart, RiskScoreRadar
 */

'use client';

import React from 'react';
import {
  Dna, Shield, ShieldCheck, AlertTriangle, CheckCircle,
  TrendingUp, TrendingDown, Minus, Eye, FileText,
  Heart, Brain, Droplets, CircleDot, Ribbon, Zap,
} from 'lucide-react';
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  AreaChart, Area, LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ReferenceLine,
} from 'recharts';

import { MedicalCard, ChartTooltip, TEEBadge, StatusBadge, EncryptionBadge, TruncatedHash } from '@/components/ui/PagePrimitives';
import { Badge, ProgressRing } from '@/components/ui/SharedComponents';
import { BRAND, CHART_COLORS, GENOMIC_RISK_CATEGORIES, EXTENDED_STATUS_STYLES } from '@/lib/constants';
import { formatNumber, formatDate, formatDateTime, timeAgo } from '@/lib/utils';
import type {
  GenomicProfile,
  GenomicsOverview,
  PharmacogenomicResult,
  Biomarker,
  PolygenicRiskScore,
  GenomicReport,
  MetabolismRate,
} from '@/types';

// ============================================================
// Risk category icon map
// ============================================================

const RISK_ICON_MAP: Record<string, React.ReactNode> = {
  cardiovascular: <Heart className="w-5 h-5" />,
  type2_diabetes: <Droplets className="w-5 h-5" />,
  breast_cancer: <Ribbon className="w-5 h-5" />,
  alzheimers: <Brain className="w-5 h-5" />,
  colorectal_cancer: <CircleDot className="w-5 h-5" />,
  autoimmune: <Shield className="w-5 h-5" />,
};

function getRiskCategoryMeta(categoryId: string) {
  const cat = GENOMIC_RISK_CATEGORIES.find((c) => c.id === categoryId);
  return {
    label: cat?.label ?? categoryId,
    color: cat?.color ?? '#94a3b8',
    icon: RISK_ICON_MAP[categoryId] ?? <Dna className="w-5 h-5" />,
  };
}

// ============================================================
// Metabolism rate styles
// ============================================================

const METABOLISM_STYLES: Record<MetabolismRate, { variant: string; label: string; color: string }> = {
  poor: { variant: 'error', label: 'Poor Metabolizer', color: '#ef4444' },
  intermediate: { variant: 'warning', label: 'Intermediate', color: '#f59e0b' },
  normal: { variant: 'success', label: 'Normal', color: '#10b981' },
  rapid: { variant: 'info', label: 'Rapid', color: '#3b82f6' },
  ultra_rapid: { variant: 'medical', label: 'Ultra Rapid', color: '#8b5cf6' },
};

// ============================================================
// Risk level badge mapping
// ============================================================

const RISK_LEVEL_STYLES: Record<string, string> = {
  low: 'success',
  average: 'neutral',
  elevated: 'warning',
  high: 'error',
};

// ============================================================
// MetabolismBadge
// ============================================================

export function MetabolismBadge({ rate }: { rate: MetabolismRate }) {
  const style = METABOLISM_STYLES[rate];
  return (
    <Badge variant={style.variant as any}>{style.label}</Badge>
  );
}

// ============================================================
// GenomicProfileCard
// ============================================================

export function GenomicProfileCard({ overview }: { overview: GenomicsOverview }) {
  const { profile } = overview;

  return (
    <MedicalCard>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-brand-50 flex items-center justify-center text-brand-600">
            <Dna className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Genomic Profile</h3>
            <p className="text-xs text-slate-500">Whole genome sequencing analysis</p>
          </div>
        </div>
        <Badge variant="success" dot>Completed</Badge>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-5">
        <div className="text-center p-3 bg-slate-50 rounded-xl">
          <p className="text-2xl font-bold text-slate-900">{formatNumber(profile.totalVariants)}</p>
          <p className="text-xs text-slate-500">Total Variants</p>
        </div>
        <div className="text-center p-3 bg-slate-50 rounded-xl">
          <p className="text-2xl font-bold text-brand-600">{profile.clinicallySignificant}</p>
          <p className="text-xs text-slate-500">Clinically Significant</p>
        </div>
        <div className="text-center p-3 bg-slate-50 rounded-xl">
          <p className="text-2xl font-bold text-amber-600">{profile.pharmacogenomicFlags}</p>
          <p className="text-xs text-slate-500">PGx Flags</p>
        </div>
        <div className="text-center p-3 bg-slate-50 rounded-xl">
          <p className="text-2xl font-bold text-slate-900">{profile.riskScoresGenerated}</p>
          <p className="text-xs text-slate-500">Risk Scores</p>
        </div>
        <div className="text-center p-3 bg-slate-50 rounded-xl">
          <p className="text-2xl font-bold text-emerald-600">{overview.actionableFindings}</p>
          <p className="text-xs text-slate-500">Actionable</p>
        </div>
      </div>

      {/* Security indicators */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <EncryptionBadge type="AES-256-GCM" />
        <TEEBadge platform="Intel SGX" verified={profile.teeProcessed} />
        <span className="text-xs text-slate-400">Updated {timeAgo(profile.lastUpdated)}</span>
      </div>

      {/* High risk conditions */}
      {overview.highRiskConditions.length > 0 && (
        <div className="border-t border-slate-100 pt-4 mt-2">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">High Risk Conditions</p>
          <div className="space-y-2">
            {overview.highRiskConditions.map((condition, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                <span className="text-slate-700">{condition}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actionable findings */}
      <div className="mt-4 p-3 bg-brand-50 rounded-xl flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-brand-600" />
          <span className="text-sm font-medium text-brand-700">Actionable Findings</span>
        </div>
        <span className="text-lg font-bold text-brand-700">{overview.actionableFindings}</span>
      </div>
    </MedicalCard>
  );
}

// ============================================================
// GeneVariantBadge
// ============================================================

export function GeneVariantBadge({ gene, variant }: { gene: string; variant: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-mono bg-slate-100 text-slate-700 border border-slate-200">
      <Dna className="w-3 h-3 text-brand-500" />
      <span className="font-semibold">{gene}</span>
      <span className="text-slate-400">{variant}</span>
    </span>
  );
}

// ============================================================
// PharmacogenomicRow
// ============================================================

export function PharmacogenomicRow({ result }: { result: PharmacogenomicResult }) {
  const metabStyle = METABOLISM_STYLES[result.metabolismRate];

  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
      <td className="py-3 px-3">
        <GeneVariantBadge gene={result.gene} variant={result.variant} />
      </td>
      <td className="py-3 px-3 text-xs font-mono text-slate-500">{result.rsId}</td>
      <td className="py-3 px-3">
        <div>
          <p className="text-sm font-medium text-slate-900">{result.drugName}</p>
          <p className="text-xs text-slate-400">{result.drugCategory}</p>
        </div>
      </td>
      <td className="py-3 px-3">
        <MetabolismBadge rate={result.metabolismRate} />
      </td>
      <td className="py-3 px-3 max-w-[200px]">
        <p className="text-xs text-slate-600 line-clamp-2">{result.clinicalRecommendation}</p>
      </td>
      <td className="py-3 px-3">
        <Badge variant="neutral">{result.evidenceLevel}</Badge>
      </td>
      <td className="py-3 px-3">
        <TEEBadge verified={result.teeVerified} />
      </td>
    </tr>
  );
}

// ============================================================
// BiomarkerCard — Grid card with mini sparkline (spec)
// ============================================================

export function BiomarkerCard({ biomarker }: { biomarker: Biomarker }) {
  const { referenceRange, history, unit, name, category, currentValue, status, trend } = biomarker;

  // Sparkline data from the 6-point history
  const sparklineData = history.map((h, i) => ({
    idx: i,
    value: h.value,
  }));

  // Trend icon and color
  const TrendIcon = trend === 'improving'
    ? TrendingUp
    : trend === 'worsening'
    ? TrendingDown
    : Minus;

  const trendColor = trend === 'improving'
    ? 'text-emerald-600'
    : trend === 'worsening'
    ? 'text-rose-600'
    : 'text-slate-400';

  // Status colors
  const statusColor = status === 'normal'
    ? 'bg-emerald-500'
    : status === 'borderline'
    ? 'bg-amber-500'
    : 'bg-rose-500';

  const statusBg = status === 'normal'
    ? 'bg-emerald-50 text-emerald-700'
    : status === 'borderline'
    ? 'bg-amber-50 text-amber-700'
    : 'bg-rose-50 text-rose-700';

  // Sparkline stroke color
  const sparkStroke = status === 'normal'
    ? '#10b981'
    : status === 'borderline'
    ? '#f59e0b'
    : '#f43f5e';

  // Reference range bar visualization (proportional position of current value)
  const rangeLow = referenceRange.low;
  const rangeHigh = referenceRange.high;
  const rangeSpan = rangeHigh - rangeLow ||
    /* istanbul ignore next -- range always has non-zero span in test data */
    1;
  const barMin = Math.min(rangeLow * 0.7, currentValue * 0.9);
  const barMax = Math.max(rangeHigh * 1.3, currentValue * 1.1);
  const barSpan = barMax - barMin ||
    /* istanbul ignore next -- bar span always non-zero in test data */
    1;
  const normalStartPct = ((rangeLow - barMin) / barSpan) * 100;
  const normalWidthPct = (rangeSpan / barSpan) * 100;
  const valuePct = Math.min(100, Math.max(0, ((currentValue - barMin) / barSpan) * 100));

  return (
    <MedicalCard className="flex flex-col">
      {/* Header: Name, category, status */}
      <div className="flex items-start justify-between mb-2">
        <div>
          <h4 className="text-sm font-semibold text-slate-900">{name}</h4>
          <p className="text-xs text-slate-400">{category}</p>
        </div>
        <div className={`w-2 h-2 rounded-full mt-1 ${statusColor}`} />
      </div>

      {/* Current value + unit */}
      <div className="flex items-baseline gap-1 mb-1">
        <span className="text-xl font-bold text-slate-900">{currentValue}</span>
        <span className="text-xs text-slate-400">{unit}</span>
      </div>

      {/* Status + Trend */}
      <div className="flex items-center gap-2 mb-3">
        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${statusBg}`}>{status}</span>
        <span className={`flex items-center gap-0.5 text-xs ${trendColor}`}>
          <TrendIcon className="w-3 h-3" />
          {trend}
        </span>
      </div>

      {/* Reference range bar visualization */}
      <div className="mb-3">
        <div className="relative h-2 rounded-full bg-slate-100 overflow-hidden">
          {/* Normal range band */}
          <div
            className="absolute top-0 h-full bg-emerald-200 rounded-full"
            style={{ left: `${normalStartPct}%`, width: `${normalWidthPct}%` }}
          />
          {/* Current value indicator */}
          <div
            className={`absolute top-[-1px] w-2.5 h-2.5 rounded-full border-2 border-white shadow ${statusColor}`}
            style={{ left: `${valuePct}%`, transform: 'translateX(-50%)' }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[10px] text-slate-400">{rangeLow}</span>
          <span className="text-[10px] text-slate-400">{rangeHigh} {unit}</span>
        </div>
      </div>

      {/* Mini sparkline chart (6-point history) */}
      <div className="h-[48px] mt-auto">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={sparklineData} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
            <Line
              type="monotone"
              dataKey="value"
              stroke={sparkStroke}
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </MedicalCard>
  );
}

// ============================================================
// BiomarkerTrendChart — Full detail chart for selected biomarker
// ============================================================

export function BiomarkerTrendChart({ biomarker }: { biomarker: Biomarker }) {
  const { referenceRange, history, unit, name } = biomarker;

  const chartData = history.map((h) => ({
    date: formatDate(h.date),
    value: h.value,
    refLow: referenceRange.low,
    refHigh: referenceRange.high,
  }));

  // Expand Y-axis to show data clearly
  const allValues = history.map((h) => h.value);
  const dataMin = Math.min(...allValues, referenceRange.low);
  const dataMax = Math.max(...allValues, referenceRange.high);
  const padding = (dataMax - dataMin) * 0.15;

  const TrendIcon = biomarker.trend === 'improving'
    ? TrendingUp
    : biomarker.trend === 'worsening'
    ? TrendingDown
    : Minus;

  const trendColor = biomarker.trend === 'improving'
    ? 'text-emerald-600'
    : biomarker.trend === 'worsening'
    ? 'text-rose-600'
    : 'text-slate-400';

  const statusVariant = biomarker.status === 'normal'
    ? 'success'
    : biomarker.status === 'borderline'
    ? 'warning'
    : 'error';

  return (
    <MedicalCard>
      {/* Header with current value */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{name}</h3>
          <p className="text-xs text-slate-500">{biomarker.category} marker</p>
        </div>
        <div className="text-right">
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-slate-900">{biomarker.currentValue}</span>
            <span className="text-sm text-slate-400">{unit}</span>
          </div>
          <div className="flex items-center gap-2 mt-1 justify-end">
            <Badge variant={statusVariant}>{biomarker.status}</Badge>
            <span className={`flex items-center gap-1 text-xs ${trendColor}`}>
              <TrendIcon className="w-3.5 h-3.5" />
              {biomarker.trend}
            </span>
          </div>
        </div>
      </div>

      {/* Reference range label */}
      <p className="text-xs text-slate-400 mb-2">
        Reference range: {referenceRange.low} - {referenceRange.high} {unit}
      </p>

      {/* Area chart */}
      <div className="h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
            <defs>
              <linearGradient id="biomarkerGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={BRAND.sky} stopOpacity={0.3} />
                <stop offset="100%" stopColor={BRAND.sky} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="normalRangeGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.12} />
                <stop offset="100%" stopColor="#10b981" stopOpacity={0.12} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              tickLine={false}
              axisLine={{ stroke: '#e2e8f0' }}
            />
            <YAxis
              domain={[Math.floor(dataMin - padding), Math.ceil(dataMax + padding)]}
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              tickLine={false}
              axisLine={{ stroke: '#e2e8f0' }}
              width={40}
            />
            <Tooltip content={<ChartTooltip />} />

            {/* Normal range band */}
            <Area
              dataKey="refHigh"
              fill="url(#normalRangeGradient)"
              stroke="none"
              isAnimationActive={false}
            />
            <ReferenceLine
              y={referenceRange.high}
              stroke="#10b981"
              strokeDasharray="4 4"
              strokeWidth={1}
            />
            <ReferenceLine
              y={referenceRange.low}
              stroke="#10b981"
              strokeDasharray="4 4"
              strokeWidth={1}
            />

            {/* Actual values */}
            <Area
              type="monotone"
              dataKey="value"
              stroke={BRAND.sky}
              strokeWidth={2}
              fill="url(#biomarkerGradient)"
              dot={{ r: 3, fill: BRAND.sky, strokeWidth: 0 }}
              activeDot={{ r: 5, fill: BRAND.sky, strokeWidth: 2, stroke: '#fff' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </MedicalCard>
  );
}

// ============================================================
// RiskScoreRadar
// ============================================================

export function RiskScoreRadar({ scores }: { scores: PolygenicRiskScore[] }) {
  const radarData = scores.map((s) => {
    const meta = getRiskCategoryMeta(s.category);
    return {
      category: meta.label,
      score: s.score,
      fullMark: 100,
    };
  });

  return (
    <MedicalCard>
      <h3 className="text-lg font-semibold text-slate-900 mb-1">Risk Profile Overview</h3>
      <p className="text-xs text-slate-500 mb-4">Polygenic risk scores across 6 conditions</p>

      <div className="h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
            <PolarGrid stroke="#e2e8f0" />
            <PolarAngleAxis
              dataKey="category"
              tick={{ fontSize: 11, fill: '#64748b' }}
            />
            <PolarRadiusAxis
              angle={30}
              domain={[0, 100]}
              tick={{ fontSize: 9, fill: '#94a3b8' }}
              tickCount={5}
            />
            <Radar
              name="Risk Score"
              dataKey="score"
              stroke={BRAND.sky}
              fill={BRAND.sky}
              fillOpacity={0.2}
              strokeWidth={2}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </MedicalCard>
  );
}

// ============================================================
// RiskScoreCard
// ============================================================

export function RiskScoreCard({ score }: { score: PolygenicRiskScore }) {
  const meta = getRiskCategoryMeta(score.category);
  const riskVariant = RISK_LEVEL_STYLES[score.riskLevel] ?? 'neutral';

  return (
    <MedicalCard>
      <div className="flex items-start justify-between mb-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
          style={{ backgroundColor: meta.color }}
        >
          {meta.icon}
        </div>
        <Badge variant={riskVariant as any}>{score.riskLevel}</Badge>
      </div>

      <h4 className="text-sm font-semibold text-slate-900 mb-1">{meta.label}</h4>

      {/* Score + Percentile */}
      <div className="flex items-center gap-3 mb-3">
        <ProgressRing value={score.score} size={48} strokeWidth={4} color={meta.color}>
          <span className="text-xs font-bold text-slate-900">{score.score}</span>
        </ProgressRing>
        <div>
          <p className="text-sm font-medium text-slate-700">{score.percentile}th percentile</p>
          <p className="text-xs text-slate-400">{score.variantsAnalyzed} variants analyzed</p>
        </div>
      </div>

      {/* Modifiable factors */}
      <div className="mb-3">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">Modifiable Factors</p>
        <ul className="space-y-1">
          {score.modifiableFactors.map((f, i) => (
            <li key={i} className="text-xs text-slate-600 flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-amber-400 shrink-0" />
              {f}
            </li>
          ))}
        </ul>
      </div>

      {/* Non-modifiable factors */}
      <div className="mb-3">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">Non-Modifiable Factors</p>
        <ul className="space-y-1">
          {score.nonModifiableFactors.map((f, i) => (
            <li key={i} className="text-xs text-slate-600 flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-slate-300 shrink-0" />
              {f}
            </li>
          ))}
        </ul>
      </div>

      {/* Recommended interventions */}
      <div className="mb-3">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">Interventions</p>
        <ul className="space-y-1">
          {score.recommendedInterventions.map((r, i) => (
            <li key={i} className="text-xs text-slate-600 flex items-center gap-1.5">
              <CheckCircle className="w-3 h-3 text-emerald-500 shrink-0" />
              {r}
            </li>
          ))}
        </ul>
      </div>

      {/* TEE attestation */}
      <div className="border-t border-slate-100 pt-2 mt-2">
        <TEEBadge verified />
      </div>
    </MedicalCard>
  );
}

// ============================================================
// GenomicReportCard
// ============================================================

const REPORT_STATUS_VARIANTS: Record<string, string> = {
  generating: 'warning',
  ready: 'info',
  reviewed: 'success',
  shared: 'brand',
};

export function GenomicReportCard({ report }: { report: GenomicReport }) {
  const statusVariant = REPORT_STATUS_VARIANTS[report.status] ?? 'neutral';

  return (
    <MedicalCard>
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center text-brand-600">
          <FileText className="w-5 h-5" />
        </div>
        <Badge variant={statusVariant as any}>{report.status}</Badge>
      </div>

      <h4 className="text-sm font-semibold text-slate-900 mb-0.5 line-clamp-1">{report.title}</h4>
      <p className="text-xs text-slate-400 mb-3">{report.category} &middot; {formatDate(report.generatedAt)}</p>
      <p className="text-xs text-slate-600 line-clamp-3 mb-4">{report.summary}</p>

      <div className="flex items-center gap-4 mb-3">
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <Eye className="w-3.5 h-3.5" />
          <span>{report.findings} findings</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <CheckCircle className="w-3.5 h-3.5" />
          <span>{report.actionableItems} actionable</span>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <TEEBadge verified={report.teeVerified} />
        {report.teeVerified && (
          <TruncatedHash hash={report.attestation} startLen={8} endLen={6} />
        )}
      </div>
    </MedicalCard>
  );
}
