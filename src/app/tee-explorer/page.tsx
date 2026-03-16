/**
 * Shiora on Aethelred — TEE Computation Explorer Page
 *
 * Inspect TEE enclaves, browse attestation chains, monitor compute
 * jobs, and visualize the end-to-end verification pipeline for
 * privacy-preserving AI inference on the Aethelred network.
 */

'use client';

import { useState, useMemo } from 'react';
import {
  Cpu, Shield, ShieldCheck, Activity, Server, Cloud,
  ChevronRight, ChevronDown, Clock, Zap,
  CheckCircle, XCircle, ArrowRight, Eye,
  Hash, Lock, Fingerprint, Network,
} from 'lucide-react';
import {
  PieChart, Pie, Cell, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';

import { useApp } from '@/contexts/AppContext';
import { TopNav, Footer, ToastContainer, SearchOverlay, Badge, Tabs } from '@/components/ui/SharedComponents';
import { MedicalCard, HealthMetricCard, SectionHeader, ChartTooltip, TEEBadge, StatusBadge, TruncatedHash } from '@/components/ui/PagePrimitives';
import { BRAND, CHART_COLORS, TEE_ENCLAVE_TYPES, COMPUTE_JOB_STATES } from '@/lib/constants';
import { seededRandom, seededInt, seededHex, seededPick, generateTxHash, formatNumber, timeAgo, formatDateTime, generateAttestation } from '@/lib/utils';

import { useTEEExplorer } from '@/hooks/useTEEExplorer';
import {
  AttestationRow,
  EnclaveCard,
  ComputeJobRow,
  VerificationPipeline,
  PlatformDistribution,
  RecentVerificationChains,
} from '@/components/tee/TEEExplorerComponents';

// ============================================================
// Constants
// ============================================================

const SEED = 2000;

const PIE_COLORS = ['#0071C5', '#FF9900', '#ED1C24'];

// ============================================================
// Main Page
// ============================================================

export default function TEEExplorerPage() {
  const { addNotification } = useApp();

  const {
    stats,
    attestations,
    jobs,
    enclaves,
    isLoadingStats,
    isLoadingAttestations,
    isLoadingJobs,
    isLoadingEnclaves,
    error,
  } = useTEEExplorer();

  const [activeTab, setActiveTab] = useState('overview');

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'attestations', label: 'Attestations', count: attestations.length },
    { id: 'jobs', label: 'Compute Jobs', count: jobs.length },
    { id: 'enclaves', label: 'Enclaves', count: enclaves.length },
    { id: 'verification', label: 'Verification Chain' },
  ];

  // Generate sparkline data for metric cards
  const enclaveSparkline = useMemo(() =>
    Array.from({ length: 12 }, (_, i) => seededInt(SEED + i * 3, 18, 26)),
    [],
  );

  const tpsSparkline = useMemo(() =>
    Array.from({ length: 12 }, (_, i) => parseFloat((seededRandom(SEED + 50 + i) * 40 + 80).toFixed(0))),
    [],
  );

  const attestationSparkline = useMemo(() =>
    Array.from({ length: 12 }, (_, i) => seededInt(SEED + 100 + i * 5, 1000, 2500)),
    [],
  );

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
                <Cpu className="w-6 h-6 text-brand-500" />
                <h1 className="text-2xl font-bold text-slate-900">TEE Computation Explorer</h1>
              </div>
              <p className="text-sm text-slate-500">
                Monitor trusted execution environments, browse attestation chains, and inspect compute jobs on the Aethelred network
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
          {/* Overview Tab                                                      */}
          {/* ================================================================ */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Stat Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <HealthMetricCard
                  icon={<Server className="w-5 h-5" />}
                  label="Total Enclaves"
                  value={stats ? String(stats.totalEnclaves) : '--'}
                  trend={4.2}
                  trendLabel="vs last week"
                  sparklineData={enclaveSparkline}
                  sparklineColor={BRAND.sky}
                />
                <HealthMetricCard
                  icon={<ShieldCheck className="w-5 h-5" />}
                  label="Attestation Success Rate"
                  value={stats ? `${stats.attestationSuccessRate}` : '--'}
                  unit="%"
                  trend={0.3}
                  trendLabel="vs last week"
                />
                <HealthMetricCard
                  icon={<Zap className="w-5 h-5" />}
                  label="Compute TPS"
                  value={stats ? String(stats.computeTPS) : '--'}
                  trend={12.5}
                  trendLabel="vs last week"
                  sparklineData={tpsSparkline}
                  sparklineColor="#10b981"
                />
                <HealthMetricCard
                  icon={<Activity className="w-5 h-5" />}
                  label="Daily Attestations"
                  value={stats ? formatNumber(stats.attestationsToday) : '--'}
                  trend={8.1}
                  trendLabel="vs yesterday"
                  sparklineData={attestationSparkline}
                  sparklineColor="#C9A227"
                />
              </div>

              {/* Charts Row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Platform Distribution Pie Chart */}
                <MedicalCard>
                  <SectionHeader title="Platform Distribution" size="sm" icon={Cpu} />
                  <div className="flex flex-col sm:flex-row items-center gap-6">
                    <div className="w-48 h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={stats?.platformDistribution ?? []}
                            dataKey="percentage"
                            nameKey="platform"
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            innerRadius={45}
                            paddingAngle={2}
                            stroke="none"
                          >
                            {(stats?.platformDistribution ?? []).map((_, i) => (
                              <Cell key={i} fill={PIE_COLORS[i]} />
                            ))}
                          </Pie>
                          <Tooltip
                            content={({ active, payload, label }) => (
                              <ChartTooltip
                                active={active}
                                payload={payload?.map((p) => ({
                                  color: p.payload?.fill ??
                                    /* istanbul ignore next */
                                    '#94a3b8',
                                  name: String(p.name ??
                                    /* istanbul ignore next */
                                    ''),
                                  value: `${p.value}%`,
                                }))}
                                label={label}
                              />
                            )}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <PlatformDistribution
                      data={stats?.platformDistribution ?? []}
                      colors={PIE_COLORS}
                    />
                  </div>
                </MedicalCard>

                {/* Daily Attestation Volume Bar Chart */}
                <MedicalCard>
                  <SectionHeader title="Daily Attestation Volume" subtitle="Last 14 days" size="sm" icon={ShieldCheck} />
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats?.dailyAttestationVolume ?? []}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis
                          dataKey="day"
                          tick={{ fontSize: 10, fill: '#94a3b8' }}
                          tickLine={false}
                          axisLine={{ stroke: '#e2e8f0' }}
                          interval="preserveStartEnd"
                        />
                        <YAxis
                          tick={{ fontSize: 10, fill: '#94a3b8' }}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(v: number) => formatNumber(v)}
                        />
                        <Tooltip
                          content={({ active, payload, label }) => (
                            <ChartTooltip
                              active={active}
                              payload={payload?.map((p) => ({
                                color: BRAND.sky,
                                name: 'Attestations',
                                value: Number(p.value ??
                                  /* istanbul ignore next */
                                  0),
                              }))}
                              label={label}
                            />
                          )}
                        />
                        <Bar
                          dataKey="count"
                          fill={BRAND.sky}
                          radius={[4, 4, 0, 0]}
                          maxBarSize={32}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </MedicalCard>
              </div>

              {/* TEE Health Status Banner */}
              <MedicalCard className="border-emerald-200 bg-emerald-50/50">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-6 h-6 text-emerald-600" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-emerald-900">TEE Network Health: Operational</h3>
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                      </span>
                    </div>
                    <p className="text-xs text-emerald-700 mt-0.5">
                      All {stats?.activeEnclaves ?? '--'} active enclaves are operating within normal parameters.
                      Attestation success rate is {stats?.attestationSuccessRate ?? '--'}% with an average execution time
                      of {stats?.averageExecutionMs ?? '--'}ms.
                    </p>
                  </div>
                </div>
              </MedicalCard>
            </div>
          )}

          {/* ================================================================ */}
          {/* Attestations Tab                                                  */}
          {/* ================================================================ */}
          {activeTab === 'attestations' && (
            <MedicalCard padding={false}>
              <div className="px-5 pt-5 pb-3">
                <SectionHeader title="Attestation Records" subtitle={`${attestations.length} attestations on-chain`} size="sm" icon={ShieldCheck} />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Hash</th>
                      <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Platform</th>
                      <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Model</th>
                      <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Verified</th>
                      <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Block Height</th>
                      <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attestations.map((att, i) => (
                      <AttestationRow key={att.id} attestation={att} index={i} />
                    ))}
                  </tbody>
                </table>
              </div>
              {attestations.length === 0 && !isLoadingAttestations && (
                <div className="text-center py-12 text-slate-400">
                  <ShieldCheck className="w-12 h-12 mx-auto mb-3 opacity-40" />
                  <p>No attestations found</p>
                </div>
              )}
            </MedicalCard>
          )}

          {/* ================================================================ */}
          {/* Compute Jobs Tab                                                  */}
          {/* ================================================================ */}
          {activeTab === 'jobs' && (
            <MedicalCard padding={false}>
              <div className="px-5 pt-5 pb-3">
                <SectionHeader title="Compute Jobs" subtitle={`${jobs.length} jobs tracked`} size="sm" icon={Zap} />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Job ID</th>
                      <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Model Name</th>
                      <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Enclave ID</th>
                      <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                      <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Execution Time</th>
                      <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Gas Cost</th>
                      <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Priority</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobs.map((job, i) => (
                      <ComputeJobRow key={job.id} job={job} index={i} />
                    ))}
                  </tbody>
                </table>
              </div>
              {jobs.length === 0 && !isLoadingJobs && (
                <div className="text-center py-12 text-slate-400">
                  <Zap className="w-12 h-12 mx-auto mb-3 opacity-40" />
                  <p>No compute jobs found</p>
                </div>
              )}
            </MedicalCard>
          )}

          {/* ================================================================ */}
          {/* Enclaves Tab                                                      */}
          {/* ================================================================ */}
          {activeTab === 'enclaves' && (
            <div>
              <SectionHeader title="TEE Enclaves" subtitle={`${enclaves.length} enclaves registered`} size="sm" icon={Server} />
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {enclaves.map((enclave) => (
                  <EnclaveCard key={enclave.id} enclave={enclave} />
                ))}
              </div>
              {enclaves.length === 0 && !isLoadingEnclaves && (
                <MedicalCard>
                  <div className="text-center py-12 text-slate-400">
                    <Server className="w-12 h-12 mx-auto mb-3 opacity-40" />
                    <p>No enclaves found</p>
                  </div>
                </MedicalCard>
              )}
            </div>
          )}

          {/* ================================================================ */}
          {/* Verification Chain Tab                                             */}
          {/* ================================================================ */}
          {activeTab === 'verification' && (
            <div className="space-y-6">
              <MedicalCard>
                <SectionHeader
                  title="Verification Pipeline"
                  subtitle="End-to-end trusted execution flow from request submission to on-chain anchoring"
                  size="sm"
                  icon={Network}
                />
                <VerificationPipeline seed={SEED} />
              </MedicalCard>

              {/* Recent Verification Chains */}
              <MedicalCard>
                <SectionHeader
                  title="Recent Verification Chains"
                  subtitle="5 most recent end-to-end verification entries"
                  size="sm"
                  icon={Eye}
                />
                <RecentVerificationChains attestations={attestations} />
              </MedicalCard>

              <MedicalCard>
                <SectionHeader title="How TEE Verification Works" size="sm" icon={Shield} />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center text-brand-600 mb-3">
                      <Lock className="w-5 h-5" />
                    </div>
                    <h3 className="text-sm font-semibold text-slate-900 mb-1">Enclave Isolation</h3>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Computations run inside hardware-isolated enclaves. Even the host operating system
                      cannot access the data or code being processed.
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 mb-3">
                      <Fingerprint className="w-5 h-5" />
                    </div>
                    <h3 className="text-sm font-semibold text-slate-900 mb-1">Remote Attestation</h3>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      A cryptographic proof is generated that verifies the enclave is running the expected
                      code with the correct measurements and PCR values.
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 mb-3">
                      <Hash className="w-5 h-5" />
                    </div>
                    <h3 className="text-sm font-semibold text-slate-900 mb-1">On-chain Anchoring</h3>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Attestation hashes are anchored on the Aethelred blockchain, creating an immutable
                      audit trail that anyone can independently verify.
                    </p>
                  </div>
                </div>
              </MedicalCard>
            </div>
          )}

          {/* Error State */}
          {error && (
            <MedicalCard className="mt-6">
              <div className="flex items-center gap-3 text-red-600">
                <XCircle className="w-5 h-5" />
                <div>
                  <p className="font-medium">Error loading TEE data</p>
                  <p className="text-sm text-red-500">{error.message}</p>
                </div>
              </div>
            </MedicalCard>
          )}

        </div>
      </main>

      <Footer />
    </>
  );
}
