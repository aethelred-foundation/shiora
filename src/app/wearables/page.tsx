/**
 * Shiora on Aethelred — Wearable Integration Hub Page
 *
 * Connect and sync wearable devices, visualize health metrics,
 * and manage data syncing with TEE attestation.
 */

'use client';

import { useState, useMemo } from 'react';
import {
  Watch,
  RefreshCw,
  Activity,
  Database,
  ShieldCheck,
  Clock,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Apple,
  CircleDot,
  Zap,
  Compass,
} from 'lucide-react';

import { useApp } from '@/contexts/AppContext';
import {
  TopNav,
  Footer,
  ToastContainer,
  SearchOverlay,
  Badge,
  Tabs,
  Modal,
} from '@/components/ui/SharedComponents';
import {
  MedicalCard,
  SectionHeader,
  StatusBadge,
  HealthMetricCard,
} from '@/components/ui/PagePrimitives';
import {
  DeviceCard,
  WearableChart,
  DataPointList,
  ConnectionWizard,
  SyncStatusBar,
} from '@/components/wearables/WearableComponents';
import { useWearables } from '@/hooks/useWearables';
import { WEARABLE_PROVIDERS, BRAND, CHART_COLORS, EXTENDED_STATUS_STYLES } from '@/lib/constants';
import { formatNumber, timeAgo, truncateAddress } from '@/lib/utils';
import type { WearableProvider, WearableMetricType } from '@/types';

// ============================================================
// Constants
// ============================================================

const SEED = 1010;

const METRIC_OPTIONS: { id: WearableMetricType; label: string }[] = [
  { id: 'heart_rate', label: 'Heart Rate' },
  { id: 'hrv', label: 'HRV' },
  { id: 'sleep_duration', label: 'Sleep' },
  { id: 'temperature', label: 'Temperature' },
  { id: 'steps', label: 'Steps' },
  { id: 'spo2', label: 'SpO2' },
  { id: 'calories', label: 'Calories' },
  { id: 'respiratory_rate', label: 'Respiratory Rate' },
];

const METRIC_COLORS: Record<string, string> = {
  heart_rate: '#f43f5e',
  hrv: '#a78bfa',
  sleep_duration: '#6366f1',
  temperature: '#fb923c',
  steps: '#10b981',
  spo2: '#8B1538',
  calories: '#eab308',
  respiratory_rate: '#06b6d4',
};

// ============================================================
// Main Page
// ============================================================

