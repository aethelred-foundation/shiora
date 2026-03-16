/**
 * Shiora on Aethelred — Predictive Health Alerts Page
 *
 * Manage predictive health alerts, alert rules, and alert history.
 * AI-powered health monitoring with TEE-verified inference on the Aethelred blockchain.
 */

'use client';

import { useState, useMemo } from 'react';
import {
  Bell, AlertTriangle, AlertCircle, Info, CheckCircle,
  ShieldCheck, Brain, Plus, Filter, Clock,
  TrendingUp, Zap, Activity, Shield,
  ChevronDown, X,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';

import { useApp } from '@/contexts/AppContext';
import { TopNav, Footer, ToastContainer, SearchOverlay, Badge, Tabs } from '@/components/ui/SharedComponents';
import { MedicalCard, SectionHeader, StatusBadge, HealthMetricCard } from '@/components/ui/PagePrimitives';
import { AlertCard, AlertRuleCard, AlertTimeline, ThresholdSlider, ChannelSelector } from '@/components/alerts/AlertComponents';
/* istanbul ignore next -- no-op handler for edit modal stub */
const noop = () => {};
import { usePredictiveAlerts } from '@/hooks/usePredictiveAlerts';
import { BRAND, ALERT_METRICS, ALERT_CHANNELS } from '@/lib/constants';
import {
  seededRandom, seededInt, seededPick,
  formatNumber, formatDateTime, timeAgo, generateDayLabel,
} from '@/lib/utils';
import type { AlertRule, AlertSeverity, AlertChannel, AlertMetric } from '@/types';

// ============================================================
// Mock Chart Data
// ============================================================

const SEED = 1210;

function generateAlertFrequency() {
  return Array.from({ length: 14 }, (_, i) => ({
    day: generateDayLabel(13 - i),
    critical: seededInt(SEED + i * 3, 0, 3),
    warning: seededInt(SEED + i * 5, 0, 6),
    info: seededInt(SEED + i * 7, 0, 4),
  }));
}

// ============================================================
// Create Rule Modal
// ============================================================

function CreateRuleModal({
  onClose,
  onSubmit,
  isLoading,
}: {
  onClose: () => void;
  onSubmit: (rule: Omit<AlertRule, 'id' | 'createdAt'>) => void;
  isLoading: boolean;
}) {
  const [metric, setMetric] = useState<AlertMetric>('temperature');
  const [condition, setCondition] = useState<'above' | 'below' | 'deviation'>('above');
  const [threshold, setThreshold] = useState(100.4);
  const [severity, setSeverity] = useState<AlertSeverity>('warning');
  const [channels, setChannels] = useState<AlertChannel[]>(['in_app']);
  const [cooldown, setCooldown] = useState(30);

  const selectedMetric = ALERT_METRICS.find((m) => m.id === metric);

  const handleMetricChange = (id: string) => {
    const m = ALERT_METRICS.find((x) => x.id === id);
    if (m) {
      setMetric(m.id as AlertMetric);
      setThreshold(m.defaultThreshold);
      setCondition(m.condition as 'above' | 'below' | 'deviation');
    }
  };

  const handleSubmit = () => {
    onSubmit({
      metric,
      condition,
      threshold,
      unit: selectedMetric?.unit ?? /* istanbul ignore next */ '',
      severity,
      channels,
      enabled: true,
      cooldownMinutes: cooldown,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-slate-900">Create Alert Rule</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="space-y-5">
          {/* Metric Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Health Metric</label>
            <select
              value={metric}
              onChange={(e) => handleMetricChange(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {ALERT_METRICS.map((m) => (
                <option key={m.id} value={m.id}>{m.label} ({m.unit})</option>
              ))}
            </select>
          </div>

          {/* Condition */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Condition</label>
            <div className="flex gap-2">
              {(['above', 'below', 'deviation'] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => setCondition(c)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    condition === c
                      ? 'bg-brand-500 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {c.charAt(0).toUpperCase() + c.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Threshold */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Threshold: {threshold} {selectedMetric?.unit}
            </label>
            <ThresholdSlider
              min={selectedMetric ? selectedMetric.defaultThreshold * 0.5 : /* istanbul ignore next */ 0}
              max={selectedMetric ? selectedMetric.defaultThreshold * 1.5 : /* istanbul ignore next */ 200}
              threshold={threshold}
              unit={selectedMetric?.unit ??
                /* istanbul ignore next */
                ''}
              onChange={setThreshold}
              condition={condition}
            />
          </div>

          {/* Severity */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Severity</label>
            <div className="flex gap-2">
              {(['critical', 'warning', 'info'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSeverity(s)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
                    severity === s
                      ? s === 'critical' ? 'bg-red-500 text-white'
                        : s === 'warning' ? 'bg-amber-500 text-white'
                        : 'bg-brand-500 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Channels */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Notification Channels</label>
            <ChannelSelector selected={channels} onChange={setChannels} />
          </div>

          {/* Cooldown */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Cooldown (minutes)</label>
            <select
              value={cooldown}
              onChange={(e) => setCooldown(Number(e.target.value))}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {[15, 30, 60, 120, 240].map((m) => (
                <option key={m} value={m}>{m} minutes</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3 mt-6 pt-4 border-t border-slate-100">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isLoading || channels.length === 0}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-brand-500 rounded-xl hover:bg-brand-600 transition-colors disabled:opacity-50"
          >
            {isLoading ? 'Creating...' : 'Create Rule'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Main Page
// ============================================================

export default function AlertsPage() {
  const { wallet } = useApp();
  const {
    alerts,
    rules,
    history,
    isLoading,
    activeAlertCount,
    criticalCount,
    filters,
    setSeverityFilter,
    setStatusFilter,
    mutations,
  } = usePredictiveAlerts();

  const [activeTab, setActiveTab] = useState('active');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const alertFrequency = useMemo(() => generateAlertFrequency(), []);

  const tabs = [
    { id: 'active', label: 'Active Alerts', count: activeAlertCount },
    { id: 'rules', label: 'Rules', count: rules.length },
    { id: 'history', label: 'History', count: history.length },
  ];

  const handleCreateRule = (rule: Omit<AlertRule, 'id' | 'createdAt'>) => {
    mutations.createRule.mutateAsync(rule).then(() => {
      setShowCreateModal(false);
    });
  };

  const handleBulkAcknowledge = () => {
    const activeAlerts = alerts.filter((a) => !a.acknowledgedAt && !a.resolvedAt);
    activeAlerts.forEach((a) => mutations.acknowledgeAlert.mutate(a.id));
  };

  return (
    <>
      <TopNav />
      <SearchOverlay />
      <ToastContainer />

      <main id="main-content" className="flex-1">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">

          {/* ─── Hero Section ─── */}
          <div className="bg-gradient-to-br from-rose-500 via-rose-600 to-amber-600 rounded-2xl p-8 mb-8 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/3 translate-x-1/3" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/3 -translate-x-1/3" />
            <div className="relative z-10">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Bell className="w-6 h-6 text-white/80" />
                    <span className="text-sm font-medium text-white/70">Predictive Health Alerts</span>
                  </div>
                  <h1 className="text-3xl font-bold mb-2">Health Alert Center</h1>
                  <p className="text-rose-100 max-w-xl">
                    AI-powered health monitoring with TEE-verified predictions.
                    Get notified when your health metrics deviate from safe ranges.
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  {criticalCount > 0 && (
                    <div className="flex items-center gap-2 px-4 py-2 bg-white/15 rounded-xl border border-white/20">
                      <AlertTriangle className="w-5 h-5 text-white" />
                      <span className="text-sm font-bold">{criticalCount} Critical</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 px-4 py-2 bg-white/15 rounded-xl border border-white/20">
                    <Activity className="w-5 h-5 text-white" />
                    <span className="text-sm font-bold">{activeAlertCount} Active</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ─── Key Metrics ─── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
            <HealthMetricCard
              icon={<Bell className="w-5 h-5" />}
              label="Active Alerts"
              value={activeAlertCount.toString()}
              trend={activeAlertCount > 3 ? -2.1 : 1.5}
              trendLabel="vs last week"
              sparklineData={[5, 4, 6, 3, 5, 4, 3, activeAlertCount]}
              sparklineColor="#f43f5e"
            />
            <HealthMetricCard
              icon={<AlertTriangle className="w-5 h-5" />}
              label="Critical Alerts"
              value={criticalCount.toString()}
              trend={criticalCount > 2 ? -1 : 0}
              trendLabel="this period"
              sparklineData={[2, 1, 3, 2, 1, 2, 1, criticalCount]}
              sparklineColor="#ef4444"
            />
            <HealthMetricCard
              icon={<ShieldCheck className="w-5 h-5" />}
              label="Rules Active"
              value={rules.filter((r) => r.enabled).length.toString()}
              unit={`of ${rules.length}`}
              trend={0}
              trendLabel="configured"
              sparklineData={[6, 6, 7, 7, 8, 8, 8, rules.filter((r) => r.enabled).length]}
              sparklineColor="#10b981"
            />
            <HealthMetricCard
              icon={<Brain className="w-5 h-5" />}
              label="Model Accuracy"
              value="94.7"
              unit="%"
              trend={2.3}
              trendLabel="improving"
              sparklineData={[90, 91, 92, 92, 93, 94, 94, 95]}
              sparklineColor="#a78bfa"
            />
          </div>

          {/* ─── Alert Frequency Chart ─── */}
          <MedicalCard className="mb-8" padding={false}>
            <div className="p-5 pb-0">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Alert Frequency (14 Days)</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Distribution of alerts by severity over time</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                    <span className="text-2xs text-slate-500">Critical</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    <span className="text-2xs text-slate-500">Warning</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-brand-500" />
                    <span className="text-2xs text-slate-500">Info</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="px-2 pb-4 pt-2">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={alertFrequency} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="day" tick={{ fontSize: 9, fill: '#94a3b8' }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Bar dataKey="critical" stackId="alerts" fill="#ef4444" radius={[0, 0, 0, 0]} name="Critical" />
                  <Bar dataKey="warning" stackId="alerts" fill="#f59e0b" radius={[0, 0, 0, 0]} name="Warning" />
                  <Bar dataKey="info" stackId="alerts" fill="#8B1538" radius={[3, 3, 0, 0]} name="Info" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </MedicalCard>

          {/* ─── Tabs ─── */}
          <div className="mb-6">
            <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
          </div>

          {/* ─── Active Alerts Tab ─── */}
          {activeTab === 'active' && (
            <div>
              {/* Filters + Bulk Actions */}
              <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setSeverityFilter(undefined); setStatusFilter(undefined); }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      !filters.severity && !filters.status ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    All
                  </button>
                  {(['critical', 'warning', 'info'] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setSeverityFilter(filters.severity === s ? undefined : s)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${
                        filters.severity === s
                          ? s === 'critical' ? 'bg-red-500 text-white'
                            : s === 'warning' ? 'bg-amber-500 text-white'
                            : 'bg-brand-500 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
                {activeAlertCount > 0 && (
                  <button
                    onClick={handleBulkAcknowledge}
                    className="px-4 py-2 text-xs font-medium text-amber-700 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors border border-amber-200"
                  >
                    <CheckCircle className="w-3.5 h-3.5 inline mr-1" />
                    Bulk Acknowledge
                  </button>
                )}
              </div>

              {/* Alert Grid */}
              {isLoading ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="skeleton rounded-2xl border border-slate-200 h-48" />
                  ))}
                </div>
              ) : alerts.length === 0 ? (
                <MedicalCard>
                  <div className="text-center py-12">
                    <CheckCircle className="w-12 h-12 text-emerald-300 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">All Clear</h3>
                    <p className="text-sm text-slate-500">No alerts match your current filters.</p>
                  </div>
                </MedicalCard>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {alerts.map((alert) => (
                    <AlertCard
                      key={alert.id}
                      alert={alert}
                      onAcknowledge={mutations.acknowledgeAlert.mutate}
                      onResolve={mutations.resolveAlert.mutate}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ─── Rules Tab ─── */}
          {activeTab === 'rules' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <SectionHeader
                  title="Alert Rules"
                  subtitle="Configure thresholds and notification channels for health metrics"
                  size="sm"
                />
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-brand-500 rounded-xl hover:bg-brand-600 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Create Rule
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {rules.map((rule) => (
                  <AlertRuleCard
                    key={rule.id}
                    rule={rule}
                    onToggle={mutations.toggleRule.mutate}
                    onEdit={noop}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ─── History Tab ─── */}
          {activeTab === 'history' && (
            <div>
              <SectionHeader
                title="Alert History"
                subtitle="Timeline of all alert events and actions"
                size="sm"
              />

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <MedicalCard>
                    {history.length === 0 ? (
                      <div className="text-center py-12">
                        <Clock className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                        <p className="text-sm text-slate-500">No history entries yet.</p>
                      </div>
                    ) : (
                      <AlertTimeline history={history} />
                    )}
                  </MedicalCard>
                </div>

                {/* Summary sidebar */}
                <div className="space-y-4">
                  <MedicalCard>
                    <h4 className="text-sm font-semibold text-slate-900 mb-3">History Summary</h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500">Total Events</span>
                        <span className="font-bold text-slate-900">{history.length}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500">Triggered</span>
                        <span className="font-medium text-red-600">
                          {history.filter((h) => h.action === 'triggered').length}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500">Acknowledged</span>
                        <span className="font-medium text-amber-600">
                          {history.filter((h) => h.action === 'acknowledged').length}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500">Resolved</span>
                        <span className="font-medium text-emerald-600">
                          {history.filter((h) => h.action === 'resolved').length}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500">Escalated</span>
                        <span className="font-medium text-violet-600">
                          {history.filter((h) => h.action === 'escalated').length}
                        </span>
                      </div>
                    </div>
                  </MedicalCard>

                  <MedicalCard>
                    <div className="flex items-start gap-2">
                      <Shield className="w-4 h-4 text-brand-600 mt-0.5 shrink-0" />
                      <div>
                        <h4 className="text-sm font-semibold text-slate-900 mb-1">TEE-Verified</h4>
                        <p className="text-xs text-slate-500">
                          All alert predictions are generated inside secure TEE enclaves and verified on the Aethelred blockchain.
                        </p>
                      </div>
                    </div>
                  </MedicalCard>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>

      <Footer />

      {/* Create Rule Modal */}
      {showCreateModal && (
        <CreateRuleModal
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateRule}
          isLoading={mutations.createRule.isLoading}
        />
      )}
    </>
  );
}
