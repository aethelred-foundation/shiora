/**
 * Shiora on Aethelred — Clinical Decision Support Page
 *
 * AI-powered clinical pathways, drug interaction checks, differential
 * diagnosis engine, and immutable audit trail with TEE attestation.
 */

'use client';

import { useState, useMemo } from 'react';
import {
  Stethoscope,
  Activity,
  Pill,
  AlertTriangle,
  ShieldCheck,
  CheckCircle,
  Clock,
  Bell,
  FileSearch,
  Brain,
  Heart,
  Clipboard,
  ChevronRight,
  Info,
  Shield,
  BarChart3,
  ListChecks,
  FlaskConical,
  ScrollText,
} from 'lucide-react';

import { useApp } from '@/contexts/AppContext';
import {
  TopNav,
  Footer,
  ToastContainer,
  SearchOverlay,
  Badge,
  Tabs,
  ProgressRing,
} from '@/components/ui/SharedComponents';
import {
  MedicalCard,
  HealthMetricCard,
  SectionHeader,
  ChartTooltip,
  StatusBadge,
  TEEBadge,
  TruncatedHash,
} from '@/components/ui/PagePrimitives';
import {
  ClinicalAlertCard,
  PathwayFlowchart,
  DrugInteractionRow,
  DifferentialCard,
  AuditTrailTable,
} from '@/components/clinical/ClinicalComponents';
import { useClinicalDecisionSupport } from '@/hooks/useClinicalDecisionSupport';
import { BRAND, CHART_COLORS } from '@/lib/constants';
import {
  seededRandom,
  seededInt,
  seededHex,
  formatNumber,
  formatPercent,
  timeAgo,
  formatDate,
  generateAttestation,
} from '@/lib/utils';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

// ============================================================
// Constants
// ============================================================

const SEED = 2100;

const TAB_ITEMS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'pathways', label: 'Pathways' },
  { id: 'interactions', label: 'Drug Interactions' },
  { id: 'differentials', label: 'Differentials' },
  { id: 'audit', label: 'Audit Trail' },
];

// ============================================================
// Radar chart data (decision confidence across 6 categories)
// ============================================================

const CONFIDENCE_CATEGORIES = [
  'Drug Checks',
  'Pathways',
  'Differentials',
  'Guidelines',
  'Alerts',
  'Risk Scoring',
];

function generateRadarData() {
  return CONFIDENCE_CATEGORIES.map((cat, i) => ({
    category: cat,
    accuracy: Math.round(seededRandom(SEED + 50 + i * 7) * 15 + 83),
    fullMark: 100,
  }));
}

// ============================================================
// Main Page
// ============================================================