export default function WearablesPage() {
  const { wallet } = useApp();
  const wearables = useWearables();

  const [connectingProvider, setConnectingProvider] = useState<WearableProvider | null>(null);

  const connectedDevices = wearables.devices.filter(
    (d) => d.status === 'connected' || d.status === 'syncing',
  );

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
                <Watch className="w-6 h-6 text-brand-600" />
                <h1 className="text-2xl font-bold text-slate-900">Wearable Integration Hub</h1>
              </div>
              <p className="text-sm text-slate-500">
                Connect wearable devices and sync health data with TEE-verified encryption
              </p>
            </div>
            <button
              onClick={wearables.syncAllDevices}
              disabled={wearables.sync.isLoading || connectedDevices.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-brand-600 text-white rounded-xl font-medium text-sm hover:bg-brand-700 transition-colors shadow-sm disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${wearables.sync.isLoading ? 'animate-spin' : ''}`} />
              Sync All Devices
            </button>
          </div>

          {/* ---- Stats ---- */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
            <HealthMetricCard
              icon={<Watch className="w-5 h-5" />}
              label="Connected Devices"
              value={wearables.connectedDeviceCount.toString()}
              unit={`of ${wearables.devices.length}`}
              sparklineData={[1, 2, 2, 3, 3, 3, 3, 3]}
              sparklineColor={BRAND.sky}
            />
            <HealthMetricCard
              icon={<Database className="w-5 h-5" />}
              label="Data Points"
              value={formatNumber(wearables.totalDataPoints)}
              unit="synced"
              trend={8.5}
              trendLabel="this week"
              sparklineData={[100, 120, 140, 160, 180, 200, 220, 250]}
              sparklineColor="#a78bfa"
            />
            <HealthMetricCard
              icon={<ShieldCheck className="w-5 h-5" />}
              label="TEE Attestations"
              value={wearables.syncBatches
                .filter((b) => b.status === 'completed')
                .length.toString()}
              unit="verified syncs"
              sparklineData={[5, 6, 7, 7, 8, 9, 9, 10]}
              sparklineColor="#10b981"
            />
            <HealthMetricCard
              icon={<Clock className="w-5 h-5" />}
              label="Last Sync"
              value={
                connectedDevices.length > 0
                  ? timeAgo(Math.max(...connectedDevices.map((d) => d.lastSync)))
                  : 'N/A'
              }
              sparklineData={[0, 1, 1, 2, 2, 3, 3, 1]}
              sparklineColor="#fb923c"
            />
          </div>

          {/* ---- Device Grid ---- */}
          <SectionHeader
            title="Devices"
            subtitle="Connect and manage your wearable devices"
            size="sm"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-10">
            {wearables.devices.map((device) => (
              <DeviceCard
                key={device.id}
                device={device}
                onConnect={(provider) => setConnectingProvider(provider)}
                onDisconnect={(id) => wearables.disconnect.mutate(id)}
                onSync={(id) => wearables.sync.mutate(id)}
                isSyncing={wearables.sync.isLoading}
              />
            ))}
          </div>

          {/* ---- Data Visualization ---- */}
          {connectedDevices.length > 0 && (
            <>
              <SectionHeader
                title="Data Visualization"
                subtitle="Health metrics from connected devices"
                size="sm"
              />

              {/* Metric selector */}
              <div className="flex flex-wrap gap-2 mb-6">
                {METRIC_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => wearables.setSelectedMetric(opt.id)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                      wearables.selectedMetric === opt.id
                        ? 'bg-brand-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Chart */}
              <div className="mb-8">
                <WearableChart
                  dataPoints={wearables.dataPoints}
                  metric={wearables.selectedMetric}
                  color={
                    METRIC_COLORS[wearables.selectedMetric] ??
                    /* istanbul ignore next -- selectedMetric always in METRIC_COLORS */
                    BRAND.sky
                  }
                />
              </div>

              {/* Data Points Table */}
              <div className="mb-8">
                <DataPointList dataPoints={wearables.dataPoints} />
              </div>
            </>
          )}

          {/* ---- Sync History ---- */}
          <SectionHeader
            title="Sync History"
            subtitle="Recent device synchronization batches"
            size="sm"
          />
          <MedicalCard padding={false}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                      Device
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                      Data Points
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                      Status
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                      TEE Attestation
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                      Synced
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {wearables.syncBatches.map((batch) => {
                    const device = wearables.devices.find((d) => d.id === batch.deviceId);
                    const providerMeta = device
                      ? WEARABLE_PROVIDERS.find((p) => p.id === device.provider)
                      : null;
                    return (
                      <tr key={batch.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            {providerMeta && (
                              <div
                                className="w-6 h-6 rounded-md flex items-center justify-center text-white text-xs"
                                style={{ backgroundColor: providerMeta.color }}
                              >
                                {providerMeta.name.charAt(0)}
                              </div>
                            )}
                            <span className="text-slate-700">
                              {providerMeta?.name ?? 'Unknown'}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-3 font-medium text-slate-900">
                          {batch.dataPointCount}
                        </td>
                        <td className="px-5 py-3">
                          <StatusBadge status={batch.status} styles={EXTENDED_STATUS_STYLES} />
                        </td>
                        <td className="px-5 py-3">
                          <code className="text-xs text-slate-500 font-mono">
                            {truncateAddress(batch.attestation, 8, 6)}
                          </code>
                        </td>
                        <td className="px-5 py-3 text-slate-500">{timeAgo(batch.syncedAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </MedicalCard>
        </div>
      </main>

      <Footer />

      {/* Connection Wizard Modal */}
      <Modal
        open={!!connectingProvider}
        onClose={() => setConnectingProvider(null)}
        title="Connect Device"
        size="sm"
      >
        {connectingProvider && (
          <ConnectionWizard
            provider={connectingProvider}
            onConnect={() => {
              wearables.connect.mutate(connectingProvider);
              setConnectingProvider(null);
            }}
            onCancel={() => setConnectingProvider(null)}
            isLoading={wearables.connect.isLoading}
          />
        )}
      </Modal>
    </>
  );
}
