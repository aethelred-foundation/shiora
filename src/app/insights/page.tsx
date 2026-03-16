/**
 * Shiora on Aethelred — AI Insights Page
 *
 * TEE-verified AI health predictions including cycle tracking,
 * anomaly detection, fertility windows, and personalized recommendations.
 */

'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Brain, ShieldCheck, Cpu, Activity, TrendingUp,
  AlertTriangle, CheckCircle, Clock, Thermometer,
  Droplets, Moon, Sun, Zap, BarChart3, Eye,
  ChevronRight, RefreshCw, Sparkles, Target,
  HeartPulse, Calendar, ArrowUpRight, Stethoscope,
  Pill, Dna, Fingerprint,
} from 'lucide-react';
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  ScatterChart, Scatter, ZAxis,
} from 'recharts';

import { useApp } from '@/contexts/AppContext';
import { TopNav, Footer, ToastContainer, SearchOverlay, Badge, Tabs, ProgressRing } from '@/components/ui/SharedComponents';
import {
  MedicalCard, HealthMetricCard, SectionHeader, ChartTooltip,
  StatusBadge, TEEBadge, TruncatedHash,
} from '@/components/ui/PagePrimitives';
import ExplainabilityTab from '@/components/xai/ExplainabilityTab';
import { BRAND, CHART_COLORS, CYCLE_PHASE_COLORS, AI_MODELS } from '@/lib/constants';
import {
  seededRandom, seededInt, seededHex,
  formatNumber, formatPercent, timeAgo, formatDate,
  generateDayLabel, generateAttestation,
} from '@/lib/utils';

// ============================================================
// Mock Data Generators
// ============================================================

const SEED = 300;

function generateCyclePrediction() {
  return Array.from({ length: 35 }, (_, i) => {
    const phase = i < 5 ? 'menstrual' : i < 14 ? 'follicular' : i < 17 ? 'ovulation' : i < 28 ? 'luteal' : 'menstrual';
    const phaseInfo = CYCLE_PHASE_COLORS[phase as keyof typeof CYCLE_PHASE_COLORS];
    return {
      day: i + 1,
      label: `Day ${i + 1}`,
      temperature: parseFloat((97.0 + (phase === 'luteal' ? 0.5 : phase === 'ovulation' ? 0.6 : 0) + seededRandom(SEED + i * 2) * 0.3).toFixed(1)),
      predicted: parseFloat((97.0 + (phase === 'luteal' ? 0.5 : phase === 'ovulation' ? 0.6 : 0) + seededRandom(SEED + i * 2 + 100) * 0.25).toFixed(1)),
      fertility: phase === 'ovulation' ? 90 + seededRandom(SEED + i) * 10 : phase === 'follicular' && i > 10 ? 40 + seededRandom(SEED + i) * 30 : seededRandom(SEED + i) * 20,
      phase,
      phaseColor: phaseInfo?.stroke ||
        /* istanbul ignore next -- phaseInfo always found for seeded phases */
        BRAND.sky,
    };
  });
}

function generateAnomalies() {
  const types = ['Elevated Temperature', 'Irregular Cycle Length', 'Unusual Pattern', 'Missed Phase Detection', 'Atypical Hormone Levels'];
  const severities = ['High', 'Medium', 'Low'] as const;
  return Array.from({ length: 6 }, (_, i) => ({
    id: `anomaly-${i}`,
    type: types[i % types.length],
    description: `AI model detected ${types[i % types.length].toLowerCase()} that deviates from your personal baseline pattern by ${seededInt(SEED + i * 10, 15, 45)}%.`,
    severity: severities[i % severities.length],
    detectedAt: Date.now() - seededInt(SEED + i * 7, 1, 72) * 3600000,
    confidence: parseFloat((85 + seededRandom(SEED + i * 3) * 14).toFixed(1)),
    model: AI_MODELS[i % AI_MODELS.length].name,
    attestation: generateAttestation(SEED + i * 40),
    resolved: i > 3,
  }));
}

