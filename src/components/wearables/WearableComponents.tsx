/**
 * Shiora on Aethelred — Wearable Components
 * Reusable components for the Wearable Integration Hub feature.
 */

'use client';

import React, { useState } from 'react';
import {
  Apple, CircleDot, Zap, Watch, Compass,
  RefreshCw, Power, PowerOff, Battery,
  ShieldCheck, Clock, Database, Activity,
  CheckCircle, AlertTriangle, XCircle,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts';

import { MedicalCard, ChartTooltip, StatusBadge } from '@/components/ui/PagePrimitives';
import { Badge, ProgressRing } from '@/components/ui/SharedComponents';
import { WEARABLE_PROVIDERS, EXTENDED_STATUS_STYLES } from '@/lib/constants';
import { formatNumber, formatDate, formatDateTime, timeAgo } from '@/lib/utils';
import type { WearableDevice, WearableDataPoint, WearableSyncBatch, WearableProvider as WearableProviderType, WearableMetricType } from '@/types';

// ============================================================
// Provider icon/color map
// ============================================================

const PROVIDER_ICON_MAP: Record<string, React.ReactNode> = {
  apple_health: <Apple className="w-5 h-5" />,
  oura: <CircleDot className="w-5 h-5" />,
  whoop: <Zap className="w-5 h-5" />,
  fitbit: <Watch className="w-5 h-5" />,
  garmin: <Compass className="w-5 h-5" />,
};

/* istanbul ignore next -- fallback branches for unknown provider IDs are defensive */
function getProviderMeta(providerId: string) {
  const provider = WEARABLE_PROVIDERS.find((p) => p.id === providerId);
  return {
    name: provider?.name ?? providerId,
    color: provider?.color ?? '#94a3b8',
    icon: PROVIDER_ICON_MAP[providerId] ?? <Watch className="w-5 h-5" />,
    metrics: (provider?.metrics ?? []) as WearableMetricType[],
  };
}

// ============================================================
// DeviceCard
// ============================================================

export function DeviceCard({
  device,
  onConnect,
  onDisconnect,
  onSync,
  isSyncing = false,
}: {
  device: WearableDevice;
  onConnect?: (provider: WearableProviderType) => void;
  onDisconnect?: (id: string) => void;
  onSync?: (id: string) => void;
  isSyncing?: boolean;
}) {
  const provider = getProviderMeta(device.provider);
  const isConnected = device.status === 'connected' || device.status === 'syncing';

  return (
    <MedicalCard>
      <div className="flex items-start justify-between mb-4">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center text-white"
          style={{ backgroundColor: provider.color }}
        >
          {provider.icon}
        </div>
        <StatusBadge status={device.status} styles={EXTENDED_STATUS_STYLES} />
      </div>

      <h3 className="text-sm font-semibold text-slate-900 mb-0.5">{provider.name}</h3>
      <p className="text-xs text-slate-500 mb-3">{device.deviceName}</p>

      {isConnected && (
        <div className="space-y-2 mb-4">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Last Sync
            </span>
            <span className="text-slate-700 font-medium">{device.lastSync ? timeAgo(device.lastSync) : /* istanbul ignore next */ 'Never'}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 flex items-center gap-1">
              <Database className="w-3 h-3" />
              Data Points
            </span>
            <span className="text-slate-700 font-medium">{formatNumber(device.dataPointsSynced)}</span>
          </div>
          {device.batteryLevel !== undefined && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 flex items-center gap-1">
                <Battery className="w-3 h-3" />
                Battery
              </span>
              <span className={`font-medium ${device.batteryLevel > 20 ? 'text-emerald-600' : 'text-red-600'}`}>
                {device.batteryLevel}%
              </span>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2 pt-3 border-t border-slate-100">
        {isConnected ? (
          <>
            <button
              onClick={() => onSync?.(device.id)}
              disabled={isSyncing}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Syncing...' : 'Sync'}
            </button>
            <button
              onClick={() => onDisconnect?.(device.id)}
              className="px-3 py-2 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
            >
              <PowerOff className="w-3.5 h-3.5" />
            </button>
          </>
        ) : (
          <button
            onClick={() => onConnect?.(device.provider)}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors"
          >
            <Power className="w-3.5 h-3.5" />
            Connect
          </button>
        )}
      </div>
    </MedicalCard>
  );
}

// ============================================================
// SyncStatusBar
// ============================================================

export function SyncStatusBar({ progress, label }: { progress: number; label?: string }) {
  return (
    <div className="w-full">
      {label && <p className="text-xs text-slate-500 mb-1">{label}</p>}
      <div className="w-full bg-slate-100 rounded-full h-2">
        <div
          className="bg-brand-500 h-2 rounded-full transition-all duration-500"
          style={{ width: `${Math.min(progress, 100)}%` }}
        />
      </div>
      <p className="text-xs text-slate-400 mt-1 text-right">{progress}%</p>
    </div>
  );
}

// ============================================================
// WearableChart
// ============================================================

export function WearableChart({
  dataPoints,
  metric,
  color = '#8B1538',
}: {
  dataPoints: WearableDataPoint[];
  metric: WearableMetricType;
  color?: string;
}) {
  const sorted = [...dataPoints]
    .filter((dp) => dp.metric === metric)
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(-50);

  const chartData = sorted.map((dp) => ({
    time: new Date(dp.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    value: dp.value,
  }));

  const unit = sorted[0]?.unit ?? '';

  return (
    <MedicalCard padding={false}>
      <div className="p-5 pb-0">
        <h3 className="text-base font-semibold text-slate-900 capitalize">
          {metric.replace(/_/g, ' ')}
        </h3>
        <p className="text-xs text-slate-400 mt-0.5">{sorted.length} data points ({unit})</p>
      </div>
      <div className="px-2 pb-4 pt-2">
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#94a3b8' }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} interval={Math.max(1, Math.floor(chartData.length / 8))} />
            <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
            <Tooltip content={<ChartTooltip formatValue={(v) => `${v} ${unit}`} />} />
            <Line
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: color }}
              name={metric.replace(/_/g, ' ')}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </MedicalCard>
  );
}

// ============================================================
// DataPointList
// ============================================================

export function DataPointList({ dataPoints }: { dataPoints: WearableDataPoint[] }) {
  const recent = [...dataPoints].sort((a, b) => b.timestamp - a.timestamp).slice(0, 20);

  return (
    <MedicalCard padding={false}>
      <div className="p-5 pb-3">
        <h3 className="text-base font-semibold text-slate-900">Recent Data Points</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="px-5 py-2 text-left text-xs font-medium text-slate-500 uppercase">Metric</th>
              <th className="px-5 py-2 text-left text-xs font-medium text-slate-500 uppercase">Value</th>
              <th className="px-5 py-2 text-left text-xs font-medium text-slate-500 uppercase">Unit</th>
              <th className="px-5 py-2 text-left text-xs font-medium text-slate-500 uppercase">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {recent.map((dp) => (
              <tr key={dp.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-5 py-2 capitalize text-slate-700">{dp.metric.replace(/_/g, ' ')}</td>
                <td className="px-5 py-2 font-semibold text-slate-900">{dp.value.toFixed(1)}</td>
                <td className="px-5 py-2 text-slate-500">{dp.unit}</td>
                <td className="px-5 py-2 text-slate-500">{timeAgo(dp.timestamp)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </MedicalCard>
  );
}

// ============================================================
// ConnectionWizard
// ============================================================

export function ConnectionWizard({
  provider,
  onConnect,
  onCancel,
  isLoading,
}: {
  provider: WearableProviderType;
  onConnect: () => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const [step, setStep] = useState(1);
  const meta = getProviderMeta(provider);

  return (
    <div className="space-y-6">
      {/* Progress Steps */}
      <div className="flex items-center justify-center gap-4">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                step >= s
                  ? 'bg-brand-600 text-white'
                  : 'bg-slate-100 text-slate-400'
              }`}
            >
              {step > s ? <CheckCircle className="w-4 h-4" /> : s}
            </div>
            {s < 3 && <div className={`w-12 h-0.5 ${step > s ? 'bg-brand-600' : 'bg-slate-200'}`} />}
          </div>
        ))}
      </div>

      {/* Step Content */}
      {step === 1 && (
        <div className="text-center">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-white mx-auto mb-4"
            style={{ backgroundColor: meta.color }}
          >
            {meta.icon}
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">Connect {meta.name}</h3>
          <p className="text-sm text-slate-500 mb-6">
            Authorize Shiora to securely sync your health data via TEE-protected channels.
          </p>
          <button
            onClick={() => setStep(2)}
            className="px-6 py-2.5 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-xl transition-colors"
          >
            Authorize Connection
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-4">
            <ShieldCheck className="w-8 h-8 text-emerald-600" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">TEE Verification</h3>
          <p className="text-sm text-slate-500 mb-6">
            Your data will be encrypted and processed exclusively inside a secure TEE enclave.
          </p>
          <button
            onClick={() => setStep(3)}
            className="px-6 py-2.5 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-xl transition-colors"
          >
            Verify & Connect
          </button>
        </div>
      )}

      {step === 3 && (
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-brand-50 flex items-center justify-center mx-auto mb-4">
            <Activity className="w-8 h-8 text-brand-600" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">Confirm Connection</h3>
          <p className="text-sm text-slate-500 mb-6">
            Ready to start syncing. Your data is protected by end-to-end encryption and TEE attestation.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={onCancel}
              className="px-5 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onConnect}
              disabled={isLoading}
              className="px-5 py-2.5 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-xl transition-colors disabled:opacity-50"
            >
              {isLoading ? 'Connecting...' : 'Connect Now'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
