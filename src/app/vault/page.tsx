/**
 * Shiora on Aethelred — Reproductive Data Vault Page
 *
 * Sovereign reproductive health data management with encrypted
 * compartments, cycle tracking, symptom logging, fertility
 * predictions, and jurisdiction-aware privacy controls.
 */

'use client';

import { useState, useMemo } from 'react';
import {
  Lock,
  Unlock,
  Shield,
  Calendar,
  Heart,
  TrendingUp,
  Pill,
  TestTube2,
  ScanLine,
  Thermometer,
  Baby,
  Database,
  Clock,
  Eye,
  Users,
  Activity,
  AlertCircle,
  BarChart3,
  PieChart as PieChartIcon,
  RefreshCw,
  CheckCircle,
  XCircle,
  FileText,
  Trash2,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';

import { useApp } from '@/contexts/AppContext';
import {
  TopNav,
  Footer,
  ToastContainer,
  SearchOverlay,
  Badge,
  Tabs,
} from '@/components/ui/SharedComponents';
import {
  MedicalCard,
  SectionHeader,
  StatusBadge,
  HealthMetricCard,
} from '@/components/ui/PagePrimitives';
import {
  CompartmentCard,
  CycleCalendar,
  SymptomLogger,
  FertilityChart,
  JurisdictionBadge,
  PrivacyMeter,
} from '@/components/vault/VaultComponents';
import {
  BRAND,
  VAULT_CATEGORIES,
  SYMPTOM_CATEGORIES,
  CYCLE_PHASE_COLORS,
  CHART_COLORS,
  REPRODUCTIVE_JURISDICTIONS,
  EXTENDED_STATUS_STYLES,
} from '@/lib/constants';
import {
  seededRandom,
  seededInt,
  seededHex,
  seededPick,
  formatNumber,
  formatBytes,
  formatDate,
  formatDateTime,
  timeAgo,
  generateCID,
  generateAttestation,
} from '@/lib/utils';
import type {
  VaultCompartment,
  VaultCompartmentCategory,
  VaultLockStatus,
  CycleEntry,
  CyclePhase,
  SymptomLog,
  SymptomCategory,
  SymptomSeverity,
  FertilityMarker,
  VaultPrivacyScore,
} from '@/types';

// ============================================================
// Page-level mock data (SEED = 710)
// ============================================================

const SEED = 710;

function generatePageCompartments(): VaultCompartment[] {
  return VAULT_CATEGORIES.map((cat, i) => {
    const lockStatuses: VaultLockStatus[] = ['locked', 'unlocked', 'partial'];
    const accessCount = seededInt(SEED + i * 11, 0, 5);
    const providers = [
      'Dr. Sarah Chen, OB-GYN',
      "Metro Women's Health",
      'Dr. James Liu, Endocrinology',
      'Fertility Clinic of Boston',
      "Stanford Women's Care",
    ];
    return {
      id: `vault-${seededHex(SEED + i * 100, 12)}`,
      category: cat.id as VaultCompartmentCategory,
      label: cat.label,
      description: `Encrypted ${cat.label.toLowerCase()} compartment with TEE-verified access controls`,
      lockStatus: i < 3 ? 'locked' : seededPick(SEED + i * 3, lockStatuses),
      recordCount: seededInt(SEED + i * 7, 5, 120),
      storageUsed: seededInt(SEED + i * 13, 50, 5000) * 1024,
      lastAccessed: Date.now() - seededInt(SEED + i * 17, 1, 30) * 86400000,
      encryptionKey: `0x${seededHex(SEED + i * 50, 64)}`,
      accessList: Array.from({ length: accessCount }, (_, j) =>
        seededPick(SEED + i * 20 + j, providers),
      ),
      jurisdictionFlags: ['us-ca', 'eu-gdpr'].slice(0, seededInt(SEED + i * 9, 1, 2)),
      createdAt: Date.now() - seededInt(SEED + i * 23, 60, 365) * 86400000,
    };
  });
}

function generatePageCycleEntries(): CycleEntry[] {
  const entries: CycleEntry[] = [];
  const totalDays = 84;
  const cycleLength = 28;

  for (let i = 0; i < totalDays; i++) {
    const dayInCycle = (i % cycleLength) + 1;
    let phase: CyclePhase;
    let flow: 'none' | 'light' | 'medium' | 'heavy' = 'none';

    if (dayInCycle <= 5) {
      phase = 'menstrual';
      flow = dayInCycle <= 2 ? 'heavy' : dayInCycle <= 4 ? 'medium' : 'light';
    } else if (dayInCycle <= 13) {
      phase = 'follicular';
    } else if (dayInCycle <= 16) {
      phase = 'ovulation';
    } else {
      phase = 'luteal';
    }

    const baseTemp = dayInCycle <= 14 ? 97.2 : 97.8;
    const tempVariation = seededRandom(SEED + i * 31) * 0.6;
    const temperature = parseFloat((baseTemp + tempVariation).toFixed(1));

    let fertilityScore: number;
    if (dayInCycle >= 10 && dayInCycle <= 16) {
      fertilityScore = Math.min(98, 60 + seededInt(SEED + i * 41, 15, 38));
    } else if (dayInCycle >= 8 && dayInCycle <= 18) {
      fertilityScore = 30 + seededInt(SEED + i * 41, 10, 25);
    } else {
      fertilityScore = seededInt(SEED + i * 41, 5, 25);
    }

    entries.push({
      id: `cycle-${seededHex(SEED + i * 200, 12)}`,
      date: Date.now() - (totalDays - i) * 86400000,
      day: dayInCycle,
      phase,
      temperature,
      flow,
      symptoms: [],
      fertilityScore,
      notes: '',
    });
  }

  return entries;
}

function generatePageSymptoms(): SymptomLog[] {
  const symptomNames: Record<string, string[]> = {
    pain: ['Cramps', 'Headache', 'Lower back pain', 'Breast tenderness', 'Pelvic pain'],
    mood: ['Anxiety', 'Irritability', 'Mood swings', 'Sadness', 'Emotional sensitivity'],
    energy: ['Fatigue', 'Low energy', 'Exhaustion', 'Difficulty concentrating', 'Brain fog'],
    digestive: ['Bloating', 'Nausea', 'Appetite changes', 'Constipation', 'Gas'],
    skin: ['Acne breakout', 'Dry skin', 'Oily skin', 'Rash', 'Sensitivity'],
    sleep: ['Insomnia', 'Night sweats', 'Restless sleep', 'Oversleeping', 'Vivid dreams'],
    discharge: ['Clear', 'White', 'Yellow', 'Brown', 'Spotting'],
    temperature: ['Hot flashes', 'Chills', 'Fever', 'Night sweats', 'Cold sensitivity'],
    other: ['Dizziness', 'Leg cramps', 'Hair loss', 'Weight changes', 'Swelling'],
  };

  const categories: SymptomCategory[] = [
    'pain',
    'mood',
    'energy',
    'digestive',
    'skin',
    'sleep',
    'discharge',
    'temperature',
    'other',
  ];

  return Array.from({ length: 60 }, (_, i) => {
    const category = seededPick(SEED + i * 73, categories);
    const names = symptomNames[category] ??
      /* istanbul ignore next */
      ['Unknown'];
    return {
      id: `sym-${seededHex(SEED + i * 300, 12)}`,
      date: Date.now() - seededInt(SEED + i * 77, 0, 60) * 86400000,
      category,
      symptom: seededPick(SEED + i * 79, names),
      severity: seededInt(SEED + i * 81, 1, 5) as SymptomSeverity,
      notes: seededPick(SEED + i * 83, [
        '',
        '',
        '',
        'Took ibuprofen',
        'After exercise',
        'Morning onset',
      ]),
      tags: [seededPick(SEED + i * 85, ['tracked', 'recurring', 'new', 'improving', 'worsening'])],
    };
  });
}

function generatePageFertilityMarkers(): FertilityMarker[] {
  const types: FertilityMarker['type'][] = [
    'lh_surge',
    'bbt_shift',
    'cervical_mucus',
    'ovulation_confirmed',
  ];
  const sources: FertilityMarker['source'][] = ['manual', 'ai_predicted', 'wearable'];

  return Array.from({ length: 12 }, (_, i) => ({
    id: `fm-${seededHex(SEED + i * 400, 12)}`,
    date: Date.now() - seededInt(SEED + i * 87, 0, 84) * 86400000,
    type: seededPick(SEED + i * 89, types),
    value: parseFloat((seededRandom(SEED + i * 91) * 100).toFixed(1)),
    confidence: parseFloat((70 + seededRandom(SEED + i * 93) * 28).toFixed(1)),
    source: seededPick(SEED + i * 95, sources),
    attestation: generateAttestation(SEED + i * 97),
  }));
}

const PRIVACY_SCORE: VaultPrivacyScore = {
  overall: 87,
  encryptionScore: 95,
  accessControlScore: 82,
  jurisdictionScore: 85,
  dataMinimizationScore: 78,
};

// ============================================================
// Tab definitions
// ============================================================

const VAULT_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'cycle', label: 'Cycle Tracking' },
  { id: 'symptoms', label: 'Symptoms' },
  { id: 'fertility', label: 'Fertility' },
  { id: 'compartments', label: 'Compartments' },
  { id: 'privacy', label: 'Privacy' },
];

