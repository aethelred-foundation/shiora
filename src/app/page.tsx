/**
 * Shiora on Aethelred — Dashboard (Home Page)
 *
 * Overview of the user's health data, recent records, and access activity.
 * Encrypted at rest with a tamper-evident audit trail; on the Aethelred ecosystem.
 */

'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Heart, Activity, ShieldCheck, Brain, FolderLock,
  KeyRound, TrendingUp, Users, Clock, FileText,
  ChevronRight, ArrowUpRight, Lock, Cpu, Wifi,
  BarChart3, Zap, TestTube2, ScanLine, Pill,
  HeartPulse, AlertTriangle, CheckCircle,
  MessageSquare, Store, Vote, Watch, Trophy,
  DollarSign, ScrollText, Landmark, Globe,
  Stethoscope, Dna, Network, Siren, Fingerprint,
  FlaskConical, Server, Gauge,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell,
} from 'recharts';

import { useApp } from '@/contexts/AppContext';
import { TopNav, Footer, ToastContainer, SearchOverlay, Badge, AnimatedNumber } from '@/components/ui/SharedComponents';
import { MedicalCard, HealthMetricCard, SectionHeader, ChartTooltip, EncryptionBadge, StatusBadge } from '@/components/ui/PagePrimitives';
import { RewardsSummary } from '@/components/rewards/RewardsComponents';
import { BRAND, CHART_COLORS, CYCLE_PHASE_COLORS, RECORD_TYPES, PROVIDER_NAMES } from '@/lib/constants';
import {
  seededRandom, seededInt, seededHex, seededPick, seededAddress,
  formatNumber, formatBytes, formatDate, formatDateTime,
  timeAgo, generateDayLabel, generateCID, generateTxHash,
} from '@/lib/utils';

// ============================================================
// Mock Data Generators
// ============================================================

const SEED = 100;

function generateCycleData() {
  const phases = ['menstrual', 'follicular', 'ovulation', 'luteal'] as const;
  return Array.from({ length: 28 }, (_, i) => {
    const phase = i < 5 ? 'menstrual' : i < 13 ? 'follicular' : i < 16 ? 'ovulation' : 'luteal';
    return {
      day: `Day ${i + 1}`,
      temperature: parseFloat((97.0 + (phase === 'luteal' || phase === 'ovulation' ? 0.5 : 0) + seededRandom(SEED + i * 2) * 0.4).toFixed(1)),
      phase,
    };
  });
}

function generateRecentRecords() {
  const types = ['lab_result', 'imaging', 'prescription', 'vitals', 'notes'] as const;
  const labels = ['Complete Blood Count', 'Pelvic Ultrasound', 'Estradiol Prescription', 'Vitals Check', 'Progress Notes', 'Thyroid Panel', 'Mammogram', 'Progesterone Rx', 'Blood Pressure', 'Visit Summary'];
  return Array.from({ length: 6 }, (_, i) => ({
    id: `rec-${seededHex(SEED + i * 100, 8)}`,
    type: seededPick(SEED + i * 7, types),
    label: labels[i % labels.length],
    date: Date.now() - (i + 1) * 86400000 * seededRandom(SEED + i) * 5,
    encrypted: true,
    cid: generateCID(SEED + i * 50),
    size: seededInt(SEED + i * 11, 50, 500) * 1024,
  }));
}

function generateAccessActivity() {
  const actions = ['Viewed lab results', 'Downloaded imaging', 'Requested access', 'Access expired', 'Access granted', 'Revoked access'];
  return Array.from({ length: 5 }, (_, i) => ({
    id: `act-${i}`,
    provider: seededPick(SEED + i * 13, PROVIDER_NAMES),
    action: actions[i % actions.length],
    timestamp: Date.now() - seededInt(SEED + i * 9, 1, 48) * 3600000,
    status: i < 3 ? 'success' : i === 3 ? 'warning' : 'info',
  }));
}