function generateHealthScores() {
  return [
    { metric: 'Cycle Regularity', value: 92, fullMark: 100 },
    { metric: 'Hormone Balance', value: 78, fullMark: 100 },
    { metric: 'Sleep Quality', value: 85, fullMark: 100 },
    { metric: 'Stress Level', value: 65, fullMark: 100 },
    { metric: 'Activity Level', value: 88, fullMark: 100 },
    { metric: 'Nutrition', value: 74, fullMark: 100 },
  ];
}

function generateWeeklyEnergy() {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return days.map((day, i) => ({
    day,
    energy: seededInt(SEED + i * 20, 40, 95),
    mood: seededInt(SEED + i * 20 + 1, 50, 95),
    sleep: parseFloat((5.5 + seededRandom(SEED + i * 20 + 2) * 3).toFixed(1)),
  }));
}

function generateRecentInferences() {
  return Array.from({ length: 8 }, (_, i) => ({
    id: `inf-${i}`,
    model: AI_MODELS[i % AI_MODELS.length],
    result: i % 3 === 0 ? 'Anomaly Detected' : 'Normal',
    confidence: parseFloat((88 + seededRandom(SEED + i * 5) * 11).toFixed(1)),
    timestamp: Date.now() - seededInt(SEED + i * 8, 1, 48) * 3600000,
    attestation: generateAttestation(SEED + i * 60),
    blockHeight: 2847391 - seededInt(SEED + i, 0, 200),
  }));
}

// ============================================================
// Sub-components
// ============================================================

