/**
 * Shiora on Aethelred — Digital Health Twin Page
 *
 * View and interact with your digital twin: organ system health,
 * what-if simulations, adjustable parameters, biomarker predictions,
 * and a complete activity timeline.
 */

'use client';

import { useState, useMemo } from 'react';
import {
  Fingerprint, Heart, Wind, Brain, Zap, Bone, Apple,
  Droplets, CircleDot, Shield, Baby, Activity,
  Play, Sliders, TrendingUp, Clock, RefreshCw,
  Settings, ChevronRight, AlertTriangle, CheckCircle,
} from 'lucide-react';

import { useApp } from '@/contexts/AppContext';
import {
  TopNav, Footer, ToastContainer, SearchOverlay,
  Badge, Tabs, ProgressRing,
} from '@/components/ui/SharedComponents';
import {
  MedicalCard, HealthMetricCard, SectionHeader,
  ChartTooltip, TEEBadge, StatusBadge, TruncatedHash,
} from '@/components/ui/PagePrimitives';
import {
  OrganScoreCard,
  SimulationCard,
  SimulationDetailChart,
  ParameterSlider,
  PredictionCard,
  TimelineEventItem,
} from '@/components/twin/TwinComponents';
import { useDigitalTwin } from '@/hooks/useDigitalTwin';
import { BRAND, CHART_COLORS, ORGAN_SYSTEMS } from '@/lib/constants';
import {
  seededRandom, seededInt, seededHex, formatNumber,
  timeAgo, generateAttestation,
} from '@/lib/utils';

// ============================================================
// Constants
// ============================================================

const SEED = 2200;

const TAB_ITEMS = [
  { id: 'my-twin', label: 'My Twin' },
  { id: 'simulations', label: 'Simulations' },
  { id: 'parameters', label: 'Parameters' },
  { id: 'predictions', label: 'Predictions' },
  { id: 'timeline', label: 'Timeline' },
];

// ============================================================
// Main Page
// ============================================================

export default function TwinPage() {
  const { wallet } = useApp();
  const twin = useDigitalTwin();

  const [activeTab, setActiveTab] = useState('my-twin');

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
                <Fingerprint className="w-6 h-6 text-brand-600" />
                <h1 className="text-2xl font-bold text-slate-900">Digital Health Twin</h1>
              </div>
              <p className="text-sm text-slate-500">
                Comprehensive health simulation engine with TEE-attested predictions and what-if analysis
              </p>
            </div>
            <div className="flex items-center gap-2">
              <TEEBadge platform="Intel SGX" verified />
            </div>
          </div>

          {/* ---- Stats ---- */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
            <HealthMetricCard
              icon={<Activity className="w-5 h-5" />}
              label="Overall Health Score"
              value={(twin.twin?.overallHealthScore ?? 0).toString()}
              unit="/ 100"
              sparklineData={[72, 74, 73, 76, 78, 77, 80, twin.twin?.overallHealthScore ?? 80]}
              sparklineColor={BRAND.sky}
            />
            <HealthMetricCard
              icon={<Heart className="w-5 h-5" />}
              label="Organ Systems"
              value={(twin.twin?.organScores.length ?? 10).toString()}
              unit="monitored"
              sparklineData={[8, 8, 9, 9, 10, 10, 10, 10]}
              sparklineColor="#f43f5e"
            />
            <HealthMetricCard
              icon={<Play className="w-5 h-5" />}
              label="Simulations"
              value={(twin.twin?.simulationCount ?? 0).toString()}
              unit="completed"
              sparklineData={[0, 1, 1, 2, 3, 3, 4, 5]}
              sparklineColor="#a78bfa"
            />
            <HealthMetricCard
              icon={<RefreshCw className="w-5 h-5" />}
              label="Data Sources"
              value={(twin.twin?.dataSourceCount ?? 0).toString()}
              unit="connected"
              sparklineData={[3, 4, 4, 5, 5, 6, 7, 7]}
              sparklineColor="#10b981"
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
          {activeTab === 'my-twin' && <MyTwinTab twin={twin} />}
          {activeTab === 'simulations' && <SimulationsTab twin={twin} />}
          {activeTab === 'parameters' && <ParametersTab twin={twin} />}
          {activeTab === 'predictions' && <PredictionsTab twin={twin} />}
          {activeTab === 'timeline' && <TimelineTab twin={twin} />}

        </div>
      </main>

      <Footer />
    </>
  );
}