export default function ClinicalDecisionSupportPage() {
  const { wallet } = useApp();
  const clinical = useClinicalDecisionSupport();

  return (
    <>
      <TopNav />
      <SearchOverlay />
      <ToastContainer />

      <main id="main-content" className="flex-1">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          {/* ---- Header ---- */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Stethoscope className="w-6 h-6 text-brand-600" />
                <h1 className="text-2xl font-bold text-slate-900">Clinical Decision Support</h1>
              </div>
              <p className="text-sm text-slate-500">
                AI-powered clinical pathways, drug interaction checks, and differential diagnosis
                with TEE-verified audit trail
              </p>
            </div>
            <div className="flex items-center gap-2">
              <TEEBadge platform="Intel SGX" verified />
            </div>
          </div>

          {/* ---- Stats ---- */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
            <HealthMetricCard
              icon={<Bell className="w-5 h-5" />}
              label="Active Alerts"
              value={(clinical.stats?.activeClinicalAlerts ?? 0).toString()}
              sparklineData={[3, 4, 3, 5, 4, 5, 5, 5]}
              sparklineColor="#f43f5e"
            />
            <HealthMetricCard
              icon={<ListChecks className="w-5 h-5" />}
              label="Active Pathways"
              value={(clinical.stats?.activePathways ?? 0).toString()}
              sparklineData={[2, 2, 2, 3, 3, 3, 3, 3]}
              sparklineColor="#a78bfa"
            />
            <HealthMetricCard
              icon={<Pill className="w-5 h-5" />}
              label="Drug Checks Today"
              value={(clinical.stats?.drugChecksToday ?? 0).toString()}
              sparklineData={[18, 22, 25, 30, 28, 32, 35, clinical.stats?.drugChecksToday ?? 30]}
              sparklineColor={BRAND.sky}
            />
            <HealthMetricCard
              icon={<ShieldCheck className="w-5 h-5" />}
              label="Guideline Compliance"
              value={formatPercent(clinical.stats?.guidelineComplianceScore ?? 0, 0)}
              sparklineData={[
                85,
                86,
                88,
                87,
                89,
                90,
                91,
                clinical.stats?.guidelineComplianceScore ?? 90,
              ]}
              sparklineColor="#10b981"
            />
          </div>

          {/* ---- Tabs ---- */}
          <Tabs
            tabs={TAB_ITEMS}
            activeTab={clinical.activeTab}
            onChange={(t) => clinical.setActiveTab(t as any)}
            className="mb-8"
          />

          {/* ---- Tab Content ---- */}
          {clinical.activeTab === 'dashboard' && <DashboardTab clinical={clinical} />}
          {clinical.activeTab === 'pathways' && <PathwaysTab clinical={clinical} />}
          {clinical.activeTab === 'interactions' && <InteractionsTab clinical={clinical} />}
          {clinical.activeTab === 'differentials' && <DifferentialsTab clinical={clinical} />}
          {clinical.activeTab === 'audit' && <AuditTab clinical={clinical} />}
        </div>
      </main>

      <Footer />
    </>
  );
}

// ============================================================
// Dashboard Tab
// ============================================================

function DashboardTab({ clinical }: { clinical: ReturnType<typeof useClinicalDecisionSupport> }) {
  const radarData = useMemo(() => generateRadarData(), []);

  return (
    <div className="space-y-8">
      {/* Two-column layout: Alerts + Radar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Clinical Alerts */}
        <div>
          <SectionHeader
            title="Clinical Alerts"
            subtitle="Top priority alerts requiring attention"
            size="sm"
            icon={Bell}
          />
          <div className="space-y-3">
            {clinical.alerts.length > 0 ? (
              clinical.alerts
                .slice(0, 5)
                .map((alert) => <ClinicalAlertCard key={alert.id} alert={alert} />)
            ) : (
              <MedicalCard>
                <div className="flex items-center justify-center py-12 text-slate-400 text-sm">
                  Loading clinical alerts...
                </div>
              </MedicalCard>
            )}
          </div>
        </div>

        {/* Decision Confidence Radar */}
        <div>
          <SectionHeader
            title="Decision Confidence"
            subtitle="AI model accuracy across clinical categories"
            size="sm"
            icon={BarChart3}
          />
          <MedicalCard>
            <div className="w-full" style={{ height: 360 }}>
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="75%">
                  <PolarGrid stroke="#e2e8f0" />
                  <PolarAngleAxis dataKey="category" tick={{ fill: '#64748b', fontSize: 11 }} />
                  <PolarRadiusAxis
                    angle={30}
                    domain={[60, 100]}
                    tick={{ fill: '#94a3b8', fontSize: 10 }}
                    tickCount={5}
                  />
                  <Radar
                    name="Accuracy"
                    dataKey="accuracy"
                    stroke={BRAND.sky}
                    fill={BRAND.sky}
                    fillOpacity={0.2}
                    strokeWidth={2}
                  />
                  <Tooltip content={<ChartTooltip formatValue={(v) => `${v}%`} />} />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-4 justify-center pt-2 border-t border-slate-100 mt-2">
              {radarData.map((d, i) => (
                <div key={d.category} className="flex items-center gap-1.5">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                  />
                  <span className="text-xs text-slate-600">
                    {d.category}: <strong>{d.accuracy}%</strong>
                  </span>
                </div>
              ))}
            </div>
          </MedicalCard>
        </div>
      </div>

      {/* Quick pathway overview */}
      <div>
        <SectionHeader
          title="Active Pathways Overview"
          subtitle={`${clinical.pathways.length} clinical pathways in progress`}
          size="sm"
          icon={ListChecks}
          action={
            <button
              onClick={() => clinical.setActiveTab('pathways')}
              className="inline-flex items-center gap-1 text-sm text-brand-600 hover:text-brand-700 font-medium"
            >
              View All <ChevronRight className="w-4 h-4" />
            </button>
          }
        />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {clinical.pathways.slice(0, 3).map((pw) => {
            const completedSteps = pw.steps.filter((s) => s.status === 'completed').length;
            const totalSteps = pw.steps.length;
            const progressPercent = Math.round((completedSteps / totalSteps) * 100);

            return (
              <MedicalCard key={pw.id} onClick={() => clinical.setActiveTab('pathways')}>
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center">
                    <Activity className="w-5 h-5 text-brand-600" />
                  </div>
                  <ProgressRing value={progressPercent} size={40} strokeWidth={4} />
                </div>
                <h4 className="text-sm font-semibold text-slate-900 mb-1">{pw.name}</h4>
                <p className="text-xs text-slate-500 mb-2">
                  {completedSteps} of {totalSteps} steps completed
                </p>
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand-600 rounded-full transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </MedicalCard>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Pathways Tab
// ============================================================

function PathwaysTab({ clinical }: { clinical: ReturnType<typeof useClinicalDecisionSupport> }) {
  return (
    <div>
      <SectionHeader
        title="Clinical Pathways"
        subtitle="Evidence-based care protocols with TEE-verified step completion"
        size="sm"
        icon={ListChecks}
      />

      {clinical.pathways.length > 0 ? (
        <div className="space-y-6">
          {clinical.pathways.map((pathway) => (
            <PathwayFlowchart key={pathway.id} pathway={pathway} />
          ))}
        </div>
      ) : (
        <MedicalCard>
          <div className="flex items-center justify-center py-20 text-slate-400 text-sm">
            Loading clinical pathways...
          </div>
        </MedicalCard>
      )}
    </div>
  );
}

// ============================================================
// Drug Interactions Tab
// ============================================================

function InteractionsTab({
  clinical,
}: {
  clinical: ReturnType<typeof useClinicalDecisionSupport>;
}) {
  return (
    <div>
      <SectionHeader
        title="Drug Interaction Analysis"
        subtitle="TEE-verified drug-drug interaction checks across active medications"
        size="sm"
        icon={Pill}
      />

      <MedicalCard padding={false}>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/50">
                <th className="py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Drug A
                </th>
                <th className="py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Drug B
                </th>
                <th className="py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Severity
                </th>
                <th className="py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Mechanism
                </th>
                <th className="py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Clinical Effect
                </th>
                <th className="py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Recommendation
                </th>
                <th className="py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Evidence
                </th>
                <th className="py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  TEE
                </th>
              </tr>
            </thead>
            <tbody>
              {clinical.interactions.map((interaction) => (
                <DrugInteractionRow key={interaction.id} interaction={interaction} />
              ))}
            </tbody>
          </table>
        </div>

        {clinical.interactions.length === 0 && (
          <div className="flex items-center justify-center py-16 text-slate-400 text-sm">
            Loading drug interaction data...
          </div>
        )}
      </MedicalCard>
    </div>
  );
}

// ============================================================
// Differentials Tab
// ============================================================

function DifferentialsTab({
  clinical,
}: {
  clinical: ReturnType<typeof useClinicalDecisionSupport>;
}) {
  return (
    <div>
      <SectionHeader
        title="Differential Diagnosis"
        subtitle="AI-generated differential diagnoses ranked by probability with TEE attestation"
        size="sm"
        icon={Brain}
      />

      {clinical.differentials.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {clinical.differentials.map((dx) => (
            <DifferentialCard key={dx.id} diagnosis={dx} />
          ))}
        </div>
      ) : (
        <MedicalCard>
          <div className="flex items-center justify-center py-20 text-slate-400 text-sm">
            Loading differential diagnoses...
          </div>
        </MedicalCard>
      )}
    </div>
  );
}

// ============================================================
// Audit Trail Tab
// ============================================================

function AuditTab({ clinical }: { clinical: ReturnType<typeof useClinicalDecisionSupport> }) {
  return (
    <div>
      <SectionHeader
        title="Clinical Decision Audit Trail"
        subtitle="Immutable, TEE-attested record of all clinical AI decisions"
        size="sm"
        icon={ScrollText}
      />

      <AuditTrailTable entries={clinical.auditEntries} />
    </div>
  );
}