function InsightCard({
  icon,
  title,
  value,
  subtitle,
  color,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  subtitle: string;
  color: string;
}) {
  return (
    <MedicalCard>
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center`}>
          {icon}
        </div>
        <TEEBadge verified />
      </div>
      <p className="text-xs text-slate-500 mb-1">{title}</p>
      <p className="text-2xl font-bold text-slate-900 mb-0.5">{value}</p>
      <p className="text-xs text-slate-400">{subtitle}</p>
    </MedicalCard>
  );
}

// ============================================================
// Main Page
// ============================================================

export default function InsightsPage() {
  const { teeState } = useApp();

  const [activeTab, setActiveTab] = useState('overview');
  const cyclePrediction = useMemo(() => generateCyclePrediction(), []);
  const anomalies = useMemo(() => generateAnomalies(), []);
  const healthScores = useMemo(() => generateHealthScores(), []);
  const weeklyEnergy = useMemo(() => generateWeeklyEnergy(), []);
  const recentInferences = useMemo(() => generateRecentInferences(), []);

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'cycle', label: 'Cycle Tracking' },
    { id: 'anomalies', label: 'Anomalies', count: anomalies.filter((a) => !a.resolved).length },
    { id: 'clinical', label: 'Clinical AI' },
    { id: 'models', label: 'AI Models' },
    { id: 'explainability', label: 'Explainability' },
  ];

  const nextPeriod = 12;
  const fertileWindowStart = 8;

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
                <Brain className="w-6 h-6 text-violet-500" />
                <h1 className="text-2xl font-bold text-slate-900">AI Insights</h1>
              </div>
              <p className="text-sm text-slate-500">
                TEE-verified health analytics powered by machine learning models running inside secure enclaves
              </p>
            </div>
            <div className="flex items-center gap-3">
              <StatusBadge status={teeState.status === 'operational' ? 'Operational' :
                /* istanbul ignore next -- teeState is always operational in test */
                'Degraded'} />
              <Badge variant="medical">
                <Cpu className="w-3 h-3 mr-1" />
                {teeState.platform}
              </Badge>
            </div>
          </div>

          {/* ─── Key Metrics ─── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
            <InsightCard
              icon={<Calendar className="w-5 h-5 text-rose-600" />}
              title="Next Period"
              value={`${nextPeriod} days`}
              subtitle="LSTM prediction • 96.2% confidence"
              color="bg-rose-50"
            />
            <InsightCard
              icon={<Target className="w-5 h-5 text-violet-600" />}
              title="Fertile Window"
              value={`Day ${fertileWindowStart}-${fertileWindowStart + 5}`}
              subtitle="XGBoost model • 91.5% accuracy"
              color="bg-violet-50"
            />
            <InsightCard
              icon={<AlertTriangle className="w-5 h-5 text-amber-600" />}
              title="Active Anomalies"
              value={anomalies.filter((a) => !a.resolved).length.toString()}
              subtitle="Isolation Forest detection"
              color="bg-amber-50"
            />
            <InsightCard
              icon={<Sparkles className="w-5 h-5 text-emerald-600" />}
              title="Health Score"
              value="82/100"
              subtitle="Transformer model analysis"
              color="bg-emerald-50"
            />
          </div>

          {/* ─── Tabs ─── */}
          <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} className="mb-8" />

          {/* ─── Overview Tab ─── */}
          {activeTab === 'overview' && (
            <div className="space-y-8">
              {/* Cycle + Radar Row */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Cycle prediction chart */}
                <MedicalCard className="lg:col-span-2" padding={false}>
                  <div className="p-5 pb-0">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-base font-semibold text-slate-900">Cycle Prediction</h3>
                        <p className="text-xs text-slate-400 mt-0.5">Actual vs predicted basal body temperature</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: BRAND.sky }} />
                          <span className="text-2xs text-slate-500">Actual</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full border-2" style={{ borderColor: '#a78bfa' }} />
                          <span className="text-2xs text-slate-500">Predicted</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="px-2 pb-4 pt-2">
                    <ResponsiveContainer width="100%" height={240}>
                      <LineChart data={cyclePrediction} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#94a3b8' }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} interval={4} />
                        <YAxis domain={[96.5, 98.5]} tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                        <Tooltip content={<ChartTooltip formatValue={(v) => `${v}°F`} />} />
                        <Line type="monotone" dataKey="temperature" stroke={BRAND.sky} strokeWidth={2} dot={false} name="Actual" />
                        <Line type="monotone" dataKey="predicted" stroke="#a78bfa" strokeWidth={2} strokeDasharray="5 5" dot={false} name="Predicted" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </MedicalCard>

                {/* Health Score Radar */}
                <MedicalCard padding={false}>
                  <div className="p-5 pb-0">
                    <h3 className="text-base font-semibold text-slate-900">Health Score</h3>
                    <p className="text-xs text-slate-400 mt-0.5">AI-generated wellness profile</p>
                  </div>
                  <div className="px-2 pb-4 pt-2">
                    <ResponsiveContainer width="100%" height={240}>
                      <RadarChart outerRadius={80} data={healthScores}>
                        <PolarGrid stroke="#e2e8f0" />
                        <PolarAngleAxis dataKey="metric" tick={{ fontSize: 9, fill: '#64748b' }} />
                        <PolarRadiusAxis tick={false} axisLine={false} domain={[0, 100]} />
                        <Radar name="Score" dataKey="value" stroke={BRAND.sky} fill={BRAND.sky} fillOpacity={0.2} strokeWidth={2} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </MedicalCard>
              </div>

              {/* Weekly Energy + Recent Inferences */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Weekly Energy */}
                <MedicalCard padding={false}>
                  <div className="p-5 pb-0">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-base font-semibold text-slate-900">Weekly Wellness</h3>
                        <p className="text-xs text-slate-400 mt-0.5">Energy and mood tracking</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS[0] }} />
                          <span className="text-2xs text-slate-500">Energy</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS[5] }} />
                          <span className="text-2xs text-slate-500">Mood</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="px-2 pb-4 pt-2">
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={weeklyEnergy} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
                        <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} domain={[0, 100]} />
                        <Tooltip content={<ChartTooltip />} />
                        <Bar dataKey="energy" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} barSize={12} name="Energy" />
                        <Bar dataKey="mood" fill={CHART_COLORS[5]} radius={[4, 4, 0, 0]} barSize={12} name="Mood" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </MedicalCard>

                {/* Recent Inferences */}
                <MedicalCard padding={false}>
                  <div className="p-5 pb-3">
                    <h3 className="text-base font-semibold text-slate-900">Recent Inferences</h3>
                    <p className="text-xs text-slate-400 mt-0.5">TEE-verified AI computations</p>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {recentInferences.slice(0, 6).map((inf) => (
                      <div key={inf.id} className="px-5 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          inf.result === 'Normal' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                        }`}>
                          {inf.result === 'Normal' ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900">{inf.model.name}</p>
                          <p className="text-xs text-slate-400">{inf.result} • {inf.confidence}% confidence</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs text-slate-400">{timeAgo(inf.timestamp)}</p>
                          <p className="text-2xs text-slate-300">Block #{inf.blockHeight}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </MedicalCard>
              </div>
            </div>
          )}

          {/* ─── Cycle Tracking Tab ─── */}
          {activeTab === 'cycle' && (
            <div className="space-y-8">
              {/* Phase Legend */}
              <div className="flex flex-wrap items-center gap-4 p-4 bg-white border border-slate-200 rounded-2xl">
                <span className="text-sm font-medium text-slate-700">Cycle Phases:</span>
                {Object.values(CYCLE_PHASE_COLORS).map((phase) => (
                  <div key={phase.label} className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: phase.stroke }} />
                    <span className="text-sm text-slate-600">{phase.label}</span>
                  </div>
                ))}
              </div>

              {/* Temperature + Fertility */}
              <MedicalCard padding={false}>
                <div className="p-5 pb-0">
                  <h3 className="text-base font-semibold text-slate-900">Temperature & Fertility Window</h3>
                  <p className="text-xs text-slate-400 mt-0.5">LSTM-predicted cycle with fertility probability overlay</p>
                </div>
                <div className="px-2 pb-4 pt-2">
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={cyclePrediction} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                      <defs>
                        <linearGradient id="fertilityGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#a78bfa" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#94a3b8' }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} interval={3} />
                      <YAxis yAxisId="temp" domain={[96.5, 98.5]} tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                      <YAxis yAxisId="fertility" orientation="right" domain={[0, 100]} tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                      <Tooltip content={<ChartTooltip />} />
                      <Area yAxisId="fertility" type="monotone" dataKey="fertility" stroke="#a78bfa" fill="url(#fertilityGrad)" strokeWidth={1.5} name="Fertility %" />
                      <Line yAxisId="temp" type="monotone" dataKey="temperature" stroke={BRAND.sky} strokeWidth={2} dot={false} name="Temperature °F" />
                      <Line yAxisId="temp" type="monotone" dataKey="predicted" stroke="#f43f5e" strokeWidth={2} strokeDasharray="5 5" dot={false} name="Predicted °F" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </MedicalCard>

              {/* Cycle Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <MedicalCard>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center">
                      <Droplets className="w-5 h-5 text-rose-500" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Average Cycle Length</p>
                      <p className="text-xl font-bold text-slate-900">28.3 days</p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400">Based on 12 tracked cycles</p>
                </MedicalCard>
                <MedicalCard>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center">
                      <Thermometer className="w-5 h-5 text-brand-500" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Avg BBT Shift</p>
                      <p className="text-xl font-bold text-slate-900">+0.5°F</p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400">Post-ovulation thermal shift</p>
                </MedicalCard>
                <MedicalCard>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center">
                      <Target className="w-5 h-5 text-violet-500" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Prediction Accuracy</p>
                      <p className="text-xl font-bold text-slate-900">96.2%</p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400">LSTM model v2.1 accuracy</p>
                </MedicalCard>
              </div>
            </div>
          )}

          {/* ─── Anomalies Tab ─── */}
          {activeTab === 'anomalies' && (
            <div className="space-y-6">
              {anomalies.map((anomaly) => (
                <MedicalCard key={anomaly.id}>
                  <div className="flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      anomaly.severity === 'High' ? 'bg-rose-50 text-rose-600' :
                      anomaly.severity === 'Medium' ? 'bg-amber-50 text-amber-600' :
                      'bg-brand-50 text-brand-600'
                    }`}>
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-sm font-semibold text-slate-900">{anomaly.type}</h4>
                        <StatusBadge status={anomaly.severity} />
                        {anomaly.resolved && <Badge variant="success">Resolved</Badge>}
                      </div>
                      <p className="text-sm text-slate-600 mb-3">{anomaly.description}</p>
                      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
                        <span className="flex items-center gap-1">
                          <Brain className="w-3 h-3" /> {anomaly.model}
                        </span>
                        <span className="flex items-center gap-1">
                          <BarChart3 className="w-3 h-3" /> {anomaly.confidence}% confidence
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {timeAgo(anomaly.detectedAt)}
                        </span>
                      </div>
                      <div className="mt-3 pt-3 border-t border-slate-100">
                        <p className="text-xs text-slate-400 mb-1">TEE Attestation</p>
                        <TruncatedHash hash={anomaly.attestation} startLen={14} endLen={8} />
                      </div>
                    </div>
                  </div>
                </MedicalCard>
              ))}
            </div>
          )}

          {/* ─── Clinical AI Tab ─── */}
          {activeTab === 'clinical' && (
            <div className="space-y-8">
              {/* Risk Score Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <MedicalCard>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center">
                      <HeartPulse className="w-5 h-5 text-rose-500" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Cardiovascular Risk</p>
                      <p className="text-xl font-bold text-slate-900">Low</p>
                    </div>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 mb-2">
                    <div className="bg-emerald-500 h-2 rounded-full" style={{ width: '22%' }} />
                  </div>
                  <p className="text-xs text-slate-400">Score: 22/100 — 15th percentile</p>
                  <TEEBadge verified className="mt-2" />
                </MedicalCard>
                <MedicalCard>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                      <Activity className="w-5 h-5 text-amber-500" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Metabolic Risk</p>
                      <p className="text-xl font-bold text-slate-900">Moderate</p>
                    </div>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 mb-2">
                    <div className="bg-amber-500 h-2 rounded-full" style={{ width: '48%' }} />
                  </div>
                  <p className="text-xs text-slate-400">Score: 48/100 — 52nd percentile</p>
                  <TEEBadge verified className="mt-2" />
                </MedicalCard>
                <MedicalCard>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center">
                      <Dna className="w-5 h-5 text-violet-500" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Oncology Risk</p>
                      <p className="text-xl font-bold text-slate-900">Low</p>
                    </div>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 mb-2">
                    <div className="bg-emerald-500 h-2 rounded-full" style={{ width: '15%' }} />
                  </div>
                  <p className="text-xs text-slate-400">Score: 15/100 — 8th percentile</p>
                  <TEEBadge verified className="mt-2" />
                </MedicalCard>
              </div>

              {/* Treatment Effectiveness + Drug Warnings */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <MedicalCard>
                  <h3 className="text-base font-semibold text-slate-900 mb-1">Treatment Effectiveness</h3>
                  <p className="text-xs text-slate-400 mb-4">AI-predicted treatment response based on your health twin</p>
                  <div className="space-y-3">
                    {[
                      { treatment: 'Metformin 500mg', effectiveness: 87, status: 'Optimal' },
                      { treatment: 'Lisinopril 10mg', effectiveness: 92, status: 'Optimal' },
                      { treatment: 'Atorvastatin 20mg', effectiveness: 78, status: 'Good' },
                      { treatment: 'Vitamin D 2000 IU', effectiveness: 65, status: 'Moderate' },
                    ].map((t) => (
                      <div key={t.treatment} className="flex items-center gap-3">
                        <Pill className="w-4 h-4 text-brand-500 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm text-slate-700">{t.treatment}</span>
                            <span className={`text-xs font-medium ${t.effectiveness >= 85 ? 'text-emerald-600' : t.effectiveness >= 70 ? 'text-brand-600' : 'text-amber-600'}`}>
                              {t.status} ({t.effectiveness}%)
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-1.5">
                            <div
                              className={`h-1.5 rounded-full ${t.effectiveness >= 85 ? 'bg-emerald-500' : t.effectiveness >= 70 ? 'bg-brand-500' : 'bg-amber-500'}`}
                              style={{ width: `${t.effectiveness}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </MedicalCard>

                <MedicalCard>
                  <h3 className="text-base font-semibold text-slate-900 mb-1">Drug Interaction Warnings</h3>
                  <p className="text-xs text-slate-400 mb-4">Based on your current medication profile</p>
                  <div className="space-y-3">
                    <div className="p-3 bg-rose-50 rounded-xl border border-rose-200">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-rose-900">Warfarin + Aspirin</p>
                          <p className="text-xs text-rose-700 mt-0.5">Major: Increased bleeding risk. Monitor INR closely.</p>
                        </div>
                      </div>
                    </div>
                    <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-amber-900">Metformin + Contrast Dye</p>
                          <p className="text-xs text-amber-700 mt-0.5">Moderate: Hold metformin 48h before/after contrast imaging.</p>
                        </div>
                      </div>
                    </div>
                    <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                      <div className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-emerald-900">All other combinations safe</p>
                          <p className="text-xs text-emerald-700 mt-0.5">No additional interactions detected in your medication profile.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 flex justify-end">
                    <Link href="/clinical" className="text-xs text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1">
                      Full Clinical Analysis <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </MedicalCard>
              </div>

              {/* Cross-links */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Link href="/clinical">
                  <MedicalCard className="group">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center">
                        <Stethoscope className="w-5 h-5 text-rose-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-slate-900 group-hover:text-brand-600 transition-colors">Clinical Decision Support</p>
                        <p className="text-xs text-slate-400">Pathways, interactions, differentials</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-brand-500" />
                    </div>
                  </MedicalCard>
                </Link>
                <Link href="/twin">
                  <MedicalCard className="group">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-cyan-50 flex items-center justify-center">
                        <Fingerprint className="w-5 h-5 text-cyan-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-slate-900 group-hover:text-brand-600 transition-colors">Digital Health Twin</p>
                        <p className="text-xs text-slate-400">Simulations, predictions, what-if</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-brand-500" />
                    </div>
                  </MedicalCard>
                </Link>
                <Link href="/genomics">
                  <MedicalCard className="group">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-fuchsia-50 flex items-center justify-center">
                        <Dna className="w-5 h-5 text-fuchsia-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-slate-900 group-hover:text-brand-600 transition-colors">Genomics Lab</p>
                        <p className="text-xs text-slate-400">Pharmacogenomics, risk scores</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-brand-500" />
                    </div>
                  </MedicalCard>
                </Link>
              </div>
            </div>
          )}

          {/* ─── Explainability Tab ─── */}
          {activeTab === 'explainability' && (
            <ExplainabilityTab />
          )}

          {/* ─── Models Tab ─── */}
          {activeTab === 'models' && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {AI_MODELS.map((model) => (
                  <MedicalCard key={model.id}>
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-violet-50 flex items-center justify-center">
                          <Brain className="w-6 h-6 text-violet-600" />
                        </div>
                        <div>
                          <h4 className="text-base font-semibold text-slate-900">{model.name}</h4>
                          <p className="text-xs text-slate-400">{model.type} Architecture</p>
                        </div>
                      </div>
                      <Badge variant="medical">{model.version}</Badge>
                    </div>
                    <p className="text-sm text-slate-600 mb-4">{model.description}</p>
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      <div className="bg-slate-50 rounded-xl p-3 text-center">
                        <p className="text-xs text-slate-400">Accuracy</p>
                        <p className="text-lg font-bold text-emerald-600">{model.accuracy}%</p>
                      </div>
                      <div className="bg-slate-50 rounded-xl p-3 text-center">
                        <p className="text-xs text-slate-400">Inferences</p>
                        <p className="text-lg font-bold text-slate-900">{formatNumber(seededInt(SEED + model.accuracy, 2000, 8000))}</p>
                      </div>
                      <div className="bg-slate-50 rounded-xl p-3 text-center">
                        <p className="text-xs text-slate-400">Latency</p>
                        <p className="text-lg font-bold text-slate-900">{seededInt(SEED + model.accuracy * 2, 80, 350)}ms</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <TEEBadge platform="Intel SGX" verified />
                      <StatusBadge status="Active" />
                    </div>
                  </MedicalCard>
                ))}
              </div>

              {/* TEE Info */}
              <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-2xl">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
                  <div>
                    <h4 className="text-sm font-semibold text-emerald-900 mb-1">TEE-Verified Inference</h4>
                    <p className="text-sm text-emerald-700">
                      All AI models execute inside Intel SGX / AWS Nitro secure enclaves. Each inference produces a
                      cryptographic attestation that proves the computation was performed correctly on unmodified model
                      weights with your encrypted data — without exposing any data outside the enclave.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </>
  );
}
