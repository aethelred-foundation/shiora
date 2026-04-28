/**
 * Shiora on Aethelred — Reproductive Data Vault Components
 *
 * Specialized UI components for the reproductive data vault:
 * compartment cards, cycle calendar, symptom logger,
 * fertility charts, jurisdiction badges, and privacy meters.
 */

'use client';

import React, { useState, useMemo } from 'react';
import {
  Lock,
  Unlock,
  Calendar,
  Heart,
  TrendingUp,
  Pill,
  TestTube2,
  ScanLine,
  Thermometer,
  Baby,
  Shield,
  Clock,
  Database,
  Users,
  Eye,
  Droplet,
  Frown,
  Smile,
  Zap,
  Apple,
  Droplets,
  Moon,
  Meh,
  AlertCircle,
  AlertTriangle,
  ThermometerSun,
  Angry,
  CloudRain,
  Battery,
  BatteryLow,
  Dumbbell,
  BatteryWarning,
  Wind,
  UtensilsCrossed,
  Sparkles,
  Circle,
  CircleDot,
  CloudMoon,
  MoonStar,
  Star,
  Snowflake,
  Cross,
  type LucideIcon,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
  ReferenceArea,
} from 'recharts';

import type {
  VaultCompartment,
  VaultCompartmentCategory,
  CycleEntry,
  CyclePhase,
  SymptomLog,
  SymptomCategory,
  FertilityMarker,
  VaultPrivacyScore,
} from '@/types';
import { VAULT_CATEGORIES, SYMPTOM_CATEGORIES, CYCLE_PHASE_COLORS, BRAND } from '@/lib/constants';
import { formatBytes, timeAgo, formatDate } from '@/lib/utils';

// ============================================================
// Icon maps
// ============================================================

const CATEGORY_ICONS: Record<VaultCompartmentCategory, React.ReactNode> = {
  cycle_tracking: <Calendar className="w-5 h-5" />,
  fertility_data: <Heart className="w-5 h-5" />,
  hormone_levels: <TrendingUp className="w-5 h-5" />,
  medications: <Pill className="w-5 h-5" />,
  lab_results: <TestTube2 className="w-5 h-5" />,
  imaging: <ScanLine className="w-5 h-5" />,
  symptoms: <Thermometer className="w-5 h-5" />,
  pregnancy: <Baby className="w-5 h-5" />,
};

const SYMPTOM_ICON_MAP: Record<string, React.ReactNode> = {
  pain: <Frown className="w-5 h-5" />,
  mood: <Smile className="w-5 h-5" />,
  energy: <Zap className="w-5 h-5" />,
  digestive: <Apple className="w-5 h-5" />,
  skin: <Droplets className="w-5 h-5" />,
  sleep: <Moon className="w-5 h-5" />,
  discharge: <Droplet className="w-5 h-5" />,
  temperature: <Thermometer className="w-5 h-5" />,
  other: <Eye className="w-5 h-5" />,
};

/** Map Lucide icon name strings to components for dynamic rendering */
const LUCIDE_ICON_MAP: Record<string, LucideIcon> = {
  Frown,
  Smile,
  Meh,
  Zap,
  Apple,
  Droplets,
  Moon,
  Droplet,
  Thermometer,
  AlertCircle,
  AlertTriangle,
  ThermometerSun,
  Angry,
  CloudRain,
  Battery,
  BatteryLow,
  Dumbbell,
  BatteryWarning,
  Wind,
  UtensilsCrossed,
  Sparkles,
  Circle,
  CircleDot,
  CloudMoon,
  MoonStar,
  Star,
  Snowflake,
  Cross,
};

/** Severity level icon configs: icon name + color */
const SEVERITY_ICONS: { name: string; color: string }[] = [
  { name: 'Smile', color: 'text-green-500' },
  { name: 'Meh', color: 'text-yellow-500' },
  { name: 'Frown', color: 'text-orange-500' },
  { name: 'AlertCircle', color: 'text-red-400' },
  { name: 'AlertTriangle', color: 'text-red-600' },
];

