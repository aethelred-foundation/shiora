/**
 * Shiora on Aethelred — Multi-Party Computation Lab Page
 *
 * Run privacy-preserving computations across multiple data holders,
 * browse MPC sessions, view aggregated results, and explore available
 * datasets — all while maintaining end-to-end data confidentiality
 * on the Aethelred network.
 */

'use client';

import { useState, useMemo } from 'react';
import {
  Network, Users, ShieldCheck, Lock, Activity,
  Database, Plus, CheckCircle, BarChart3,
  Layers, Cpu, Info, Sliders,
} from 'lucide-react';
import {
  BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';

import { useApp } from '@/contexts/AppContext';
import { TopNav, Footer, ToastContainer, SearchOverlay, Badge, Tabs, ProgressRing } from '@/components/ui/SharedComponents';
import { MedicalCard, HealthMetricCard, SectionHeader, ChartTooltip, StatusBadge, TEEBadge, TruncatedHash } from '@/components/ui/PagePrimitives';
import { BRAND, CHART_COLORS, MPC_PROTOCOL_TYPES } from '@/lib/constants';
import { seededRandom, seededInt, seededHex, formatNumber, formatPercent, timeAgo, generateAttestation } from '@/lib/utils';

import { useMPC } from '@/hooks/useMPC';
import {
  SessionCard,
  ConvergenceChart,
  ResultCard,
  DatasetCard,
  ProtocolSelector,
  PrivacyBudgetBar,
} from '@/components/mpc/MPCComponents';
import type { MPCProtocolType } from '@/types';

// ============================================================
// Constants
// ============================================================

const SEED = 2300;

// ============================================================
// Main Page
// ============================================================

export default function MPCLabPage() {
  const { addNotification } = useApp();
  const {
    sessions,
    results,
    datasets,
    selectedSession,
    isLoadingSessions,
    isLoadingResults,
    isLoadingDatasets,
    isLoadingDetail,
    error,
    selectSession,
  } = useMPC();

  const [activeTab, setActiveTab] = useState('sessions');

  // ---- Form state (Create tab, display-only) ----
  const [formProtocol, setFormProtocol] = useState<MPCProtocolType>('federated_averaging');
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formMinPart, setFormMinPart] = useState(3);
  const [formMaxPart, setFormMaxPart] = useState(10);
  const [formBudget, setFormBudget] = useState(5.0);
  const [formDataTypes, setFormDataTypes] = useState<Record<string, boolean>>({
    lab_result: true,
    vitals: false,
    imaging: false,
    prescription: false,
    notes: false,
  });

  const tabs = [
    { id: 'sessions', label: 'Sessions', count: sessions.length },
    { id: 'create', label: 'Create' },
    { id: 'results', label: 'Results', count: results.length },
    { id: 'datasets', label: 'Datasets', count: datasets.length },
  ];

  // ---- Stats derived from sessions ----
  const activeSessions = useMemo(() =>
    sessions.filter((s) => ['computing', 'converging', 'enrolling'].includes(s.status)).length,
    [sessions],
  );

  const totalParticipants = useMemo(() =>
    sessions.reduce((sum, s) => sum + s.participants.length, 0),
    [sessions],
  );

  const avgBudget = useMemo(() => {
    if (sessions.length === 0) return 0;
    const total = sessions.reduce((sum, s) => sum + s.privacyBudgetTotal, 0);
    return total / sessions.length;
  }, [sessions]);

  const completedStudies = useMemo(() =>
    sessions.filter((s) => s.status === 'completed').length,
    [sessions],
  );

  // Sparkline data for stat cards
  const activeSparkline = useMemo(() =>
    Array.from({ length: 12 }, (_, i) => seededInt(SEED + i * 3, 1, 6)),
    [],
  );

  const participantSparkline = useMemo(() =>
    Array.from({ length: 12 }, (_, i) => seededInt(SEED + 50 + i * 5, 20, 80)),
    [],
  );

  // ---- Selected protocol info for Create tab ----
  const selectedProtocolInfo = MPC_PROTOCOL_TYPES.find((p) => p.id === formProtocol);

  return (
    <>
      <TopNav />
      <SearchOverlay />
      <ToastContainer />

      <main id="main-content" className="flex-1">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">

          {/* ---- Header ---- */}
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Network className="w-6 h-6 text-brand-500" />
                <h1 className="text-2xl font-bold text-slate-900">MPC Computation Lab</h1>
              </div>
              <p className="text-sm text-slate-500">
                Run privacy-preserving multi-party computations across distributed datasets on the Aethelred network
              </p>
            </div>
            <div className="flex items-center gap-2">
              <TEEBadge platform="Intel SGX" verified />
              <Badge variant="success" dot>Network Live</Badge>
            </div>
          </div>

          {/* ---- Tabs ---- */}
          <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} className="mb-6" />

          {/* ================================================================ */}
          {/* Sessions Tab                                                      */}
          {/* ================================================================ */}
          {activeTab === 'sessions' && (
            <div className="space-y-6">
              {/* Stat Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <HealthMetricCard
                  icon={<Activity className="w-5 h-5" />}
                  label="Active Sessions"
                  value={String(activeSessions)}
                  trend={8.3}
                  trendLabel="vs last week"
                  sparklineData={activeSparkline}
                  sparklineColor={BRAND.sky}
                />
                <HealthMetricCard
                  icon={<Users className="w-5 h-5" />}
                  label="Total Participants"
                  value={formatNumber(totalParticipants)}
                  trend={12.1}
                  trendLabel="vs last week"
                  sparklineData={participantSparkline}
                  sparklineColor="#10b981"
                />
                <HealthMetricCard
                  icon={<Lock className="w-5 h-5" />}
                  label="Avg Privacy Budget"
                  value={avgBudget.toFixed(1)}
                  unit={'\u03B5'}
                  trend={-2.4}
                  trendLabel="vs last month"
                />
                <HealthMetricCard
                  icon={<CheckCircle className="w-5 h-5" />}
                  label="Completed Studies"
                  value={String(completedStudies)}
                  trend={25.0}
                  trendLabel="vs last month"
                />
              </div>

              {/* Session List */}
              <SectionHeader
                title="MPC Sessions"
                subtitle={`${sessions.length} sessions across the network`}
                size="sm"
                icon={Network}
              />
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sessions.map((session) => (
                  <SessionCard
                    key={session.id}
                    session={session}
                    onClick={() => selectSession(session.id)}
                  />
                ))}
              </div>

              {sessions.length === 0 && !isLoadingSessions && (
                <div className="text-center py-12 text-slate-400">
                  <Network className="w-12 h-12 mx-auto mb-3 opacity-40" />
                  <p>No MPC sessions found</p>
                </div>
              )}

              {/* Convergence detail for selected session */}
              {selectedSession && (
                <MedicalCard>
                  <SectionHeader
                    title={`Convergence — ${selectedSession.name}`}
                    subtitle={`${selectedSession.currentRound}/${selectedSession.totalRounds} rounds`}
                    size="sm"
                    icon={Activity}
                  />
                  <ConvergenceChart data={selectedSession.convergence} height={260} />
                  <div className="mt-4">
                    <PrivacyBudgetBar
                      used={selectedSession.privacyBudgetTotal - selectedSession.privacyBudgetRemaining}
                      total={selectedSession.privacyBudgetTotal}
                      label="Privacy Budget (epsilon)"
                    />
                  </div>
                </MedicalCard>
              )}
            </div>
          )}

          {/* ================================================================ */}
          {/* Create Tab                                                        */}
          {/* ================================================================ */}
          {activeTab === 'create' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Form */}
              <div className="lg:col-span-2 space-y-6">
                <MedicalCard>
                  <SectionHeader title="Create MPC Session" size="sm" icon={Plus} />

                  {/* Protocol selector */}
                  <div className="mb-5">
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Protocol
                    </label>
                    <ProtocolSelector
                      selected={formProtocol}
                      onChange={setFormProtocol}
                    />
                  </div>

                  {/* Session name */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Session Name
                    </label>
                    <input
                      type="text"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="e.g. Federated Biomarker Discovery"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                    />
                  </div>

                  {/* Description */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Description
                    </label>
                    <textarea
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                      placeholder="Describe the purpose and scope of this MPC session..."
                      rows={3}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent resize-none"
                    />
                  </div>

                  {/* Participants */}
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Min Participants
                      </label>
                      <input
                        type="number"
                        min={2}
                        max={100}
                        value={formMinPart}
                        onChange={(e) => setFormMinPart(Number(e.target.value))}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Max Participants
                      </label>
                      <input
                        type="number"
                        min={2}
                        max={1000}
                        value={formMaxPart}
                        onChange={(e) => setFormMaxPart(Number(e.target.value))}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  {/* Privacy budget slider */}
                  <div className="mb-5">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-sm font-medium text-slate-700">Privacy Budget (epsilon)</label>
                      <span className="text-sm font-semibold text-brand-600">{formBudget.toFixed(1)} &epsilon;</span>
                    </div>
                    <input
                      type="range"
                      min={0.1}
                      max={10}
                      step={0.1}
                      value={formBudget}
                      onChange={(e) => setFormBudget(Number(e.target.value))}
                      className="w-full h-2 bg-slate-200 rounded-full appearance-none cursor-pointer accent-brand-500"
                    />
                    <div className="flex justify-between text-xs text-slate-400 mt-1">
                      <span>0.1 (Max Privacy)</span>
                      <span>10.0 (Max Utility)</span>
                    </div>
                  </div>

                  {/* Data types checkboxes */}
                  <div className="mb-5">
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Required Data Types
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {Object.entries(formDataTypes).map(([key, checked]) => (
                        <label
                          key={key}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm cursor-pointer transition-colors ${
                            checked
                              ? 'border-brand-300 bg-brand-50 text-brand-700'
                              : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              setFormDataTypes((prev) => ({ ...prev, [key]: !prev[key] }))
                            }
                            className="rounded border-slate-300 text-brand-500 focus:ring-brand-500"
                          />
                          {key.replace('_', ' ')}
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Submit button (display only) */}
                  <button
                    type="button"
                    onClick={() =>
                      addNotification('info', 'Demo Mode', 'Session creation is available in demo mode only.')
                    }
                    className="w-full px-4 py-2.5 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
                  >
                    Create MPC Session
                  </button>
                </MedicalCard>
              </div>

              {/* Protocol info panel */}
              <div className="space-y-4">
                <MedicalCard>
                  <div className="flex items-center gap-2 mb-3">
                    <Info className="w-4 h-4 text-brand-500" />
                    <h3 className="text-sm font-semibold text-slate-900">Protocol Details</h3>
                  </div>
                  {selectedProtocolInfo && (
                    <div className="space-y-3">
                      <div>
                        <span className="text-xs text-slate-500">Selected Protocol</span>
                        <p className="text-sm font-semibold text-slate-900">{selectedProtocolInfo.label}</p>
                      </div>
                      <div>
                        <span className="text-xs text-slate-500">Description</span>
                        <p className="text-xs text-slate-600 mt-0.5">{selectedProtocolInfo.description}</p>
                      </div>
                      <div className="border-t border-slate-100 pt-3">
                        <span className="text-xs text-slate-500">Privacy Guarantees</span>
                        <ul className="mt-1 space-y-1 text-xs text-slate-600">
                          <li className="flex items-center gap-1.5">
                            <ShieldCheck className="w-3 h-3 text-emerald-500" />
                            Differential privacy noise injection
                          </li>
                          <li className="flex items-center gap-1.5">
                            <ShieldCheck className="w-3 h-3 text-emerald-500" />
                            TEE-verified computation
                          </li>
                          <li className="flex items-center gap-1.5">
                            <ShieldCheck className="w-3 h-3 text-emerald-500" />
                            On-chain attestation chain
                          </li>
                          <li className="flex items-center gap-1.5">
                            <ShieldCheck className="w-3 h-3 text-emerald-500" />
                            Zero raw data exposure
                          </li>
                        </ul>
                      </div>
                    </div>
                  )}
                </MedicalCard>

                <MedicalCard>
                  <div className="flex items-center gap-2 mb-3">
                    <Sliders className="w-4 h-4 text-brand-500" />
                    <h3 className="text-sm font-semibold text-slate-900">Budget Guide</h3>
                  </div>
                  <div className="space-y-2 text-xs text-slate-600">
                    <div className="flex items-center justify-between py-1">
                      <span>&epsilon; &lt; 1.0</span>
                      <Badge variant="success">Strong Privacy</Badge>
                    </div>
                    <div className="flex items-center justify-between py-1">
                      <span>1.0 &le; &epsilon; &le; 5.0</span>
                      <Badge variant="warning">Balanced</Badge>
                    </div>
                    <div className="flex items-center justify-between py-1">
                      <span>&epsilon; &gt; 5.0</span>
                      <Badge variant="danger">High Utility</Badge>
                    </div>
                  </div>
                </MedicalCard>
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* Results Tab                                                       */}
          {/* ================================================================ */}
          {activeTab === 'results' && (
            <div className="space-y-6">
              <SectionHeader
                title="Computation Results"
                subtitle={`${results.length} completed MPC results`}
                size="sm"
                icon={BarChart3}
              />

              <div className="space-y-4">
                {results.map((result) => (
                  <ResultCard key={result.id} result={result} />
                ))}
              </div>

              {results.length === 0 && !isLoadingResults && (
                <div className="text-center py-12 text-slate-400">
                  <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-40" />
                  <p>No computation results yet</p>
                </div>
              )}

              {/* Convergence overview chart (last result) */}
              {selectedSession?.convergence && selectedSession.convergence.length > 0 && (
                <MedicalCard>
                  <SectionHeader
                    title="Convergence Trend"
                    subtitle="Loss and accuracy over computation rounds"
                    size="sm"
                    icon={Activity}
                  />
                  <ConvergenceChart data={selectedSession.convergence} height={260} />
                </MedicalCard>
              )}
            </div>
          )}

          {/* ================================================================ */}
          {/* Datasets Tab                                                      */}
          {/* ================================================================ */}
          {activeTab === 'datasets' && (
            <div className="space-y-6">
              <SectionHeader
                title="Available Datasets"
                subtitle={`${datasets.length} datasets available for MPC computation`}
                size="sm"
                icon={Database}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {datasets.map((dataset) => (
                  <DatasetCard key={dataset.id} dataset={dataset} />
                ))}
              </div>

              {datasets.length === 0 && !isLoadingDatasets && (
                <div className="text-center py-12 text-slate-400">
                  <Database className="w-12 h-12 mx-auto mb-3 opacity-40" />
                  <p>No datasets available</p>
                </div>
              )}
            </div>
          )}

        </div>
      </main>

      <Footer />
    </>
  );
}