// ============================================================
// My Twin Tab
// ============================================================

function MyTwinTab({ twin }: { twin: ReturnType<typeof useDigitalTwin> }) {
  if (!twin.twin) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400 text-sm">
        Loading digital twin...
      </div>
    );
  }

  const twinData = twin.twin;

  return (
    <div className="space-y-6">
      {/* Overall Health Score + TEE badge */}
      <MedicalCard>
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <ProgressRing
            value={twinData.overallHealthScore}
            size={120}
            strokeWidth={8}
            color={BRAND.sky}
          >
            <div className="text-center">
              <span className="text-2xl font-bold text-slate-900">{twinData.overallHealthScore}</span>
              <p className="text-xs text-slate-400">Score</p>
            </div>
          </ProgressRing>

          <div className="flex-1 text-center sm:text-left">
            <h3 className="text-lg font-semibold text-slate-900 mb-1">Overall Health Score</h3>
            <p className="text-sm text-slate-500 mb-3">
              Composite score based on {twinData.organScores.length} organ systems,{' '}
              {twinData.dataSourceCount} data sources, and {twinData.simulationCount} simulations.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <TEEBadge platform="Intel SGX" verified />
              <TruncatedHash hash={twinData.attestation} />
            </div>
          </div>

          <div className="text-center sm:text-right">
            <p className="text-xs text-slate-400 mb-1">Model Version</p>
            <Badge variant="brand">{twinData.modelVersion}</Badge>
            <p className="text-xs text-slate-400 mt-3">Last Updated</p>
            <p className="text-sm text-slate-600">{timeAgo(twinData.lastUpdated)}</p>
          </div>
        </div>
      </MedicalCard>

      {/* Organ system grid — 2 columns x 5 rows */}
      <SectionHeader
        title="Organ System Health"
        subtitle="Health scores for each major organ system"
        size="sm"
        icon={Heart}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {twinData.organScores.map((organ) => (
          <OrganScoreCard
            key={organ.system}
            system={organ.system}
            score={organ.score}
            trend={organ.trend}
            lastUpdated={organ.lastUpdated}
          />
        ))}
      </div>

      {/* Data sources card */}
      <MedicalCard>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
            <RefreshCw className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Data Sources</h3>
            <p className="text-xs text-slate-500">Connected health data feeds</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="text-center p-4 bg-slate-50 rounded-xl">
            <p className="text-2xl font-bold text-slate-900">{twinData.dataSourceCount}</p>
            <p className="text-xs text-slate-500">Connected Wearables</p>
          </div>
          <div className="text-center p-4 bg-slate-50 rounded-xl">
            <p className="text-2xl font-bold text-brand-600">{formatNumber(12480)}</p>
            <p className="text-xs text-slate-500">Records Synced</p>
          </div>
          <div className="text-center p-4 bg-slate-50 rounded-xl">
            <p className="text-2xl font-bold text-emerald-600">{timeAgo(twinData.lastUpdated)}</p>
            <p className="text-xs text-slate-500">Last Sync</p>
          </div>
        </div>
      </MedicalCard>
    </div>
  );
}

// ============================================================
// Simulations Tab
// ============================================================