/** Render a Lucide icon by its string name */
function LucideIconByName({ name, className }: { name: string; className?: string }) {
  const IconComponent = LUCIDE_ICON_MAP[name];
  if (!IconComponent) return <Circle className={className} />;
  return <IconComponent className={className} />;
}

// ============================================================
// CompartmentCard — Visual card for each data compartment
// ============================================================

interface CompartmentCardProps {
  compartment: VaultCompartment;
  onLock: () => void;
  onUnlock: () => void;
}

export function CompartmentCard({ compartment, onLock, onUnlock }: CompartmentCardProps) {
  const catMeta = VAULT_CATEGORIES.find((c) => c.id === compartment.category);
  const color = catMeta?.color ?? /* istanbul ignore next */ '#8B1538';
  const isLocked = compartment.lockStatus === 'locked';

  return (
    <div
      className={`bg-white/70 backdrop-blur-sm border border-white/20 shadow-lg rounded-2xl p-5 transition-all duration-300 hover:shadow-xl ${
        isLocked ? 'opacity-75' : ''
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: `${color}15`, color }}
        >
          {CATEGORY_ICONS[compartment.category]}
        </div>
        <button
          onClick={isLocked ? onUnlock : onLock}
          className={`p-2 rounded-lg transition-colors ${
            isLocked
              ? 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
          }`}
          title={isLocked ? 'Unlock compartment' : 'Lock compartment'}
          aria-label={isLocked ? 'Unlock compartment' : 'Lock compartment'}
        >
          {isLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
        </button>
      </div>

      {/* Label & Description */}
      <h3 className="text-sm font-semibold text-slate-900 mb-1">{compartment.label}</h3>
      <p className="text-xs text-slate-500 mb-3 line-clamp-2">{compartment.description}</p>

      {/* Stats */}
      <div className="flex items-center gap-3 text-xs text-slate-500 mb-3">
        <span className="flex items-center gap-1">
          <Database className="w-3 h-3" />
          {compartment.recordCount} records
        </span>
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {formatBytes(compartment.storageUsed)}
        </span>
      </div>

      {/* Access list + timestamp */}
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1 text-xs text-slate-400">
          <Users className="w-3 h-3" />
          {compartment.accessList.length} provider{compartment.accessList.length !== 1 ? 's' : ''}
        </span>
        <span className="text-xs text-slate-400">{timeAgo(compartment.lastAccessed)}</span>
      </div>

      {/* Lock status badge */}
      <div className="mt-3 pt-3 border-t border-slate-100">
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
            isLocked
              ? 'bg-slate-100 text-slate-600'
              : compartment.lockStatus === 'partial'
                ? 'bg-amber-50 text-amber-700'
                : 'bg-emerald-50 text-emerald-700'
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isLocked
                ? 'bg-slate-500'
                : compartment.lockStatus === 'partial'
                  ? 'bg-amber-500'
                  : 'bg-emerald-500'
            }`}
          />
          {compartment.lockStatus.charAt(0).toUpperCase() + compartment.lockStatus.slice(1)}
        </span>
      </div>
    </div>
  );
}

// ============================================================
// CycleCalendar — Interactive calendar showing cycle phases
// ============================================================

interface CycleCalendarProps {
  entries: CycleEntry[];
  currentDay: number;
}

