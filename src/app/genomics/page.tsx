/**
 * Shiora on Aethelred — Genomics & Biomarker Lab Page
 *
 * View genomic profile, pharmacogenomic drug-gene interactions,
 * biomarker trends, polygenic risk scores, and generated reports.
 *
 * 5 Tabs: Overview | Pharmacogenomics | Biomarkers | Risk Scores | Reports
 */

'use client';

import { useState, useMemo } from 'react';
import {
  Dna, TestTube2, Activity, Shield, ShieldCheck,
  AlertTriangle, CheckCircle, TrendingUp, TrendingDown, Minus,
  ChevronRight, Eye, FileText, Pill, Heart, Brain,
  Droplets, CircleDot, Ribbon, Zap,
} from 'lucide-react';

import { useApp } from '@/contexts/AppContext';
import {
  TopNav, Footer, ToastContainer, SearchOverlay,
  Badge, Tabs, ProgressRing,
} from '@/components/ui/SharedComponents';
import {
  MedicalCard, HealthMetricCard, SectionHeader,
  ChartTooltip, TEEBadge, StatusBadge, TruncatedHash, EncryptionBadge,
} from '@/components/ui/PagePrimitives';
import {
  GenomicProfileCard,
  PharmacogenomicRow,
  BiomarkerCard,
  BiomarkerTrendChart,
  RiskScoreRadar,
  RiskScoreCard,
  GeneVariantBadge,
  GenomicReportCard,
  MetabolismBadge,
} from '@/components/genomics/GenomicsComponents';
import { useGenomics } from '@/hooks/useGenomics';
import { BRAND, CHART_COLORS, GENOMIC_RISK_CATEGORIES, BIOMARKER_TYPES } from '@/lib/constants';
import {
  seededRandom, seededInt, seededHex, seededPick,
  generateTxHash, formatNumber, timeAgo, formatDateTime, generateAttestation,
} from '@/lib/utils';
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ReferenceLine,
} from 'recharts';

// ============================================================
// Constants
// ============================================================

const SEED = 2600;

const TAB_ITEMS = [
  { id: 'overview', label: 'Overview' },
  { id: 'pharmacogenomics', label: 'Pharmacogenomics' },
  { id: 'biomarkers', label: 'Biomarkers' },
  { id: 'risk-scores', label: 'Risk Scores' },
  { id: 'reports', label: 'Reports' },
];

// ============================================================
// Main Page
// ============================================================

export default function GenomicsPage() {
  const { wallet } = useApp();
  const genomics = useGenomics();

  const [activeTab, setActiveTab] = useState('overview');

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
                <Dna className="w-6 h-6 text-brand-600" />
                <h1 className="text-2xl font-bold text-slate-900">Genomics & Biomarker Lab</h1>
              </div>
              <p className="text-sm text-slate-500">
                Pharmacogenomics, biomarker tracking, and polygenic risk analysis with TEE attestation
              </p>
            </div>
            <div className="flex items-center gap-2">
              <EncryptionBadge type="AES-256-GCM" />
              <TEEBadge platform="Intel SGX" verified />
            </div>
          </div>

          {/* ---- Stats ---- */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
            <HealthMetricCard
              icon={<Dna className="w-5 h-5" />}
              label="Variants Analyzed"
              value={formatNumber(genomics.overview?.profile.totalVariants ?? 0)}
              sparklineData={[3800, 3900, 4100, 4200, 4350, 4450, 4521, 4521]}
              sparklineColor={BRAND.sky}
            />
            <HealthMetricCard
              icon={<Pill className="w-5 h-5" />}
              label="Drug Sensitivity Flags"
              value={(genomics.overview?.profile.pharmacogenomicFlags ?? 0).toString()}
              unit="drug-gene"
              sparklineData={[3, 3, 4, 4, 5, 5, 5, 5]}
              sparklineColor="#a78bfa"
            />
            <HealthMetricCard
              icon={<TestTube2 className="w-5 h-5" />}
              label="Active Biomarkers"
              value={(genomics.overview?.biomarkerCount ?? 0).toString()}
              unit="tracked"
              sparklineData={[6, 7, 7, 8, 8, 9, 10, 10]}
              sparklineColor="#10b981"
            />
            <HealthMetricCard
              icon={<Activity className="w-5 h-5" />}
              label="Risk Categories"
              value={(genomics.overview?.riskScoreCount ?? 0).toString()}
              unit="assessed"
              sparklineData={[4, 4, 5, 5, 6, 6, 6, 6]}
              sparklineColor="#fb923c"
            />
          </div>

          {/* ---- Tabs ---- */}
          <Tabs
            tabs={TAB_ITEMS}
            activeTab={activeTab}
            onChange={setActiveTab}
            className="mb-8"
          />

          {/* ---- Tab Content ---- */}
          {activeTab === 'overview' && <OverviewTab genomics={genomics} />}
          {activeTab === 'pharmacogenomics' && <PharmacogenomicsTab genomics={genomics} />}
          {activeTab === 'biomarkers' && <BiomarkersTab genomics={genomics} />}
          {activeTab === 'risk-scores' && <RiskScoresTab genomics={genomics} />}
          {activeTab === 'reports' && <ReportsTab genomics={genomics} />}

        </div>
      </main>

      <Footer />
    </>
  );
}

