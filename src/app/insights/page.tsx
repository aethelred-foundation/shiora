/**
 * Shiora on Aethelred — Health Insights
 *
 * Statistical analysis of the user's OWN wearable telemetry: per-metric
 * baselines (mean ± 2σ), trends, and z-score anomalies. Non-diagnostic and
 * NOT a medical device — there is no learned prediction workload, TEE attestation, or on-chain
 * inference here, only descriptive statistics over the user's encrypted data.
 * Empty until the user has ingested wearable samples.
 */

'use client';

import {
  Activity,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  Gauge,
  Info,
} from 'lucide-react';

import {
  TopNav,
  Footer,
  ToastContainer,
  SearchOverlay,
  Badge,
} from '@/components/ui/SharedComponents';
import { MedicalCard, SectionHeader } from '@/components/ui/PagePrimitives';
import { formatNumber, timeAgo } from '@/lib/utils';
import { useInsights } from '@/hooks/useInsights';

// ============================================================
// Presentational helpers
// ============================================================

const TREND_META: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  rising: {
    label: 'Rising',
    cls: 'text-amber-600 bg-amber-50',
    icon: <TrendingUp className="w-3.5 h-3.5" />,
  },
  falling: {
    label: 'Falling',
    cls: 'text-sky-600 bg-sky-50',
    icon: <TrendingDown className="w-3.5 h-3.5" />,
  },
  stable: {
    label: 'Stable',
    cls: 'text-emerald-600 bg-emerald-50',
    icon: <Minus className="w-3.5 h-3.5" />,
  },
};

function metricLabel(metric: string): string {
  return metric.replace(/_/g, ' ');
}

// ============================================================
// Main Page
// ============================================================

export default function InsightsPage() {
  const { metrics, anomalies, anomalyCount, generatedAt, isLoading } = useInsights();

  return (
    <>
      <TopNav />
      <SearchOverlay />
      <ToastContainer />

      <main id="main-content" className="flex-1">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          {/* ─── Header ─── */}
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Activity className="w-6 h-6 text-violet-500" />
                <h1 className="text-2xl font-bold text-slate-900">Health Insights</h1>
              </div>
              <p className="text-sm text-slate-500">
                Statistical analysis of your own wearable data — baselines, trends, and anomalies.
                Non-diagnostic.
              </p>
            </div>
            <Badge variant="neutral">
              {generatedAt ? `Updated ${timeAgo(generatedAt)}` : 'Awaiting data'}
            </Badge>
          </div>

          {/* ─── Key Metrics ─── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
            <MedicalCard>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center">
                  <Gauge className="w-5 h-5 text-violet-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Metrics Tracked</p>
                  <p className="text-xl font-bold text-slate-900">{metrics.length}</p>
                </div>
              </div>
            </MedicalCard>
            <MedicalCard>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Anomalies</p>
                  <p className="text-xl font-bold text-slate-900">{anomalyCount}</p>
                </div>
              </div>
            </MedicalCard>
            <MedicalCard>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                  <Activity className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Status</p>
                  <p className="text-xl font-bold text-slate-900">
                    {isLoading ? 'Loading…' : 'Ready'}
                  </p>
                </div>
              </div>
            </MedicalCard>
          </div>

          {/* ─── Metric Insights ─── */}
          <SectionHeader
            title="Metric Insights"
            subtitle="Per-metric baseline (mean ± 2σ) and trend"
            size="sm"
          />
          {metrics.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
              {metrics.map((mi) => {
                const trend = TREND_META[mi.trend];
                return (
                  <MedicalCard key={mi.metric}>
                    <div className="flex items-start justify-between mb-3">
                      <h4 className="text-sm font-semibold text-slate-900 capitalize">
                        {metricLabel(mi.metric)}
                      </h4>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${trend.cls}`}
                      >
                        {trend.icon}
                        {trend.label}
                      </span>
                    </div>
                    <p className="text-2xl font-bold text-slate-900">{formatNumber(mi.mean)}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      mean over {mi.sampleCount} samples
                    </p>
                    <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                      <span className="text-slate-500">Baseline</span>
                      <span className="font-medium text-slate-700">
                        {formatNumber(mi.baselineLow)} – {formatNumber(mi.baselineHigh)}
                      </span>
                    </div>
                  </MedicalCard>
                );
              })}
            </div>
          ) : (
            <MedicalCard className="mb-10">
              <div className="py-10 text-center">
                <Gauge className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-sm text-slate-500">No wearable data yet.</p>
                <p className="text-xs text-slate-400 mt-1">
                  Connect a wearable to see statistical insights over your own data.
                </p>
              </div>
            </MedicalCard>
          )}

          {/* ─── Anomalies ─── */}
          <SectionHeader
            title="Anomalies"
            subtitle="Readings beyond your personal baseline (|z| > 2)"
            size="sm"
          />
          {anomalies.length > 0 ? (
            <MedicalCard padding={false} className="mb-8">
              <div className="divide-y divide-slate-100">
                {anomalies.map((a, i) => (
                  <div
                    key={`${a.metric}-${a.recordedAt}-${i}`}
                    className="px-5 py-3 flex items-center gap-3"
                  >
                    <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 capitalize">
                        {metricLabel(a.metric)}
                      </p>
                      <p className="text-xs text-slate-400">
                        {formatNumber(a.value)} · {a.zScore}σ {a.direction} baseline
                      </p>
                    </div>
                    <span className="text-xs text-slate-400 shrink-0">{timeAgo(a.recordedAt)}</span>
                  </div>
                ))}
              </div>
            </MedicalCard>
          ) : (
            <MedicalCard className="mb-8">
              <div className="py-8 text-center">
                <p className="text-sm text-slate-500">
                  No anomalies detected against your baseline.
                </p>
              </div>
            </MedicalCard>
          )}

          {/* ─── Disclaimer ─── */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-3">
            <Info className="w-5 h-5 text-slate-400 mt-0.5 shrink-0" />
            <p className="text-xs text-slate-500">
              These are descriptive statistics computed over your own wearable telemetry — not
              learned predictions, not TEE-attested, and not a medical device. They are
              informational only and are not a substitute for professional medical advice.
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}