function SimulationsTab({ twin }: { twin: ReturnType<typeof useDigitalTwin> }) {
  const { simulations, selectedSimulation, setSelectedSimulation } = twin;

  const activeSim = useMemo(
    () => simulations.find((s) => s.id === selectedSimulation),
    [simulations, selectedSimulation],
  );

  return (
    <div>
      <SectionHeader
        title="What-If Simulations"
        subtitle="Explore how lifestyle and treatment changes affect your health trajectory"
        size="sm"
        icon={Play}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Simulation list */}
        <div className="lg:col-span-1 space-y-4">
          {simulations.length > 0 ? (
            simulations.map((sim) => (
              <SimulationCard
                key={sim.id}
                simulation={sim}
                isSelected={selectedSimulation === sim.id}
                onClick={() => setSelectedSimulation(selectedSimulation === sim.id ? null : sim.id)}
              />
            ))
          ) : (
            <div className="flex items-center justify-center py-16 text-slate-400 text-sm">
              Loading simulations...
            </div>
          )}
        </div>

        {/* Simulation detail */}
        <div className="lg:col-span-2">
          {activeSim ? (
            <SimulationDetailChart simulation={activeSim} />
          ) : (
            <MedicalCard>
              <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <Play className="w-12 h-12 mb-3 text-slate-300" />
                <p className="text-sm font-medium">Select a simulation to view details</p>
                <p className="text-xs mt-1">Click on a simulation card to see trajectory analysis</p>
              </div>
            </MedicalCard>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Parameters Tab
// ============================================================

function ParametersTab({ twin }: { twin: ReturnType<typeof useDigitalTwin> }) {
  const { parameters, parameterOverrides, setParameterOverride, resetOverrides, runSimulation } = twin;

  // Group parameters by category
  const grouped = useMemo(() => {
    const groups: Record<string, typeof parameters> = {};
    parameters.forEach((p) => {
      if (!groups[p.category]) groups[p.category] = [];
      groups[p.category].push(p);
    });
    return groups;
  }, [parameters]);

  const categoryOrder = ['Physical', 'Activity', 'Sleep', 'Diet', 'Stress'];
  const hasOverrides = Object.keys(parameterOverrides).length > 0;

  const handleRunSimulation = () => {
    /* istanbul ignore next -- defensive guard: button is disabled when no overrides */
    if (!hasOverrides) return;
    const modifiedParams = Object.entries(parameterOverrides).map(([id, value]) => ({ id, value }));
    runSimulation.mutate({
      scenario: 'Custom Parameter Change',
      description: `Modified ${modifiedParams.length} parameter(s) from the twin parameter panel.`,
      parameters: modifiedParams,
    });
  };

  return (
    <div>
      <SectionHeader
        title="Twin Parameters"
        subtitle="Adjust health parameters to run what-if simulations"
        size="sm"
        icon={Sliders}
        action={
          <div className="flex items-center gap-2">
            {hasOverrides && (
              <button
                onClick={resetOverrides}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Reset
              </button>
            )}
            <button
              onClick={handleRunSimulation}
              disabled={!hasOverrides || runSimulation.isLoading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-700 transition-colors shadow-sm disabled:opacity-50"
            >
              <Play className="w-4 h-4" />
              {runSimulation.isLoading ? 'Simulating...' : 'Run Simulation'}
            </button>
          </div>
        }
      />

      {parameters.length > 0 ? (
        <div className="space-y-8">
          {categoryOrder.map((category) => {
            const params = grouped[category];
            if (!params) return null;

            return (
              <div key={category}>
                <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-4">
                  {category}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {params.map((param) => (
                    <ParameterSlider
                      key={param.id}
                      parameter={param}
                      overrideValue={parameterOverrides[param.id]}
                      onChange={(value) => setParameterOverride(param.id, value)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex items-center justify-center py-20 text-slate-400 text-sm">
          Loading parameters...
        </div>
      )}
    </div>
  );
}

// ============================================================
// Predictions Tab
// ============================================================

function PredictionsTab({ twin }: { twin: ReturnType<typeof useDigitalTwin> }) {
  const { predictions } = twin;

  return (
    <div>
      <SectionHeader
        title="Biomarker Predictions"
        subtitle="90-day forecasts with confidence intervals for key health biomarkers"
        size="sm"
        icon={TrendingUp}
      />

      {predictions.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {predictions.map((pred) => (
            <PredictionCard key={pred.id} prediction={pred} />
          ))}
        </div>
      ) : (
        <div className="flex items-center justify-center py-20 text-slate-400 text-sm">
          Loading predictions...
        </div>
      )}
    </div>
  );
}

// ============================================================
// Timeline Tab
// ============================================================

function TimelineTab({ twin }: { twin: ReturnType<typeof useDigitalTwin> }) {
  const { timeline } = twin;

  return (
    <div>
      <SectionHeader
        title="Activity Timeline"
        subtitle="Chronological log of twin events, simulations, and data syncs"
        size="sm"
        icon={Clock}
      />

      {timeline.length > 0 ? (
        <MedicalCard padding={false}>
          <div className="divide-y divide-slate-100 px-5">
            {timeline.map((event) => (
              <TimelineEventItem key={event.id} event={event} />
            ))}
          </div>
        </MedicalCard>
      ) : (
        <div className="flex items-center justify-center py-20 text-slate-400 text-sm">
          Loading timeline...
        </div>
      )}
    </div>
  );
}