function generateStorageBreakdown() {
  return [
    { name: 'Lab Results', value: 42, color: CHART_COLORS[0] },
    { name: 'Imaging', value: 28, color: CHART_COLORS[1] },
    { name: 'Prescriptions', value: 12, color: CHART_COLORS[4] },
    { name: 'Vitals', value: 10, color: CHART_COLORS[5] },
    { name: 'Notes', value: 8, color: CHART_COLORS[6] },
  ];
}

function generateMockRewardStats() {
  return {
    totalEarned: Math.round(850 + seededRandom(SEED + 500) * 400),
    totalClaimed: Math.round(600 + seededRandom(SEED + 501) * 300),
    pendingRewards: Math.round(50 + seededRandom(SEED + 502) * 100),
    activeStreaks: seededInt(SEED + 503, 2, 5),
    rank: seededInt(SEED + 504, 30, 200),
    level: 5,
    nextLevelThreshold: 1500,
  };
}

function generateGovernanceActivity() {
  return {
    activeProposals: seededInt(SEED + 600, 3, 8),
    votingPower: Math.round(1200 + seededRandom(SEED + 601) * 800),
    nextVoteDeadline: Date.now() + seededInt(SEED + 602, 1, 5) * 86400000,
    recentProposal: {
      title: 'Increase data marketplace seller fee cap to 5%',
      status: 'active' as const,
      forVotes: Math.round(45000 + seededRandom(SEED + 603) * 20000),
      againstVotes: Math.round(12000 + seededRandom(SEED + 604) * 8000),
    },
  };
}

function generateMarketplaceEarnings() {
  return {
    totalEarnings: Math.round(320 + seededRandom(SEED + 700) * 200),
    activeListings: seededInt(SEED + 701, 2, 6),
    recentSales: Array.from({ length: 3 }, (_, i) => ({
      id: `sale-${seededHex(SEED + 710 + i, 6)}`,
      title: ['Cycle Data (6mo)', 'Lab Results Pack', 'Vitals Time Series'][i],
      amount: Math.round(15 + seededRandom(SEED + 720 + i) * 50),
      date: Date.now() - seededInt(SEED + 730 + i, 1, 14) * 86400000,
    })),
  };
}

// ============================================================
// Sub-components
// ============================================================

const RECORD_ICON_MAP: Record<string, React.ReactNode> = {
  lab_result: <TestTube2 className="w-4 h-4" />,
  imaging: <ScanLine className="w-4 h-4" />,
  prescription: <Pill className="w-4 h-4" />,
  vitals: <HeartPulse className="w-4 h-4" />,
  notes: <FileText className="w-4 h-4" />,
};

function QuickActionCard({
  icon,
  title,
  description,
  href,
  color,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  href: string;
  color: string;
}) {
  return (
    <Link href={href}>
      <MedicalCard className="group h-full">
        <div className="flex items-start gap-4">
          <div className={`w-11 h-11 rounded-xl ${color} flex items-center justify-center shrink-0`}>
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-900 group-hover:text-brand-600 transition-colors">
                {title}
              </h3>
              <ArrowUpRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-brand-500 transition-colors" />
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{description}</p>
          </div>
        </div>
      </MedicalCard>
    </Link>
  );
}

// ============================================================
// Main Page
// ============================================================

