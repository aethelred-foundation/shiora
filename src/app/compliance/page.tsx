/**
 * Shiora on Aethelred — Compliance & Audit Center Page
 *
 * Five-tab layout: Overview, Frameworks, Audit Log, Reports, Violations.
 * Displays compliance scores, framework controls, audit trail,
 * generated reports, and policy violation tracking with TEE verification.
 */

'use client';

import { useState, useMemo } from 'react';
import {
  ShieldCheck, Shield, AlertTriangle, FileText,
  Calendar, Clock, Eye, Filter, TrendingUp,
  ChevronDown, ChevronRight, XCircle,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts';

import { useApp } from '@/contexts/AppContext';
import { TopNav, Footer, ToastContainer, SearchOverlay, Badge, Tabs } from '@/components/ui/SharedComponents';
import { MedicalCard, HealthMetricCard, SectionHeader, ChartTooltip, TEEBadge } from '@/components/ui/PagePrimitives';
import { BRAND, COMPLIANCE_FRAMEWORKS } from '@/lib/constants';
import { seededInt, formatDate } from '@/lib/utils';

import { useCompliance } from '@/hooks/useCompliance';
import {
  ComplianceScoreCard,
  ComplianceGauge,
  FrameworkChecklist,
  AuditLogRow,
  ReportCard,
  ViolationCard,
} from '@/components/compliance/ComplianceComponents';

import type { ComplianceFrameworkId } from '@/types';

// ============================================================
// Constants
// ============================================================

const SEED = 2400;

// ============================================================
// Main Page
// ============================================================

export default function CompliancePage() {
  useApp();

  const {
    overview,
    frameworks,
    auditLog,
    auditMeta,
    reports,
    violations,
    frameworkChecks,
    isLoading,
    isAuditLoading,
    isChecksLoading,
    error,
    auditPage,
    setAuditPage,
    selectedFramework,
    setSelectedFramework,
    generateReport,
  } = useCompliance();

  const [activeTab, setActiveTab] = useState('overview');
  const [riskFilter, setRiskFilter] = useState<'all' | 'low' | 'medium' | 'high'>('all');
  const [expandedFramework, setExpandedFramework] = useState<ComplianceFrameworkId | null>('hipaa');

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'frameworks', label: 'Frameworks', count: frameworks.length },
    { id: 'audit', label: 'Audit Log', count: auditMeta?.total },
    { id: 'reports', label: 'Reports', count: reports.length },
    { id: 'violations', label: 'Violations', count: violations.filter((v) => v.status === 'open' || v.status === 'in_progress').length },
  ];

  // Filter audit log by risk level
  const filteredAuditLog = useMemo(() => {
    if (riskFilter === 'all') return auditLog;
    return auditLog.filter((e) => e.riskLevel === riskFilter);
  }, [auditLog, riskFilter]);

  // Violation summary counts
  const violationSummary = useMemo(() => {
    return {
      open: violations.filter((v) => v.status === 'open').length,
      inProgress: violations.filter((v) => v.status === 'in_progress').length,
      resolved: violations.filter((v) => v.status === 'resolved').length,
      acceptedRisk: violations.filter((v) => v.status === 'accepted_risk').length,
    };
  }, [violations]);

  // Compliance trend data for the line chart
  const trendData = useMemo(() => overview?.complianceTrend ?? [], [overview]);

  // Sparkline data for active violations metric card
  const violationSparkline = useMemo(
    () => Array.from({ length: 8 }, (_, i) => seededInt(SEED + 600 + i, 2, 10)),
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
                <ShieldCheck className="w-6 h-6 text-brand-500" />
                <h1 className="text-2xl font-bold text-slate-900">Compliance & Audit Center</h1>
              </div>
              <p className="text-sm text-slate-500">
                Monitor regulatory compliance across HIPAA, GDPR, SOC 2, HITRUST, and FDA 21 CFR Part 11 with TEE-verified audit trails
              </p>
            </div>
            <div className="flex items-center gap-2">
              <TEEBadge platform="Intel SGX" verified />
              <Badge variant="success" dot>All Systems Compliant</Badge>
            </div>
          </div>

          {/* ---- Tabs ---- */}
          <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} className="mb-6" />

          {/* ================================================================ */}
          {/* Overview Tab                                                      */}
          {/* ================================================================ */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Overall Score + Framework Scores Row */}
              <div className="grid grid-cols-1 lg:grid-cols-6 gap-4">
                {/* Large Overall Compliance Score */}
                <MedicalCard className="lg:col-span-1 flex flex-col items-center justify-center">
                  <p className="text-xs font-medium text-slate-500 mb-3 uppercase tracking-wider">Overall Score</p>
                  <ComplianceGauge score={overview?.overallComplianceScore ?? 0} size={140} />
                </MedicalCard>

                {/* 5 Framework Score Cards */}
                <div className="lg:col-span-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                  {(overview?.frameworks ?? []).map((fw) => (
                    <ComplianceScoreCard
                      key={fw.id}
                      framework={fw}
                      onClick={() => {
                        setSelectedFramework(fw.id);
                        setExpandedFramework(fw.id);
                        setActiveTab('frameworks');
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Compliance Trend Line Chart */}
              <MedicalCard>
                <SectionHeader
                  title="Compliance Trend"
                  subtitle="Overall compliance score over the past 12 months"
                  size="sm"
                  icon={TrendingUp}
                />
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis
                        dataKey="month"
                        tick={{ fontSize: 10, fill: '#94a3b8' }}
                        tickLine={false}
                        axisLine={{ stroke: '#e2e8f0' }}
                      />
                      <YAxis
                        domain={[70, 100]}
                        tick={{ fontSize: 10, fill: '#94a3b8' }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v: number) => `${v}%`}
                      />
                      <Tooltip
                        content={({ active, payload, label }) => (
                          <ChartTooltip
                            active={active}
                            payload={payload?.map((p) => ({
                              color: BRAND.sky,
                              name: 'Compliance Score',
                              value: `${p.value}%`,
                            }))}
                            label={label}
                          />
                        )}
                      />
                      <Line
                        type="monotone"
                        dataKey="score"
                        stroke={BRAND.sky}
                        strokeWidth={2.5}
                        dot={{ r: 3, fill: BRAND.sky, strokeWidth: 0 }}
                        activeDot={{ r: 5, fill: BRAND.sky, strokeWidth: 2, stroke: '#fff' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </MedicalCard>

              {/* Summary Stat Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <HealthMetricCard
                  icon={<AlertTriangle className="w-5 h-5" />}
                  label="Active Violations"
                  value={String(overview?.activeViolations ?? 0)}
                  trend={-2.4}
                  trendLabel="vs last month"
                  sparklineData={violationSparkline}
                  sparklineColor="#ef4444"
                />
                <HealthMetricCard
                  icon={<Clock className="w-5 h-5" />}
                  label="Days Since Last Audit"
                  value={String(overview?.daysSinceLastAudit ?? 0)}
                  unit="days"
                />
                <MedicalCard>
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center text-brand-600">
                      <Calendar className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-slate-500 mb-1">Upcoming Assessments</p>
                      <p className="text-2xl font-bold text-slate-900">{overview?.upcomingAssessments?.length ?? 0}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {(overview?.upcomingAssessments ?? []).map((a, i) => {
                      const fwMeta = COMPLIANCE_FRAMEWORKS.find((f) => f.id === a.frameworkId);
                      return (
                        <div key={i} className="flex items-center justify-between text-xs">
                          <span className="font-medium text-slate-700">{fwMeta?.name ?? a.frameworkId}</span>
                          <span className="text-slate-500">{formatDate(a.dueDate)}</span>
                        </div>
                      );
                    })}
                  </div>
                </MedicalCard>
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* Frameworks Tab                                                    */}
          {/* ================================================================ */}
          {activeTab === 'frameworks' && (
            <div className="space-y-4">
              {frameworks.map((fw) => {
                const isExpanded = expandedFramework === fw.id;
                const meta = COMPLIANCE_FRAMEWORKS.find((f) => f.id === fw.id);

                return (
                  <MedicalCard key={fw.id} padding={false}>
                    {/* Expandable Header */}
                    <button
                      onClick={() => {
                        if (isExpanded) {
                          setExpandedFramework(null);
                        } else {
                          setExpandedFramework(fw.id);
                          setSelectedFramework(fw.id);
                        }
                      }}
                      className="w-full flex items-center justify-between p-5 text-left hover:bg-slate-50/50 transition-colors rounded-2xl"
                    >
                      <div className="flex items-center gap-4">
                        <ComplianceGauge score={fw.overallScore} size={56} />
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-base font-semibold text-slate-900">{meta?.name ?? fw.name}</h3>
                            <Badge variant="neutral">{fw.version}</Badge>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5 max-w-xl">{fw.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="hidden sm:flex items-center gap-4 text-xs">
                          <span className="flex items-center gap-1 text-emerald-600 font-medium">
                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                            {fw.passedControls} passed
                          </span>
                          <span className="flex items-center gap-1 text-red-600 font-medium">
                            <span className="w-2 h-2 rounded-full bg-red-500" />
                            {fw.failedControls} failed
                          </span>
                          <span className="flex items-center gap-1 text-slate-400 font-medium">
                            <span className="w-2 h-2 rounded-full bg-slate-300" />
                            {fw.notAssessedControls} N/A
                          </span>
                        </div>
                        {isExpanded
                          ? <ChevronDown className="w-5 h-5 text-slate-400 shrink-0" />
                          : <ChevronRight className="w-5 h-5 text-slate-400 shrink-0" />
                        }
                      </div>
                    </button>

                    {/* Expanded Control Checklist */}
                    {isExpanded && (
                      <div className="px-5 pb-5 border-t border-slate-100">
                        <div className="pt-4">
                          <FrameworkChecklist
                            checks={frameworkChecks}
                            isLoading={isChecksLoading}
                          />
                        </div>
                      </div>
                    )}
                  </MedicalCard>
                );
              })}

              {frameworks.length === 0 && !isLoading && (
                <MedicalCard>
                  <div className="text-center py-12 text-slate-400">
                    <Shield className="w-12 h-12 mx-auto mb-3 opacity-40" />
                    <p>No frameworks loaded</p>
                  </div>
                </MedicalCard>
              )}
            </div>
          )}

          {/* ================================================================ */}
          {/* Audit Log Tab                                                     */}
          {/* ================================================================ */}
          {activeTab === 'audit' && (
            <MedicalCard padding={false}>
              <div className="px-5 pt-5 pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Eye className="w-4 h-4 text-brand-600" />
                    <h3 className="text-sm font-semibold text-slate-900">Audit Log</h3>
                  </div>
                  <p className="text-xs text-slate-500">
                    {auditMeta?.total ?? 0} events tracked &middot; Page {auditMeta?.page ?? 1}
                  </p>
                </div>

                {/* Risk Level Filter */}
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-slate-400" />
                  <span className="text-xs text-slate-500">Risk:</span>
                  {(['all', 'low', 'medium', 'high'] as const).map((level) => (
                    <button
                      key={level}
                      onClick={() => setRiskFilter(level)}
                      className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                        riskFilter === level
                          ? 'bg-brand-50 text-brand-700 border-brand-200 font-medium'
                          : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {level === 'all' ? 'All' : level.charAt(0).toUpperCase() + level.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Timestamp</th>
                      <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Action</th>
                      <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Actor</th>
                      <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Resource</th>
                      <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Type</th>
                      <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Risk</th>
                      <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">TEE Hash</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAuditLog.map((entry) => (
                      <AuditLogRow key={entry.id} entry={entry} />
                    ))}
                  </tbody>
                </table>
              </div>

              {filteredAuditLog.length === 0 && !isAuditLoading && (
                <div className="text-center py-12 text-slate-400">
                  <Eye className="w-12 h-12 mx-auto mb-3 opacity-40" />
                  <p>No audit entries match your filter</p>
                </div>
              )}

              {/* Pagination */}
              {auditMeta && auditMeta.totalPages > 1 && (
                <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100">
                  <p className="text-xs text-slate-500">
                    Page {auditMeta.page} of {auditMeta.totalPages} ({auditMeta.total} total)
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setAuditPage(Math.max(1, auditPage - 1))}
                      disabled={auditPage <= 1}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setAuditPage(Math.min(auditMeta.totalPages, auditPage + 1))}
                      disabled={auditPage >= auditMeta.totalPages}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </MedicalCard>
          )}

          {/* ================================================================ */}
          {/* Reports Tab                                                       */}
          {/* ================================================================ */}
          {activeTab === 'reports' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <SectionHeader
                  title="Compliance Reports"
                  subtitle={`${reports.length} reports generated`}
                  size="sm"
                  icon={FileText}
                />
                <button
                  onClick={() => generateReport.mutate({})}
                  disabled={generateReport.isLoading}
                  className="px-4 py-2 text-xs font-medium rounded-xl bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-50 transition-colors"
                >
                  {generateReport.isLoading ? 'Generating...' : 'Generate Report'}
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {reports.map((report) => (
                  <ReportCard key={report.id} report={report} />
                ))}
              </div>
              {reports.length === 0 && !isLoading && (
                <MedicalCard>
                  <div className="text-center py-12 text-slate-400">
                    <FileText className="w-12 h-12 mx-auto mb-3 opacity-40" />
                    <p>No reports generated yet</p>
                  </div>
                </MedicalCard>
              )}
            </div>
          )}

          {/* ================================================================ */}
          {/* Violations Tab                                                    */}
          {/* ================================================================ */}
          {activeTab === 'violations' && (
            <div className="space-y-6">
              {/* Summary Row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <MedicalCard>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2 h-2 rounded-full bg-red-500" />
                    <span className="text-xs text-slate-500">Open</span>
                  </div>
                  <span className="text-2xl font-bold text-red-600">{violationSummary.open}</span>
                </MedicalCard>
                <MedicalCard>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2 h-2 rounded-full bg-amber-500" />
                    <span className="text-xs text-slate-500">In Progress</span>
                  </div>
                  <span className="text-2xl font-bold text-amber-600">{violationSummary.inProgress}</span>
                </MedicalCard>
                <MedicalCard>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-xs text-slate-500">Resolved</span>
                  </div>
                  <span className="text-2xl font-bold text-emerald-600">{violationSummary.resolved}</span>
                </MedicalCard>
                <MedicalCard>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    <span className="text-xs text-slate-500">Accepted Risk</span>
                  </div>
                  <span className="text-2xl font-bold text-blue-600">{violationSummary.acceptedRisk}</span>
                </MedicalCard>
              </div>

              {/* Violations Table */}
              <MedicalCard padding={false}>
                <div className="px-5 pt-5 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className="w-4 h-4 text-brand-600" />
                    <h3 className="text-sm font-semibold text-slate-900">Policy Violations</h3>
                  </div>
                  <p className="text-xs text-slate-500">{violations.length} violations tracked</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Framework</th>
                        <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Control</th>
                        <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Severity</th>
                        <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Title</th>
                        <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Detected</th>
                        <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                        <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Assigned To</th>
                        <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Remediation</th>
                      </tr>
                    </thead>
                    <tbody>
                      {violations.map((violation) => (
                        <ViolationCard key={violation.id} violation={violation} />
                      ))}
                    </tbody>
                  </table>
                </div>
                {violations.length === 0 && !isLoading && (
                  <div className="text-center py-12 text-slate-400">
                    <ShieldCheck className="w-12 h-12 mx-auto mb-3 opacity-40" />
                    <p>No violations found</p>
                  </div>
                )}
              </MedicalCard>
            </div>
          )}

          {/* Error State */}
          {error && (
            <MedicalCard className="mt-6">
              <div className="flex items-center gap-3 text-red-600">
                <XCircle className="w-5 h-5" />
                <div>
                  <p className="font-medium">Error loading compliance data</p>
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