// ============================================================
// Overview Tab
// ============================================================

function OverviewTab({ genomics }: { genomics: ReturnType<typeof useGenomics> }) {
  if (!genomics.overview) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400 text-sm">
        Loading genomic profile...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <GenomicProfileCard overview={genomics.overview} />

      {/* Quick summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MedicalCard>
          <div className="flex items-center gap-3 mb-2">
            <Pill className="w-5 h-5 text-brand-600" />
            <span className="text-sm font-medium text-slate-700">Pharmacogenomics</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{genomics.overview.pharmacogenomicCount}</p>
          <p className="text-xs text-slate-400">drug-gene interactions analyzed</p>
        </MedicalCard>
        <MedicalCard>
          <div className="flex items-center gap-3 mb-2">
            <TestTube2 className="w-5 h-5 text-emerald-600" />
            <span className="text-sm font-medium text-slate-700">Biomarkers</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{genomics.overview.biomarkerCount}</p>
          <p className="text-xs text-slate-400">markers tracked with trend data</p>
        </MedicalCard>
        <MedicalCard>
          <div className="flex items-center gap-3 mb-2">
            <Activity className="w-5 h-5 text-amber-600" />
            <span className="text-sm font-medium text-slate-700">Risk Scores</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{genomics.overview.riskScoreCount}</p>
          <p className="text-xs text-slate-400">polygenic risk assessments</p>
        </MedicalCard>
        <MedicalCard>
          <div className="flex items-center gap-3 mb-2">
            <FileText className="w-5 h-5 text-violet-600" />
            <span className="text-sm font-medium text-slate-700">Reports</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{genomics.overview.reportCount}</p>
          <p className="text-xs text-slate-400">genomic reports generated</p>
        </MedicalCard>
      </div>

      {/* High risk alert card */}
      {genomics.overview.highRiskConditions.length > 0 && (
        <MedicalCard className="border-amber-200 bg-amber-50/30">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <h3 className="text-sm font-semibold text-amber-800">High Risk Conditions Alert</h3>
          </div>
          <div className="space-y-2">
            {genomics.overview.highRiskConditions.slice(0, 3).map((condition, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-amber-700">
                <ChevronRight className="w-3.5 h-3.5 text-amber-500" />
                {condition}
              </div>
            ))}
          </div>
        </MedicalCard>
      )}
    </div>
  );
}

// ============================================================
// Pharmacogenomics Tab
// ============================================================