// ============================================================
// Marker type labels
// ============================================================

const MARKER_LABELS: Record<string, string> = {
  lh_surge: 'LH Surge',
  bbt_shift: 'BBT Shift',
  cervical_mucus: 'Cervical Mucus',
  ovulation_confirmed: 'Ovulation Confirmed',
};

const SOURCE_LABELS: Record<string, string> = {
  manual: 'Manual Entry',
  ai_predicted: 'AI Predicted',
  wearable: 'Wearable Device',
};

// ============================================================
// Main Page Component
// ============================================================

export default function VaultPage() {
  const [activeTab, setActiveTab] = useState('overview');

  // Generate all mock data at component level using useMemo for stability
  const compartments = useMemo(() => generatePageCompartments(), []);
  const cycleEntries = useMemo(() => generatePageCycleEntries(), []);
  const symptoms = useMemo(() => generatePageSymptoms(), []);
  const fertilityMarkers = useMemo(() => generatePageFertilityMarkers(), []);

  // Derived stats
  const totalRecords = useMemo(
    () => compartments.reduce((sum, c) => sum + c.recordCount, 0),
    [compartments],
  );
  const totalStorage = useMemo(
    () => compartments.reduce((sum, c) => sum + c.storageUsed, 0),
    [compartments],
  );
  const lockedCount = compartments.filter((c) => c.lockStatus === 'locked').length;
  const currentCycleDay =
    cycleEntries.length > 0
      ? cycleEntries[cycleEntries.length - 1].day
      : /* istanbul ignore next */ 1;
  const currentPhase =
    cycleEntries.length > 0
      ? cycleEntries[cycleEntries.length - 1].phase
      : /* istanbul ignore next */ 'follicular';
  const averageCycleLength = 28;
  const nextPeriodDays = averageCycleLength - currentCycleDay;
  const fertileWindowStart = Date.now() + (14 - currentCycleDay - 5) * 86400000;
  const fertileWindowEnd = Date.now() + (14 - currentCycleDay + 1) * 86400000;

  // Symptom frequency data
  const symptomFrequency = useMemo(() => {
    const freq: Record<string, number> = {};
    symptoms.forEach((s) => {
      freq[s.category] = (freq[s.category] || 0) + 1;
    });
    return SYMPTOM_CATEGORIES.map((cat) => ({
      name: cat.label,
      count:
        freq[cat.id] ||
        /* istanbul ignore next */
        0,
      icon: cat.icons[0],
    })).sort((a, b) => b.count - a.count);
  }, [symptoms]);

  // Symptom trend (last 30 days)
  const symptomTrend = useMemo(() => {
    const days = 30;
    return Array.from({ length: days }, (_, i) => {
      const dayStart = Date.now() - (days - i) * 86400000;
      const dayEnd = dayStart + 86400000;
      const count = symptoms.filter((s) => s.date >= dayStart && s.date < dayEnd).length;
      const d = new Date(dayStart);
      return {
        date: `${d.getMonth() + 1}/${d.getDate()}`,
        count,
      };
    });
  }, [symptoms]);

  // Cycle length history (mock 6 cycles)
  const cycleLengthHistory = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => ({
      cycle: `Cycle ${i + 1}`,
      length: 26 + seededInt(SEED + i * 111, 0, 4),
    }));
  }, []);

  // Temperature chart data
  const temperatureData = useMemo(() => {
    return cycleEntries.slice(-28).map((entry) => ({
      day: `Day ${entry.day}`,
      temperature: entry.temperature,
      phase: entry.phase,
    }));
  }, [cycleEntries]);

  // Storage breakdown for pie chart
  const storageBreakdown = useMemo(() => {
    return compartments.map((c, i) => ({
      name: c.label,
      value: c.storageUsed,
      color:
        VAULT_CATEGORIES[i]?.color ??
        /* istanbul ignore next */
        CHART_COLORS[i % CHART_COLORS.length],
    }));
  }, [compartments]);

  // AI prediction data
  const aiPredictions = useMemo(
    () => [
      { label: 'Next Period', value: `${nextPeriodDays} days`, confidence: 94 },
      {
        label: 'Ovulation Window',
        value: `Day ${14 - currentCycleDay + currentCycleDay}`,
        confidence: 91,
      },
      { label: 'Cycle Regularity', value: '92%', confidence: 88 },
      { label: 'Hormone Balance', value: 'Optimal', confidence: 85 },
    ],
    [nextPeriodDays, currentCycleDay],
  );

  // Hormone levels (mock)
  const hormoneLevels = useMemo(() => {
    return Array.from({ length: 28 }, (_, i) => {
      const day = i + 1;
      return {
        day: `Day ${day}`,
        estrogen: day <= 14 ? 20 + (day / 14) * 280 : 300 - ((day - 14) / 14) * 200,
        progesterone:
          day <= 14
            ? 1 + seededRandom(SEED + i * 113) * 2
            : 5 + ((day - 14) / 14) * 20 + seededRandom(SEED + i * 115) * 5,
        lh:
          day >= 12 && day <= 15
            ? 20 + (day === 14 ? 60 : seededRandom(SEED + i * 117) * 30)
            : 5 + seededRandom(SEED + i * 119) * 10,
      };
    });
  }, []);

  // Recent activity feed
  const recentActivity = useMemo(
    () => [
      {
        icon: <Lock className="w-4 h-4" />,
        text: 'Cycle Tracking compartment locked',
        time: Date.now() - 3600000,
        color: 'text-slate-500',
      },
      {
        icon: <Activity className="w-4 h-4" />,
        text: 'New symptom logged: Headache',
        time: Date.now() - 7200000,
        color: 'text-amber-500',
      },
      {
        icon: <Shield className="w-4 h-4" />,
        text: 'Privacy audit completed',
        time: Date.now() - 14400000,
        color: 'text-emerald-500',
      },
      {
        icon: <Heart className="w-4 h-4" />,
        text: 'Fertility markers updated',
        time: Date.now() - 28800000,
        color: 'text-violet-500',
      },
      {
        icon: <Eye className="w-4 h-4" />,
        text: 'Dr. Sarah Chen accessed Lab Results',
        time: Date.now() - 43200000,
        color: 'text-brand-500',
      },
      {
        icon: <Database className="w-4 h-4" />,
        text: 'New records encrypted and stored',
        time: Date.now() - 86400000,
        color: 'text-brand-500',
      },
    ],
    [],
  );

  // Handler stubs
  /* istanbul ignore next -- stub: production would call the mutation */
  const handleLock = (id: string) => {
    // In production, this would call the mutation
  };
  /* istanbul ignore next -- stub: production would call the mutation */
  const handleUnlock = (id: string) => {
    // In production, this would call the mutation
  };
  /* istanbul ignore next -- stub: production would call the mutation */
  const handleLogSymptom = (symptom: Omit<SymptomLog, 'id'>) => {
    // In production, this would call the mutation
  };

  return (
    <>
      <TopNav />
      <SearchOverlay />
      <ToastContainer />

      <main id="main-content" className="flex-1">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          {/* Hero Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-brand-50 flex items-center justify-center text-brand-600">
                <Lock className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                  Reproductive Data Vault
                </h1>
                <p className="text-sm text-slate-500 mt-0.5">
                  Sovereign, encrypted reproductive health data with TEE-verified access controls
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="success" dot>
                {lockedCount}/{compartments.length} Locked
              </Badge>
              <Badge variant="info" dot>
                Privacy Score: {PRIVACY_SCORE.overall}
              </Badge>
            </div>
          </div>

          {/* Tabs */}
          <Tabs tabs={VAULT_TABS} activeTab={activeTab} onChange={setActiveTab} className="mb-8" />

          {/* ============================================================ */}
          {/* TAB 1: OVERVIEW */}
          {/* ============================================================ */}
          {activeTab === 'overview' && (
            <div className="space-y-8">
              {/* Quick Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <HealthMetricCard
                  icon={<Database className="w-5 h-5" />}
                  label="Total Compartments"
                  value={String(compartments.length)}
                  sparklineData={[5, 6, 7, 7, 8, 8]}
                />
                <HealthMetricCard
                  icon={<Lock className="w-5 h-5" />}
                  label="Locked"
                  value={String(lockedCount)}
                  sparklineData={[2, 2, 3, 3, 3, lockedCount]}
                />
                <HealthMetricCard
                  icon={<FileText className="w-5 h-5" />}
                  label="Total Records"
                  value={formatNumber(totalRecords)}
                  sparklineData={[200, 250, 280, 310, 340, totalRecords]}
                />
                <HealthMetricCard
                  icon={<Database className="w-5 h-5" />}
                  label="Total Storage"
                  value={formatBytes(totalStorage)}
                  sparklineData={[1000, 2000, 3000, 4000, 5000, totalStorage / 1024]}
                />
              </div>

              {/* Compartment Grid */}
              <div>
                <SectionHeader
                  title="Data Compartments"
                  subtitle="Manage your encrypted reproductive health data"
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {compartments.map((compartment) => (
                    <CompartmentCard
                      key={compartment.id}
                      compartment={compartment}
                      onLock={() => handleLock(compartment.id)}
                      onUnlock={() => handleUnlock(compartment.id)}
                    />
                  ))}
                </div>
              </div>

              {/* Recent Activity */}
              <MedicalCard>
                <SectionHeader title="Recent Activity" size="sm" />
                <div className="space-y-3">
                  {recentActivity.map((item, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0"
                    >
                      <div
                        className={`w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center ${item.color}`}
                      >
                        {item.icon}
                      </div>
                      <span className="flex-1 text-sm text-slate-700">{item.text}</span>
                      <span className="text-xs text-slate-400">{timeAgo(item.time)}</span>
                    </div>
                  ))}
                </div>
              </MedicalCard>
            </div>
          )}

          {/* ============================================================ */}
          {/* TAB 2: CYCLE TRACKING */}
          {/* ============================================================ */}
          {activeTab === 'cycle' && (
            <div className="space-y-8">
              {/* Calendar */}
              <MedicalCard>
                <SectionHeader
                  title="Cycle Calendar"
                  subtitle="Your menstrual cycle phases and flow"
                  size="sm"
                />
                <CycleCalendar entries={cycleEntries} currentDay={currentCycleDay} />
              </MedicalCard>

              {/* Current Cycle Info */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <MedicalCard>
                  <p className="text-xs text-slate-400 mb-1">Current Day</p>
                  <p className="text-2xl font-bold text-slate-900">Day {currentCycleDay}</p>
                  <p className="text-xs text-slate-500 mt-1 capitalize">{currentPhase} Phase</p>
                </MedicalCard>
                <MedicalCard>
                  <p className="text-xs text-slate-400 mb-1">Next Period</p>
                  <p className="text-2xl font-bold text-slate-900">{nextPeriodDays}d</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {formatDate(Date.now() + nextPeriodDays * 86400000)}
                  </p>
                </MedicalCard>
                <MedicalCard>
                  <p className="text-xs text-slate-400 mb-1">Fertile Window</p>
                  <p className="text-2xl font-bold text-slate-900">
                    Day{' '}
                    {Math.max(
                      1,
                      14 -
                        5 +
                        /* istanbul ignore next */ (currentCycleDay <= 14
                          ? 0
                          : currentCycleDay - 14),
                    )}
                    -
                    {Math.min(
                      28,
                      14 +
                        1 +
                        /* istanbul ignore next */ (currentCycleDay <= 14
                          ? 0
                          : currentCycleDay - 14),
                    )}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {currentCycleDay >= 9 && currentCycleDay <= 16
                      ? /* istanbul ignore next */ 'Active now'
                      : 'Upcoming'}
                  </p>
                </MedicalCard>
                <MedicalCard>
                  <p className="text-xs text-slate-400 mb-1">Avg Cycle Length</p>
                  <p className="text-2xl font-bold text-slate-900">{averageCycleLength}d</p>
                  <p className="text-xs text-slate-500 mt-1">Last 6 cycles</p>
                </MedicalCard>
              </div>

              {/* Temperature Chart */}
              <MedicalCard>
                <SectionHeader title="Basal Body Temperature" subtitle="Last 28 days" size="sm" />
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart
                    data={temperatureData}
                    margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="tempGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis
                      dataKey="day"
                      tick={{ fontSize: 10, fill: '#94a3b8' }}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[96.5, 99]}
                      tick={{ fontSize: 10, fill: '#94a3b8' }}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#fff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '12px',
                        fontSize: '12px',
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="temperature"
                      stroke="#f43f5e"
                      fill="url(#tempGrad)"
                      strokeWidth={2}
                      dot={{ r: 2, fill: '#f43f5e' }}
                      name="Temp (F)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </MedicalCard>

              {/* Cycle Length History */}
              <MedicalCard>
                <SectionHeader title="Cycle Length History" subtitle="Last 6 cycles" size="sm" />
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart
                    data={cycleLengthHistory}
                    margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis
                      dataKey="cycle"
                      tick={{ fontSize: 10, fill: '#94a3b8' }}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[24, 32]}
                      tick={{ fontSize: 10, fill: '#94a3b8' }}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#fff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '12px',
                        fontSize: '12px',
                      }}
                    />
                    <Bar dataKey="length" fill={BRAND.sky} radius={[6, 6, 0, 0]} name="Days" />
                  </BarChart>
                </ResponsiveContainer>
              </MedicalCard>
            </div>
          )}

          {/* ============================================================ */}
          {/* TAB 3: SYMPTOMS */}
          {/* ============================================================ */}
          {activeTab === 'symptoms' && (
            <div className="space-y-8">
              {/* Symptom Logger */}
              <MedicalCard>
                <SectionHeader
                  title="Log Symptoms"
                  subtitle="Track your daily symptoms"
                  size="sm"
                />
                <SymptomLogger
                  categories={SYMPTOM_CATEGORIES}
                  onLog={handleLogSymptom}
                  recentLogs={symptoms}
                />
              </MedicalCard>

              {/* Symptom Frequency */}
              <MedicalCard>
                <SectionHeader
                  title="Symptom Frequency"
                  subtitle="Most common symptoms this cycle"
                  size="sm"
                />
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={symptomFrequency}
                    layout="vertical"
                    margin={{ top: 0, right: 20, left: 80, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 10, fill: '#94a3b8' }}
                      tickLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      tickLine={false}
                      width={75}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#fff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '12px',
                        fontSize: '12px',
                      }}
                    />
                    <Bar dataKey="count" fill={BRAND.sky} radius={[0, 6, 6, 0]} name="Count" />
                  </BarChart>
                </ResponsiveContainer>
              </MedicalCard>

              {/* Symptom Trend */}
              <MedicalCard>
                <SectionHeader
                  title="Symptom Trend"
                  subtitle="Symptoms per day over the last 30 days"
                  size="sm"
                />
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart
                    data={symptomTrend}
                    margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: '#94a3b8' }}
                      tickLine={false}
                      interval={4}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: '#94a3b8' }}
                      tickLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#fff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '12px',
                        fontSize: '12px',
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke="#f43f5e"
                      strokeWidth={2}
                      dot={{ r: 2, fill: '#f43f5e' }}
                      name="Symptoms"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </MedicalCard>
            </div>
          )}

          {/* ============================================================ */}
          {/* TAB 4: FERTILITY */}
          {/* ============================================================ */}
          {activeTab === 'fertility' && (
            <div className="space-y-8">
              {/* Fertility Chart */}
              <MedicalCard>
                <SectionHeader
                  title="Fertility Overview"
                  subtitle="Temperature and fertility score tracking"
                  size="sm"
                />
                <FertilityChart
                  entries={cycleEntries}
                  markers={fertilityMarkers}
                  fertileStart={fertileWindowStart}
                  fertileEnd={fertileWindowEnd}
                />
              </MedicalCard>

              {/* Fertility Markers Timeline */}
              <MedicalCard>
                <SectionHeader
                  title="Fertility Markers"
                  subtitle="Recent observations and predictions"
                  size="sm"
                />
                <div className="space-y-3">
                  {fertilityMarkers
                    .sort((a, b) => b.date - a.date)
                    .map((marker) => (
                      <div
                        key={marker.id}
                        className="flex items-center gap-4 p-3 bg-slate-50 rounded-xl"
                      >
                        <div className="w-10 h-10 rounded-lg bg-violet-50 flex items-center justify-center text-violet-600">
                          <Heart className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-slate-700">
                            {MARKER_LABELS[marker.type] ??
                              /* istanbul ignore next */
                              marker.type}
                          </p>
                          <p className="text-xs text-slate-500">
                            {SOURCE_LABELS[marker.source] ??
                              /* istanbul ignore next */
                              marker.source}{' '}
                            &middot; Confidence: {marker.confidence.toFixed(0)}%
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-slate-900">
                            {marker.value.toFixed(1)}
                          </p>
                          <p className="text-xs text-slate-400">{formatDate(marker.date)}</p>
                        </div>
                      </div>
                    ))}
                </div>
              </MedicalCard>

              {/* AI Predictions */}
              <MedicalCard>
                <SectionHeader
                  title="AI Predictions"
                  subtitle="TEE-verified reproductive health predictions"
                  size="sm"
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {aiPredictions.map((pred, i) => (
                    <div key={i} className="p-4 bg-slate-50 rounded-xl">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium text-slate-700">{pred.label}</p>
                        <Badge
                          variant={
                            pred.confidence >= 90
                              ? 'success'
                              : pred.confidence >= 80
                                ? 'info'
                                : /* istanbul ignore next */ 'warning'
                          }
                        >
                          {pred.confidence}% confidence
                        </Badge>
                      </div>
                      <p className="text-xl font-bold text-slate-900">{pred.value}</p>
                    </div>
                  ))}
                </div>
              </MedicalCard>

              {/* Hormone Level Tracking */}
              <MedicalCard>
                <SectionHeader
                  title="Hormone Levels"
                  subtitle="Estimated hormone levels through the cycle"
                  size="sm"
                />
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart
                    data={hormoneLevels}
                    margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis
                      dataKey="day"
                      tick={{ fontSize: 10, fill: '#94a3b8' }}
                      tickLine={false}
                    />
                    <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#fff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '12px',
                        fontSize: '12px',
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="estrogen"
                      stroke="#a78bfa"
                      strokeWidth={2}
                      dot={false}
                      name="Estrogen (pg/mL)"
                    />
                    <Line
                      type="monotone"
                      dataKey="progesterone"
                      stroke="#fb923c"
                      strokeWidth={2}
                      dot={false}
                      name="Progesterone (ng/mL)"
                    />
                    <Line
                      type="monotone"
                      dataKey="lh"
                      stroke="#f43f5e"
                      strokeWidth={2}
                      dot={false}
                      name="LH (mIU/mL)"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </MedicalCard>
            </div>
          )}

          {/* ============================================================ */}
          {/* TAB 5: COMPARTMENTS */}
          {/* ============================================================ */}
          {activeTab === 'compartments' && (
            <div className="space-y-8">
              {/* Bulk Controls */}
              <div className="flex items-center gap-3">
                <button className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-200 transition-colors">
                  <Lock className="w-4 h-4" />
                  Lock All
                </button>
                <button className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 text-sm font-medium rounded-xl hover:bg-emerald-100 transition-colors">
                  <Unlock className="w-4 h-4" />
                  Unlock All
                </button>
                <button className="inline-flex items-center gap-2 px-4 py-2 bg-brand-50 text-brand-700 text-sm font-medium rounded-xl hover:bg-brand-100 transition-colors">
                  <RefreshCw className="w-4 h-4" />
                  Refresh
                </button>
              </div>

              {/* Compartment Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {compartments.map((compartment) => (
                  <CompartmentCard
                    key={compartment.id}
                    compartment={compartment}
                    onLock={() => handleLock(compartment.id)}
                    onUnlock={() => handleUnlock(compartment.id)}
                  />
                ))}
              </div>

              {/* Access Management */}
              <MedicalCard>
                <SectionHeader
                  title="Access Management"
                  subtitle="Providers with compartment access"
                  size="sm"
                />
                <div className="space-y-3">
                  {compartments
                    .filter((c) => c.accessList.length > 0)
                    .map((compartment) => (
                      <div key={compartment.id} className="p-3 bg-slate-50 rounded-xl">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-slate-700">
                            {compartment.label}
                          </span>
                          <StatusBadge
                            status={
                              compartment.lockStatus.charAt(0).toUpperCase() +
                              compartment.lockStatus.slice(1)
                            }
                            styles={EXTENDED_STATUS_STYLES}
                          />
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {compartment.accessList.map((provider, j) => (
                            <span
                              key={j}
                              className="inline-flex items-center gap-1 px-2 py-0.5 bg-white rounded-full text-xs text-slate-600 border border-slate-200"
                            >
                              <Users className="w-3 h-3" />
                              {provider}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                </div>
              </MedicalCard>

              {/* Storage Breakdown */}
              <MedicalCard>
                <SectionHeader
                  title="Storage Breakdown"
                  subtitle="Storage used per compartment"
                  size="sm"
                />
                <div className="flex flex-col md:flex-row items-center gap-8">
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={storageBreakdown}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {storageBreakdown.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#fff',
                          border: '1px solid #e2e8f0',
                          borderRadius: '12px',
                          fontSize: '12px',
                        }}
                        formatter={/* istanbul ignore next */ (value: number) => formatBytes(value)}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2 min-w-[200px]">
                    {storageBreakdown.map((item, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <span className="w-3 h-3 rounded" style={{ backgroundColor: item.color }} />
                        <span className="flex-1 text-slate-600">{item.name}</span>
                        <span className="font-medium text-slate-900">
                          {formatBytes(item.value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </MedicalCard>
            </div>
          )}

          {/* ============================================================ */}
          {/* TAB 6: PRIVACY */}
          {/* ============================================================ */}
          {activeTab === 'privacy' && (
            <div className="space-y-8">
              {/* Privacy Meter */}
              <MedicalCard className="max-w-md mx-auto">
                <SectionHeader
                  title="Privacy Score"
                  subtitle="Overall data protection assessment"
                  size="sm"
                />
                <PrivacyMeter score={PRIVACY_SCORE} />
              </MedicalCard>

              {/* Jurisdiction Status */}
              <MedicalCard>
                <SectionHeader
                  title="Jurisdiction Protections"
                  subtitle="Applicable reproductive data protection laws"
                  size="sm"
                />
                <div className="flex flex-wrap gap-3">
                  {REPRODUCTIVE_JURISDICTIONS.map((j) => (
                    <JurisdictionBadge
                      key={j.id}
                      jurisdiction={j.label}
                      protectionLevel={j.protectionLevel as 'high' | 'medium' | 'low'}
                    />
                  ))}
                </div>
              </MedicalCard>

              {/* Data Deletion Controls */}
              <MedicalCard>
                <SectionHeader
                  title="Data Controls"
                  subtitle="Manage your reproductive data retention"
                  size="sm"
                />
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                    <div>
                      <p className="text-sm font-medium text-slate-700">Request Data Export</p>
                      <p className="text-xs text-slate-500">Download all your encrypted data</p>
                    </div>
                    <button className="px-3 py-1.5 bg-brand-50 text-brand-700 text-xs font-medium rounded-lg hover:bg-brand-100 transition-colors">
                      Export
                    </button>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                    <div>
                      <p className="text-sm font-medium text-slate-700">Data Portability</p>
                      <p className="text-xs text-slate-500">Transfer data to another service</p>
                    </div>
                    <button className="px-3 py-1.5 bg-brand-50 text-brand-700 text-xs font-medium rounded-lg hover:bg-brand-100 transition-colors">
                      Transfer
                    </button>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-red-50 rounded-xl">
                    <div>
                      <p className="text-sm font-medium text-red-700">Delete All Data</p>
                      <p className="text-xs text-red-500">Permanently remove all vault data</p>
                    </div>
                    <button className="px-3 py-1.5 bg-red-100 text-red-700 text-xs font-medium rounded-lg hover:bg-red-200 transition-colors">
                      <Trash2 className="w-3.5 h-3.5 inline mr-1" />
                      Delete
                    </button>
                  </div>
                </div>
              </MedicalCard>

              {/* Encryption Status */}
              <MedicalCard>
                <SectionHeader
                  title="Encryption Status"
                  subtitle="Per-compartment encryption verification"
                  size="sm"
                />
                <div className="space-y-2">
                  {compartments.map((compartment) => (
                    <div
                      key={compartment.id}
                      className="flex items-center justify-between p-3 bg-slate-50 rounded-xl"
                    >
                      <div className="flex items-center gap-3">
                        <CheckCircle className="w-4 h-4 text-emerald-500" />
                        <span className="text-sm text-slate-700">{compartment.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">AES-256-GCM</span>
                        <Badge variant="success">Encrypted</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </MedicalCard>

              {/* Last Audit */}
              <MedicalCard>
                <div className="flex items-center gap-3 p-4 bg-emerald-50 rounded-xl">
                  <Shield className="w-6 h-6 text-emerald-600" />
                  <div>
                    <p className="text-sm font-medium text-emerald-700">Last Security Audit</p>
                    <p className="text-xs text-emerald-600">
                      Completed {formatDateTime(Date.now() - 3 * 86400000)} &middot; All{' '}
                      {compartments.length} compartments verified
                    </p>
                  </div>
                </div>
              </MedicalCard>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </>
  );
}