export function CycleCalendar({ entries, currentDay }: CycleCalendarProps) {
  // Build a 6-week grid (42 cells) from the entries
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const calendarDays = useMemo(() => {
    const today = new Date();
    const calendarStart = new Date(today);
    calendarStart.setDate(calendarStart.getDate() - 35); // Start ~5 weeks ago
    calendarStart.setDate(calendarStart.getDate() - calendarStart.getDay()); // Align to Sunday

    const days: Array<{
      date: Date;
      entry: CycleEntry | undefined;
      isToday: boolean;
    }> = [];

    for (let i = 0; i < 42; i++) {
      const d = new Date(calendarStart);
      d.setDate(d.getDate() + i);
      const dateKey = d.toISOString().slice(0, 10);
      const todayKey = today.toISOString().slice(0, 10);

      // Find matching entry by date
      const entry = entries.find((e) => {
        const entryDate = new Date(e.date).toISOString().slice(0, 10);
        return entryDate === dateKey;
      });

      days.push({
        date: d,
        entry,
        isToday: dateKey === todayKey,
      });
    }

    return days;
  }, [entries]);

  const flowDots = (flow: string) => {
    if (flow === 'light') return 1;
    if (flow === 'medium') return 2;
    if (flow === 'heavy') return 3;
    return 0;
  };

  return (
    <div className="space-y-4">
      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1">
        {dayNames.map((day) => (
          <div key={day} className="text-center text-xs font-medium text-slate-400 py-1">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((day, i) => {
          const phaseColors = day.entry ? CYCLE_PHASE_COLORS[day.entry.phase] : null;
          const dots = day.entry ? flowDots(day.entry.flow) : 0;

          return (
            <div
              key={i}
              className={`relative rounded-lg p-1.5 min-h-[3.5rem] text-center transition-all ${
                phaseColors ? 'border border-transparent' : 'border border-slate-100'
              } ${day.isToday ? 'ring-2 ring-brand-500 ring-offset-1' : ''}`}
              style={phaseColors ? { backgroundColor: phaseColors.fill } : undefined}
            >
              <span
                className={`text-xs font-medium ${phaseColors ? 'text-slate-700' : 'text-slate-400'}`}
              >
                {day.date.getDate()}
              </span>

              {/* Temperature overlay */}
              {day.entry && (
                <div className="text-[10px] text-slate-500 mt-0.5">
                  {day.entry.temperature.toFixed(1)}
                </div>
              )}

              {/* Flow dots */}
              {dots > 0 && (
                <div className="flex justify-center gap-0.5 mt-0.5">
                  {Array.from({ length: dots }).map((_, d) => (
                    <span key={d} className="w-1 h-1 rounded-full bg-rose-400" />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 pt-2 border-t border-slate-100">
        {(Object.keys(CYCLE_PHASE_COLORS) as CyclePhase[]).map((phase) => (
          <div key={phase} className="flex items-center gap-2 text-xs text-slate-600">
            <span
              className="w-3 h-3 rounded"
              style={{ backgroundColor: CYCLE_PHASE_COLORS[phase].fill }}
            />
            {CYCLE_PHASE_COLORS[phase].label}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// SymptomLogger — Symptom logging interface
// ============================================================

interface SymptomLoggerProps {
  categories: typeof SYMPTOM_CATEGORIES;
  onLog: (symptom: Omit<SymptomLog, 'id'>) => void;
  recentLogs: SymptomLog[];
}

export function SymptomLogger({ categories, onLog, recentLogs }: SymptomLoggerProps) {
  const [selectedCategory, setSelectedCategory] = useState<SymptomCategory | null>(null);
  const [severity, setSeverity] = useState<number>(3);
  const [notes, setNotes] = useState('');

  const SeverityIcon = ({ level }: { level: number }) => {
    const config = SEVERITY_ICONS[level - 1];
    /* istanbul ignore next -- severity is always 1-5 from the UI */
    if (!config) return null;
    return <LucideIconByName name={config.name} className={`w-5 h-5 ${config.color}`} />;
  };

  const handleLog = () => {
    /* istanbul ignore next -- guard: button is disabled when no category selected */
    if (!selectedCategory) return;
    onLog({
      date: Date.now(),
      category: selectedCategory,
      symptom:
        categories.find((c) => c.id === selectedCategory)?.label ??
        /* istanbul ignore next */
        selectedCategory,
      severity: severity as 1 | 2 | 3 | 4 | 5,
      notes,
      tags: [],
    });
    setSelectedCategory(null);
    setSeverity(3);
    setNotes('');
  };

  return (
    <div className="space-y-6">
      {/* Category grid */}
      <div>
        <h4 className="text-sm font-medium text-slate-700 mb-3">Select Category</h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id as SymptomCategory)}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm transition-all ${
                selectedCategory === cat.id
                  ? 'bg-brand-50 text-brand-700 ring-2 ring-brand-500'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <LucideIconByName name={cat.icons[0]} className="w-5 h-5" />
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Severity slider */}
      {selectedCategory && (
        <div>
          <h4 className="text-sm font-medium text-slate-700 mb-3 flex items-center gap-2">
            Severity: {severity}/5 <SeverityIcon level={severity} />
          </h4>
          <input
            type="range"
            min={1}
            max={5}
            step={1}
            value={severity}
            onChange={(e) => setSeverity(parseInt(e.target.value))}
            className="w-full h-2 bg-slate-200 rounded-full appearance-none cursor-pointer accent-brand-500"
          />
          <div className="flex justify-between text-xs text-slate-400 mt-1">
            <span>Mild</span>
            <span>Severe</span>
          </div>
        </div>
      )}

      {/* Notes */}
      {selectedCategory && (
        <div>
          <h4 className="text-sm font-medium text-slate-700 mb-2">Notes (optional)</h4>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add any additional details..."
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent resize-none h-20"
          />
        </div>
      )}

      {/* Log button */}
      {selectedCategory && (
        <button
          onClick={handleLog}
          className="w-full px-4 py-2.5 bg-brand-500 text-white text-sm font-medium rounded-xl hover:bg-brand-600 transition-colors"
        >
          Log Symptom
        </button>
      )}

      {/* Recent symptom timeline */}
      <div>
        <h4 className="text-sm font-medium text-slate-700 mb-3">Recent Symptoms</h4>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {recentLogs.slice(0, 10).map((log) => {
            const catMeta = categories.find((c) => c.id === log.category);
            return (
              <div
                key={log.id}
                className="flex items-center gap-3 px-3 py-2 bg-slate-50 rounded-xl text-sm"
              >
                <LucideIconByName
                  name={
                    catMeta?.icons[Math.min(log.severity - 1, 4)] ??
                    /* istanbul ignore next */
                    'Circle'
                  }
                  className="w-5 h-5 text-slate-500"
                />
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-slate-700">{log.symptom}</span>
                  <span className="text-slate-400 ml-2">Severity {log.severity}/5</span>
                </div>
                <span className="text-xs text-slate-400 whitespace-nowrap">
                  {timeAgo(log.date)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// FertilityChart — Chart showing fertility prediction
// ============================================================

interface FertilityChartProps {
  entries: CycleEntry[];
  markers: FertilityMarker[];
  fertileStart: number;
  fertileEnd: number;
}

export function FertilityChart({
  entries,
  markers,
  fertileStart,
  fertileEnd,
}: FertilityChartProps) {
  // Take last 28 entries for one cycle view
  const chartData = useMemo(() => {
    const last28 = entries.slice(-28);
    return last28.map((entry) => ({
      day: `Day ${entry.day}`,
      dayNum: entry.day,
      temperature: entry.temperature,
      fertility: entry.fertilityScore,
      phase: entry.phase,
    }));
  }, [entries]);

  return (
    <div className="space-y-4">
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="fertilityGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={BRAND.sky} stopOpacity={0.3} />
              <stop offset="95%" stopColor={BRAND.sky} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="tempGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis
            dataKey="day"
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            tickLine={false}
            axisLine={{ stroke: '#e2e8f0' }}
          />
          <YAxis
            yAxisId="temp"
            domain={[96.5, 99]}
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            tickLine={false}
            axisLine={{ stroke: '#e2e8f0' }}
            orientation="left"
            label={{
              value: 'Temp (F)',
              angle: -90,
              position: 'insideLeft',
              style: { fontSize: 10, fill: '#94a3b8' },
            }}
          />
          <YAxis
            yAxisId="fertility"
            domain={[0, 100]}
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            tickLine={false}
            axisLine={{ stroke: '#e2e8f0' }}
            orientation="right"
            label={{
              value: 'Fertility %',
              angle: 90,
              position: 'insideRight',
              style: { fontSize: 10, fill: '#94a3b8' },
            }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              fontSize: '12px',
            }}
          />
          {/* Fertile window highlight */}
          <ReferenceArea
            yAxisId="fertility"
            x1="Day 10"
            x2="Day 16"
            fill="#a78bfa"
            fillOpacity={0.1}
            label={{
              value: 'Fertile Window',
              position: 'top',
              style: { fontSize: 10, fill: '#a78bfa' },
            }}
          />
          {/* BBT shift line */}
          <ReferenceLine
            yAxisId="temp"
            y={97.6}
            stroke="#f43f5e"
            strokeDasharray="4 4"
            strokeOpacity={0.5}
            label={{
              value: 'BBT Shift',
              position: 'left',
              style: { fontSize: 10, fill: '#f43f5e' },
            }}
          />
          {/* Temperature line */}
          <Area
            yAxisId="temp"
            type="monotone"
            dataKey="temperature"
            stroke="#f43f5e"
            fill="url(#tempGradient)"
            strokeWidth={2}
            dot={{ r: 2, fill: '#f43f5e' }}
            name="Temperature"
          />
          {/* Fertility area */}
          <Area
            yAxisId="fertility"
            type="monotone"
            dataKey="fertility"
            stroke={BRAND.sky}
            fill="url(#fertilityGradient)"
            strokeWidth={2}
            dot={false}
            name="Fertility"
          />
        </AreaChart>
      </ResponsiveContainer>

      {/* Ovulation marker legend */}
      <div className="flex flex-wrap gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-rose-500 rounded" />
          Temperature
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-brand-100 border border-brand-300" />
          Fertility Score
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-violet-100 border border-violet-300" />
          Fertile Window
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 border-t-2 border-dashed border-rose-400" />
          BBT Shift Line
        </span>
      </div>
    </div>
  );
}

// ============================================================
// JurisdictionBadge — Shows jurisdiction protection level
// ============================================================

interface JurisdictionBadgeProps {
  jurisdiction: string;
  protectionLevel: 'high' | 'medium' | 'low';
}

export function JurisdictionBadge({ jurisdiction, protectionLevel }: JurisdictionBadgeProps) {
  const colors = {
    high: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    medium: 'bg-amber-50 text-amber-700 border-amber-200',
    low: 'bg-red-50 text-red-700 border-red-200',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${colors[protectionLevel]}`}
    >
      <Shield className="w-3.5 h-3.5" />
      {jurisdiction}
    </span>
  );
}

// ============================================================
// PrivacyMeter — Visual privacy score display
// ============================================================

interface PrivacyMeterProps {
  score: VaultPrivacyScore;
}

export function PrivacyMeter({ score }: PrivacyMeterProps) {
  const getColor = (value: number) => {
    if (value >= 80) return { stroke: '#10b981', bg: '#d1fae5', text: 'text-emerald-600' };
    if (value >= 60) return { stroke: '#f59e0b', bg: '#fef3c7', text: 'text-amber-600' };
    return { stroke: '#ef4444', bg: '#fee2e2', text: 'text-red-600' };
  };

  const mainColor = getColor(score.overall);
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const progress = (score.overall / 100) * circumference;

  const subScores = [
    { label: 'Encryption', value: score.encryptionScore },
    { label: 'Access Control', value: score.accessControlScore },
    { label: 'Jurisdiction', value: score.jurisdictionScore },
    { label: 'Data Minimization', value: score.dataMinimizationScore },
  ];

  return (
    <div className="space-y-6">
      {/* Circular progress */}
      <div className="flex justify-center">
        <div className="relative w-32 h-32">
          <svg width="128" height="128" className="-rotate-90">
            <circle cx="64" cy="64" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="8" />
            <circle
              cx="64"
              cy="64"
              r={radius}
              fill="none"
              stroke={mainColor.stroke}
              strokeWidth="8"
              strokeDasharray={circumference}
              strokeDashoffset={circumference - progress}
              strokeLinecap="round"
              className="transition-all duration-700"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-3xl font-bold ${mainColor.text}`}>{score.overall}</span>
            <span className="text-xs text-slate-400">Privacy Score</span>
          </div>
        </div>
      </div>

      {/* Sub-scores as horizontal bars */}
      <div className="space-y-3">
        {subScores.map((sub) => {
          const c = getColor(sub.value);
          return (
            <div key={sub.label}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-slate-600">{sub.label}</span>
                <span className={`text-xs font-bold ${c.text}`}>{sub.value}</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${sub.value}%`, backgroundColor: c.stroke }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