function PharmacogenomicsTab({ genomics }: { genomics: ReturnType<typeof useGenomics> }) {
  return (
    <div>
      <SectionHeader
        title="Drug-Gene Interactions"
        subtitle="Pharmacogenomic analysis of 8 key gene variants affecting drug metabolism"
        size="sm"
        icon={Pill}
      />

      <MedicalCard padding={false}>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/50">
                <th className="py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Gene / Variant</th>
                <th className="py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">RS ID</th>
                <th className="py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Drug / Category</th>
                <th className="py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Metabolism</th>
                <th className="py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Recommendation</th>
                <th className="py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Evidence</th>
                <th className="py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">TEE</th>
              </tr>
            </thead>
            <tbody>
              {genomics.pharmacogenomics.map((result) => (
                <PharmacogenomicRow key={result.id} result={result} />
              ))}
            </tbody>
          </table>
        </div>

        {genomics.pharmacogenomics.length === 0 && (
          <div className="flex items-center justify-center py-16 text-slate-400 text-sm">
            Loading pharmacogenomic data...
          </div>
        )}
      </MedicalCard>

      {/* Guideline source legend */}
      {genomics.pharmacogenomics.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-500">
          <span><strong>CPIC</strong> — Clinical Pharmacogenetics Implementation Consortium</span>
          <span><strong>DPWG</strong> — Dutch Pharmacogenetics Working Group</span>
          <span><strong>PharmGKB</strong> — Pharmacogenomics Knowledge Base</span>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Biomarkers Tab — 10 biomarker cards in a grid with sparklines
// ============================================================

function BiomarkersTab({ genomics }: { genomics: ReturnType<typeof useGenomics> }) {
  const { biomarkers } = genomics;

  return (
    <div>
      <SectionHeader
        title="Biomarker Tracking"
        subtitle="Monitor 10 key health biomarkers with trend analysis and reference range visualization"
        size="sm"
        icon={TestTube2}
      />

      {biomarkers.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {biomarkers.map((bm) => (
            <BiomarkerCard key={bm.id} biomarker={bm} />
          ))}
        </div>
      ) : (
        <div className="flex items-center justify-center py-20 text-slate-400 text-sm">
          Loading biomarker data...
        </div>
      )}
    </div>
  );
}

// ============================================================
// Risk Scores Tab
// ============================================================

function RiskScoresTab({ genomics }: { genomics: ReturnType<typeof useGenomics> }) {
  const { riskScores } = genomics;

  return (
    <div>
      <SectionHeader
        title="Polygenic Risk Scores"
        subtitle="Multi-gene risk assessment across 6 major conditions"
        size="sm"
        icon={Activity}
      />

      {riskScores.length > 0 ? (
        <>
          {/* Radar chart */}
          <div className="mb-8">
            <RiskScoreRadar scores={riskScores} />
          </div>

          {/* Risk score cards grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {riskScores.map((score) => (
              <RiskScoreCard key={score.id} score={score} />
            ))}
          </div>
        </>
      ) : (
        <div className="flex items-center justify-center py-20 text-slate-400 text-sm">
          Loading risk scores...
        </div>
      )}
    </div>
  );
}

// ============================================================
// Reports Tab
// ============================================================

function ReportsTab({ genomics }: { genomics: ReturnType<typeof useGenomics> }) {
  const { reports, generateReport } = genomics;

  return (
    <div>
      <SectionHeader
        title="Genomic Reports"
        subtitle="TEE-verified comprehensive analysis reports"
        size="sm"
        icon={FileText}
        action={
          <button
            onClick={() => generateReport.mutate('General')}
            disabled={generateReport.isLoading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-700 transition-colors shadow-sm disabled:opacity-50"
          >
            <FileText className="w-4 h-4" />
            {generateReport.isLoading ? 'Generating...' : 'Generate Report'}
          </button>
        }
      />

      {reports.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {reports.map((report) => (
            <GenomicReportCard key={report.id} report={report} />
          ))}
        </div>
      ) : (
        <div className="flex items-center justify-center py-20 text-slate-400 text-sm">
          Loading reports...
        </div>
      )}
    </div>
  );
}