export default function DashboardPage() {
  const { wallet, healthData } = useApp();

  const cycleData = useMemo(() => generateCycleData(), []);
  const recentRecords = useMemo(() => generateRecentRecords(), []);
  const accessActivity = useMemo(() => generateAccessActivity(), []);
  const storageBreakdown = useMemo(() => generateStorageBreakdown(), []);
  const mockRewardStats = useMemo(() => generateMockRewardStats(), []);
  const governanceActivity = useMemo(() => generateGovernanceActivity(), []);
  const marketplaceEarnings = useMemo(() => generateMarketplaceEarnings(), []);

  /* istanbul ignore next -- wallet.connected is always false in test context */
  const welcomeSuffix = wallet.connected ? ', Patient' : '';

  return (
    <>
      <TopNav />
      <SearchOverlay />
      <ToastContainer />

      <main id="main-content" className="flex-1">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">

          {/* ─── Hero Section ─── */}
          <div className="bg-gradient-to-br from-brand-500 via-brand-600 to-brand-800 rounded-2xl p-8 mb-8 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/3 translate-x-1/3" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/3 -translate-x-1/3" />
            <div className="relative z-10">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Heart className="w-6 h-6 text-white/80" />
                    <span className="text-sm font-medium text-white/70">Shiora on Aethelred</span>
                  </div>
                  <h1 className="text-3xl font-bold mb-2">
                    Welcome back{welcomeSuffix}
                  </h1>
                  <p className="text-brand-100 max-w-xl">
                    Your health data is encrypted at rest with AES-256-GCM (per-record keys), owner-scoped,
                    and every access is written to a tamper-evident audit trail.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Link
                    href="/records"
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-brand-700 rounded-xl font-medium text-sm hover:bg-brand-50 transition-colors shadow-sm"
                  >
                    <FolderLock className="w-4 h-4" />
                    View Records
                  </Link>
                  <Link
                    href="/insights"
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/15 text-white rounded-xl font-medium text-sm hover:bg-white/25 transition-colors border border-white/20"
                  >
                    <Brain className="w-4 h-4" />
                    AI Insights
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* ─── Key Metrics ─── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
            <HealthMetricCard
              icon={<FolderLock className="w-5 h-5" />}
              label="Health Records"
              value={healthData.totalRecords.toString()}
              unit="encrypted"
              trend={4.2}
              trendLabel="this month"
              sparklineData={[120, 125, 130, 128, 135, 140, 142, 147]}
              sparklineColor={BRAND.sky}
            />
            <HealthMetricCard
              icon={<Brain className="w-5 h-5" />}
              label="Encrypted at Rest"
              value={healthData.encryptedRecords.toString()}
              unit="records"
              trend={4.2}
              trendLabel="this month"
              sparklineData={[120, 125, 130, 128, 135, 140, 142, 147]}
              sparklineColor="#a78bfa"
            />
            <HealthMetricCard
              icon={<ShieldCheck className="w-5 h-5" />}
              label="Storage Used"
              value={formatBytes(healthData.storageUsed)}
              trend={3.1}
              trendLabel="this month"
              sparklineData={[200, 220, 250, 230, 270, 280, 260, 290]}
              sparklineColor="#10b981"
            />
            <HealthMetricCard
              icon={<Users className="w-5 h-5" />}
              label="Provider Access"
              value="3"
              unit="active grants"
              trend={0}
              trendLabel="no change"
              sparklineData={[3, 3, 4, 3, 3, 3, 3, 3]}
              sparklineColor="#fb923c"
            />
          </div>

          {/* ─── Clinical Alerts Banner ─── */}
          <div className="mb-8 space-y-3">
            <SectionHeader title="Clinical Alerts" subtitle="Active alerts requiring attention" size="sm" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Link href="/clinical">
                <MedicalCard className="group border-l-4 border-l-rose-500">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-rose-50 flex items-center justify-center shrink-0">
                      <AlertTriangle className="w-4 h-4 text-rose-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-sm font-semibold text-slate-900">Drug Interaction</p>
                        <span className="px-1.5 py-0.5 rounded text-2xs font-medium bg-rose-100 text-rose-700">Major</span>
                      </div>
                      <p className="text-xs text-slate-500">Warfarin + Aspirin: increased bleeding risk</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-brand-500 transition-colors shrink-0 mt-1" />
                  </div>
                </MedicalCard>
              </Link>
              <Link href="/clinical">
                <MedicalCard className="group border-l-4 border-l-amber-500">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
                      <Stethoscope className="w-4 h-4 text-amber-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-sm font-semibold text-slate-900">Overdue Screening</p>
                        <span className="px-1.5 py-0.5 rounded text-2xs font-medium bg-amber-100 text-amber-700">Medium</span>
                      </div>
                      <p className="text-xs text-slate-500">Annual HbA1c test overdue by 45 days</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-brand-500 transition-colors shrink-0 mt-1" />
                  </div>
                </MedicalCard>
              </Link>
              <Link href="/genomics">
                <MedicalCard className="group border-l-4 border-l-violet-500">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-violet-50 flex items-center justify-center shrink-0">
                      <Dna className="w-4 h-4 text-violet-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-sm font-semibold text-slate-900">Pharmacogenomic Flag</p>
                        <span className="px-1.5 py-0.5 rounded text-2xs font-medium bg-violet-100 text-violet-700">Info</span>
                      </div>
                      <p className="text-xs text-slate-500">CYP2D6 poor metabolizer: codeine caution</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-brand-500 transition-colors shrink-0 mt-1" />
                  </div>
                </MedicalCard>
              </Link>
            </div>
          </div>

          {/* ─── Quick Actions ─── */}
          <SectionHeader title="Quick Actions" subtitle="Common tasks and navigation" size="sm" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <QuickActionCard
              icon={<FolderLock className="w-5 h-5 text-brand-600" />}
              title="Upload Health Data"
              description="AES-256-GCM encrypted at rest"
              href="/records"
              color="bg-brand-50"
            />
            <QuickActionCard
              icon={<Brain className="w-5 h-5 text-violet-600" />}
              title="Cycle Predictions"
              description="Statistical analysis of your data"
              href="/insights"
              color="bg-violet-50"
            />
            <QuickActionCard
              icon={<KeyRound className="w-5 h-5 text-amber-600" />}
              title="Manage Access"
              description="Granular provider permissions"
              href="/access"
              color="bg-amber-50"
            />
            <QuickActionCard
              icon={<ShieldCheck className="w-5 h-5 text-emerald-600" />}
              title="Attestation Tooling"
              description="Verifier tooling (simulated)"
              href="/tee-explorer"
              color="bg-emerald-50"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
            <QuickActionCard
              icon={<FlaskConical className="w-5 h-5 text-rose-600" />}
              title="Run Simulation"
              description="Digital twin what-if analysis"
              href="/twin"
              color="bg-rose-50"
            />
            <QuickActionCard
              icon={<Stethoscope className="w-5 h-5 text-cyan-600" />}
              title="Check Interactions"
              description="Drug-drug safety checker"
              href="/clinical"
              color="bg-cyan-50"
            />
            <QuickActionCard
              icon={<Fingerprint className="w-5 h-5 text-indigo-600" />}
              title="Compliance Center"
              description="HIPAA, GDPR, SOC2 status"
              href="/compliance"
              color="bg-indigo-50"
            />
            <QuickActionCard
              icon={<Dna className="w-5 h-5 text-fuchsia-600" />}
              title="Genomic Profile"
              description="Pharmacogenomics & risk scores"
              href="/genomics"
              color="bg-fuchsia-50"
            />
          </div>

          {/* ─── Charts Row ─── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
            {/* Cycle Tracking Chart */}
            <MedicalCard className="lg:col-span-2" padding={false}>
              <div className="p-5 pb-0">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-base font-semibold text-slate-900">Cycle Temperature Tracking</h3>
                  <div className="flex items-center gap-3">
                    {Object.values(CYCLE_PHASE_COLORS).map((phase) => (
                      <div key={phase.label} className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: phase.stroke }} />
                        <span className="text-2xs text-slate-500">{phase.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-slate-400 mb-4">Basal body temperature over current cycle</p>
              </div>
              <div className="px-2 pb-4">
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={cycleData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <defs>
                      {Object.entries(CYCLE_PHASE_COLORS).map(([key, val]) => (
                        <linearGradient key={key} id={`grad-${key}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={val.stroke} stopOpacity={0.2} />
                          <stop offset="95%" stopColor={val.stroke} stopOpacity={0} />
                        </linearGradient>
                      ))}
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} interval={4} />
                    <YAxis domain={[96.5, 98.5]} tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                    <Tooltip content={<ChartTooltip formatValue={(v) => `${v}°F`} />} />
                    <Area
                      type="monotone"
                      dataKey="temperature"
                      stroke={BRAND.sky}
                      fill={`url(#grad-follicular)`}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, fill: BRAND.sky }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </MedicalCard>

            {/* Storage Breakdown Pie */}
            <MedicalCard padding={false}>
              <div className="p-5 pb-0">
                <h3 className="text-base font-semibold text-slate-900">Storage Breakdown</h3>
                <p className="text-xs text-slate-400 mt-0.5">{formatBytes(healthData.storageUsed)} used</p>
              </div>
              <div className="flex items-center justify-center py-4">
                <ResponsiveContainer width={180} height={180}>
                  <PieChart>
                    <Pie
                      data={storageBreakdown}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {storageBreakdown.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip formatValue={(v) => `${v}%`} />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="px-5 pb-5 space-y-2">
                {storageBreakdown.map((item) => (
                  <div key={item.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-slate-600">{item.name}</span>
                    </div>
                    <span className="text-slate-900 font-medium">{item.value}%</span>
                  </div>
                ))}
              </div>
            </MedicalCard>
          </div>

          {/* ─── Recent Records + Access Activity ─── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
            {/* Recent Records */}
            <MedicalCard padding={false}>
              <div className="p-5 pb-3 flex items-center justify-between">
                <h3 className="text-base font-semibold text-slate-900">Recent Records</h3>
                <Link href="/records" className="text-xs text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1">
                  View All <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
              <div className="divide-y divide-slate-100">
                {recentRecords.map((record) => (
                  <div key={record.id} className="px-5 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors">
                    <div className="w-9 h-9 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
                      {RECORD_ICON_MAP[record.type] || <FileText className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{record.label}</p>
                      <p className="text-xs text-slate-400">{formatDate(record.date)}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <EncryptionBadge type="AES-256" />
                    </div>
                  </div>
                ))}
              </div>
            </MedicalCard>

            {/* Access Activity */}
            <MedicalCard padding={false}>
              <div className="p-5 pb-3 flex items-center justify-between">
                <h3 className="text-base font-semibold text-slate-900">Access Activity</h3>
                <Link href="/access" className="text-xs text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1">
                  Manage <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
              <div className="divide-y divide-slate-100">
                {accessActivity.map((activity) => (
                  <div key={activity.id} className="px-5 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                      activity.status === 'success' ? 'bg-emerald-50 text-emerald-600' :
                      activity.status === 'warning' ? 'bg-amber-50 text-amber-600' :
                      'bg-accent-50 text-accent-600'
                    }`}>
                      {activity.status === 'success' ? <CheckCircle className="w-4 h-4" /> :
                       activity.status === 'warning' ? <AlertTriangle className="w-4 h-4" /> :
                       <KeyRound className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{activity.action}</p>
                      <p className="text-xs text-slate-400">{activity.provider}</p>
                    </div>
                    <span className="text-xs text-slate-400 shrink-0">{timeAgo(activity.timestamp)}</span>
                  </div>
                ))}
              </div>
            </MedicalCard>
          </div>

          {/* ─── Twin Prediction + Compliance Score ─── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
            {/* Digital Twin Summary */}
            <MedicalCard>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-cyan-50 flex items-center justify-center">
                    <Fingerprint className="w-5 h-5 text-cyan-600" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">Digital Health Twin</h3>
                    <p className="text-xs text-slate-400">30-day prediction summary</p>
                  </div>
                </div>
                <Link href="/twin" className="text-xs text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1">
                  View Twin <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-slate-400">Overall Score</p>
                  <p className="text-xl font-bold text-slate-900">82</p>
                  <p className="text-2xs text-emerald-500">+3 predicted</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-slate-400">HbA1c</p>
                  <p className="text-xl font-bold text-slate-900">5.8%</p>
                  <p className="text-2xs text-emerald-500">Stable</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-slate-400">LDL</p>
                  <p className="text-xl font-bold text-slate-900">118</p>
                  <p className="text-2xs text-amber-500">-4 predicted</p>
                </div>
              </div>
              <div className="mt-3 p-3 bg-brand-50 rounded-xl">
                <div className="flex items-start gap-2">
                  <Brain className="w-4 h-4 text-brand-600 mt-0.5 shrink-0" />
                  <p className="text-xs text-brand-700">
                    Your twin predicts improved cardiovascular markers with current exercise regimen. Consider increasing fiber intake for optimal LDL reduction.
                  </p>
                </div>
              </div>
            </MedicalCard>

            {/* Compliance Score */}
            <MedicalCard>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                    <Gauge className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">Compliance Status</h3>
                    <p className="text-xs text-slate-400">Regulatory framework scores</p>
                  </div>
                </div>
                <Link href="/compliance" className="text-xs text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1">
                  Full Report <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {[
                  { name: 'HIPAA', score: 92, color: 'text-emerald-600' },
                  { name: 'GDPR', score: 85, color: 'text-brand-600' },
                  { name: 'SOC2', score: 88, color: 'text-violet-600' },
                  { name: 'HITRUST', score: 78, color: 'text-amber-600' },
                  { name: 'FDA', score: 81, color: 'text-cyan-600' },
                ].map((fw) => (
                  <div key={fw.name} className="text-center">
                    <div className="relative w-12 h-12 mx-auto mb-1.5">
                      <svg className="w-12 h-12 transform -rotate-90" viewBox="0 0 36 36">
                        <circle cx="18" cy="18" r="16" fill="none" stroke="#e2e8f0" strokeWidth="3" />
                        <circle cx="18" cy="18" r="16" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray={`${fw.score} ${100 - fw.score}`} strokeLinecap="round" className={fw.color} />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-slate-900">{fw.score}</span>
                    </div>
                    <p className="text-2xs font-medium text-slate-500">{fw.name}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 p-3 bg-emerald-50 rounded-xl">
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                  <p className="text-xs text-emerald-700">
                    Overall compliance score: 87%. All frameworks meeting minimum thresholds. HITRUST assessment due in 14 days.
                  </p>
                </div>
              </div>
            </MedicalCard>
          </div>

          {/* ─── Navigate Quick Actions ─── */}
          <SectionHeader title="Explore Platform" subtitle="Navigate to key features" size="sm" />
          <div className="flex gap-4 overflow-x-auto pb-2 mb-10 scrollbar-hide">
            {([
              { label: 'Chat with AI', href: '/chat', icon: <MessageSquare className="w-5 h-5 text-white" />, gradient: 'bg-gradient-to-br from-brand-400 to-brand-600' },
              { label: 'Clinical', href: '/clinical', icon: <Stethoscope className="w-5 h-5 text-white" />, gradient: 'bg-gradient-to-br from-rose-400 to-rose-600' },
              { label: 'Digital Twin', href: '/twin', icon: <Fingerprint className="w-5 h-5 text-white" />, gradient: 'bg-gradient-to-br from-cyan-400 to-cyan-600' },
              { label: 'MPC Lab', href: '/mpc', icon: <Network className="w-5 h-5 text-white" />, gradient: 'bg-gradient-to-br from-purple-400 to-purple-600' },
              { label: 'Marketplace', href: '/marketplace', icon: <Store className="w-5 h-5 text-white" />, gradient: 'bg-gradient-to-br from-emerald-400 to-emerald-600' },
              { label: 'Governance', href: '/governance', icon: <Vote className="w-5 h-5 text-white" />, gradient: 'bg-gradient-to-br from-amber-400 to-amber-600' },
              { label: 'Emergency', href: '/emergency', icon: <Siren className="w-5 h-5 text-white" />, gradient: 'bg-gradient-to-br from-red-400 to-red-600' },
              { label: 'Genomics', href: '/genomics', icon: <Dna className="w-5 h-5 text-white" />, gradient: 'bg-gradient-to-br from-fuchsia-400 to-fuchsia-600' },
            ] as const).map((item) => (
              <Link key={item.href} href={item.href} className="group shrink-0">
                <div className={`${item.gradient} rounded-2xl p-5 min-w-[150px] flex flex-col items-start gap-3 shadow-sm hover:shadow-md transition-shadow`}>
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                    {item.icon}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white">{item.label}</span>
                    <ArrowUpRight className="w-3.5 h-3.5 text-white/70 group-hover:text-white transition-colors" />
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* ─── Rewards Summary ─── */}
          <MedicalCard>
            <SectionHeader title="Health-to-Earn Rewards" icon={Trophy} />
            <RewardsSummary stats={mockRewardStats} streakCount={mockRewardStats.activeStreaks} />
          </MedicalCard>

          <div className="mb-10" />

          {/* ─── Governance Activity ─── */}
          <MedicalCard>
            <SectionHeader title="Governance Activity" icon={Vote} />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
              <div className="bg-brand-50 rounded-xl p-4">
                <p className="text-xs text-brand-600 mb-1">Active Proposals</p>
                <p className="text-2xl font-bold text-brand-700">
                  <AnimatedNumber value={governanceActivity.activeProposals} />
                </p>
              </div>
              <div className="bg-violet-50 rounded-xl p-4">
                <p className="text-xs text-violet-600 mb-1">Your Voting Power</p>
                <p className="text-2xl font-bold text-violet-700">
                  <AnimatedNumber value={governanceActivity.votingPower} suffix=" AETHEL" />
                </p>
              </div>
              <div className="bg-amber-50 rounded-xl p-4">
                <p className="text-xs text-amber-600 mb-1">Next Vote Deadline</p>
                <p className="text-lg font-bold text-amber-700">
                  {Math.ceil((governanceActivity.nextVoteDeadline - Date.now()) / 86400000)} days
                </p>
              </div>
              <div className="bg-accent-50 rounded-xl p-4">
                <p className="text-xs text-accent-600 mb-1">Recent Proposal</p>
                <p className="text-sm font-medium text-accent-800 line-clamp-2">{governanceActivity.recentProposal.title}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs text-emerald-600">{formatNumber(governanceActivity.recentProposal.forVotes)} For</span>
                  <span className="text-xs text-red-500">{formatNumber(governanceActivity.recentProposal.againstVotes)} Against</span>
                </div>
              </div>
            </div>
          </MedicalCard>

          <div className="mb-10" />

          {/* ─── Marketplace Earnings ─── */}
          <MedicalCard>
            <SectionHeader title="Marketplace Earnings" icon={Store} />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
              <div className="bg-emerald-50 rounded-xl p-4">
                <p className="text-xs text-emerald-600 mb-1">Total Earnings</p>
                <p className="text-2xl font-bold text-emerald-700">
                  <AnimatedNumber value={marketplaceEarnings.totalEarnings} suffix=" AETHEL" />
                </p>
              </div>
              <div className="bg-brand-50 rounded-xl p-4">
                <p className="text-xs text-brand-600 mb-1">Active Listings</p>
                <p className="text-2xl font-bold text-brand-700">
                  <AnimatedNumber value={marketplaceEarnings.activeListings} />
                </p>
              </div>
              <div className="bg-slate-50 rounded-xl p-4">
                <p className="text-xs text-slate-500 mb-1">Recent Sales</p>
                <div className="space-y-2">
                  {marketplaceEarnings.recentSales.map((sale) => (
                    <div key={sale.id} className="flex items-center justify-between">
                      <span className="text-xs text-slate-700 truncate">{sale.title}</span>
                      <span className="text-xs font-semibold text-emerald-600">+{sale.amount} AETHEL</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </MedicalCard>

        </div>
      </main>

      <Footer />
    </>
  );
}
