'use client';

import React, { useState } from 'react';
import {
  AlertTriangle, AlertCircle, Info, CheckCircle, Bell,
  Mail, Smartphone, MessageSquare, Clock, Shield,
  ToggleLeft, ToggleRight, Edit2, ChevronDown, ChevronUp,
  Thermometer, Heart, Activity, Droplets, Gauge,
  Moon, TrendingUp, Zap, Brain,
} from 'lucide-react';

import type {
  PredictiveAlert,
  AlertRule,
  AlertHistory,
  AlertSeverity,
  AlertChannel,
  AlertMetric,
} from '@/types';
import { MedicalCard } from '@/components/ui/PagePrimitives';
import { Badge } from '@/components/ui/SharedComponents';
import { ALERT_CHANNELS } from '@/lib/constants';
import { formatDateTime, timeAgo, truncateAddress } from '@/lib/utils';

// ============================================================
// Shared Helpers
// ============================================================

const SEVERITY_STYLES: Record<AlertSeverity, { border: string; bg: string; icon: React.ReactNode; badge: 'error' | 'warning' | 'info' }> = {
  critical: { border: 'border-red-300', bg: 'bg-red-50', icon: <AlertTriangle className="w-5 h-5 text-red-500" />, badge: 'error' },
  warning: { border: 'border-amber-300', bg: 'bg-amber-50', icon: <AlertCircle className="w-5 h-5 text-amber-500" />, badge: 'warning' },
  info: { border: 'border-brand-300', bg: 'bg-brand-50', icon: <Info className="w-5 h-5 text-brand-500" />, badge: 'info' },
};

const METRIC_ICONS: Record<string, React.ReactNode> = {
  temperature: <Thermometer className="w-4 h-4" />,
  cycle_length: <Activity className="w-4 h-4" />,
  heart_rate: <Heart className="w-4 h-4" />,
  hrv: <TrendingUp className="w-4 h-4" />,
  spo2: <Droplets className="w-4 h-4" />,
  blood_pressure: <Gauge className="w-4 h-4" />,
  glucose: <Zap className="w-4 h-4" />,
  sleep_score: <Moon className="w-4 h-4" />,
};

const CHANNEL_ICONS: Record<string, React.ReactNode> = {
  in_app: <Bell className="w-3.5 h-3.5" />,
  email: <Mail className="w-3.5 h-3.5" />,
  push: <Smartphone className="w-3.5 h-3.5" />,
  sms: <MessageSquare className="w-3.5 h-3.5" />,
};

const METRIC_LABELS: Record<string, string> = {
  temperature: 'Body Temperature',
  cycle_length: 'Cycle Length',
  heart_rate: 'Heart Rate',
  hrv: 'Heart Rate Variability',
  spo2: 'Blood Oxygen',
  blood_pressure: 'Blood Pressure',
  glucose: 'Blood Glucose',
  sleep_score: 'Sleep Score',
};

// ============================================================
// AlertCard
// ============================================================

interface AlertCardProps {
  alert: PredictiveAlert;
  onAcknowledge?: (id: string) => void;
  onResolve?: (id: string) => void;
}

export function AlertCard({ alert, onAcknowledge, onResolve }: AlertCardProps) {
  const style = SEVERITY_STYLES[alert.severity];
  const isActive = !alert.acknowledgedAt && !alert.resolvedAt;
  const isAcknowledged = !!alert.acknowledgedAt && !alert.resolvedAt;

  return (
    <MedicalCard className={`border-l-4 ${style.border}`}>
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-xl ${style.bg} flex items-center justify-center shrink-0`}>
          {style.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h3 className="text-sm font-semibold text-slate-900">{alert.title}</h3>
            <Badge variant={style.badge}>{alert.severity}</Badge>
            {alert.resolvedAt && <Badge variant="success" dot>Resolved</Badge>}
            {isAcknowledged && <Badge variant="warning" dot>Acknowledged</Badge>}
            {isActive && <Badge variant="error" dot>Active</Badge>}
          </div>

          <div className="flex items-center gap-3 mb-2 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              {METRIC_ICONS[alert.metric]}
              {METRIC_LABELS[alert.metric] ?? alert.metric}
            </span>
            <span className="font-mono font-medium text-slate-700">
              {alert.currentValue} <span className="text-slate-400">/ {alert.threshold}</span>
            </span>
          </div>

          <p className="text-xs text-slate-600 mb-3 line-clamp-2">{alert.message}</p>

          <div className="flex items-center gap-4 text-2xs text-slate-400">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {timeAgo(alert.triggeredAt)}
            </span>
            <span className="flex items-center gap-1">
              <Brain className="w-3 h-3" />
              {alert.confidence}% confidence
            </span>
            <span className="flex items-center gap-1">
              <Shield className="w-3 h-3" />
              {truncateAddress(alert.attestation, 6, 4)}
            </span>
          </div>
        </div>
      </div>

      {(isActive || isAcknowledged) && (
        <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-100">
          {isActive && onAcknowledge && (
            <button
              onClick={() => onAcknowledge(alert.id)}
              className="px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors"
            >
              Acknowledge
            </button>
          )}
          {!alert.resolvedAt && onResolve && (
            <button
              onClick={() => onResolve(alert.id)}
              className="px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors"
            >
              Resolve
            </button>
          )}
        </div>
      )}
    </MedicalCard>
  );
}

// ============================================================
// AlertRuleCard
// ============================================================

interface AlertRuleCardProps {
  rule: AlertRule;
  onToggle?: (id: string) => void;
  onEdit?: (rule: AlertRule) => void;
}

export function AlertRuleCard({ rule, onToggle, onEdit }: AlertRuleCardProps) {
  const conditionLabel = rule.condition === 'above' ? 'Above' : rule.condition === 'below' ? 'Below' : 'Deviation';

  return (
    <MedicalCard>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center text-brand-600">
            {METRIC_ICONS[rule.metric] ?? <Activity className="w-4 h-4" />}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              {METRIC_LABELS[rule.metric] ?? rule.metric}
            </h3>
            <p className="text-xs text-slate-500">
              {conditionLabel} {rule.threshold} {rule.unit}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={SEVERITY_STYLES[rule.severity].badge}>{rule.severity}</Badge>
          <button
            onClick={() => onToggle?.(rule.id)}
            className="text-slate-400 hover:text-slate-600 transition-colors"
            title={rule.enabled ? 'Disable rule' : 'Enable rule'}
          >
            {rule.enabled ? (
              <ToggleRight className="w-6 h-6 text-emerald-500" />
            ) : (
              <ToggleLeft className="w-6 h-6 text-slate-300" />
            )}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-3 flex-wrap">
        {rule.channels.map((ch) => {
          const channelDef = ALERT_CHANNELS.find((c) => c.id === ch);
          return (
            <span
              key={ch}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-50 rounded-md text-2xs text-slate-600 border border-slate-100"
            >
              {CHANNEL_ICONS[ch]}
              {channelDef?.label ??
                /* istanbul ignore next -- channelDef always found for known channels */
                ch}
            </span>
          );
        })}
      </div>

      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>Cooldown: {rule.cooldownMinutes}min</span>
        {onEdit && (
          <button
            onClick={() => onEdit(rule)}
            className="flex items-center gap-1 text-brand-600 hover:text-brand-700 transition-colors"
          >
            <Edit2 className="w-3.5 h-3.5" />
            Edit
          </button>
        )}
      </div>
    </MedicalCard>
  );
}

// ============================================================
// ThresholdSlider
// ============================================================

interface ThresholdSliderProps {
  min: number;
  max: number;
  threshold: number;
  currentValue?: number;
  unit: string;
  onChange: (value: number) => void;
  condition: 'above' | 'below' | 'deviation';
}

export function ThresholdSlider({
  min,
  max,
  threshold,
  currentValue,
  unit,
  onChange,
  condition,
}: ThresholdSliderProps) {
  const range = max - min;
  const thresholdPct = ((threshold - min) / range) * 100;
  const currentPct = currentValue !== undefined ? ((currentValue - min) / range) * 100 : undefined;

  const dangerZoneStyle = condition === 'above'
    ? { left: `${thresholdPct}%`, right: '0%' }
    : condition === 'below'
    ? { left: '0%', right: `${100 - thresholdPct}%` }
    : { left: `${Math.max(0, thresholdPct - 10)}%`, right: `${Math.max(0, 100 - thresholdPct - 10)}%` };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>{min} {unit}</span>
        <span className="font-medium text-slate-700">Threshold: {threshold} {unit}</span>
        <span>{max} {unit}</span>
      </div>
      <div className="relative h-8">
        {/* Track background */}
        <div className="absolute top-3 left-0 right-0 h-2 bg-emerald-100 rounded-full" />
        {/* Danger zone */}
        <div
          className="absolute top-3 h-2 bg-red-100 rounded-full"
          style={dangerZoneStyle}
        />
        {/* Current value marker */}
        {currentPct !== undefined && (
          <div
            className="absolute top-1.5 w-3 h-5 bg-slate-700 rounded-sm -translate-x-1/2"
            style={{ left: `${Math.min(100, Math.max(0, currentPct))}%` }}
            title={`Current: ${currentValue} ${unit}`}
          />
        )}
        {/* Threshold line */}
        <div
          className="absolute top-0 w-0.5 h-8 bg-red-500 -translate-x-1/2"
          style={{ left: `${thresholdPct}%` }}
        />
        {/* Range input */}
        <input
          type="range"
          min={min}
          max={max}
          step={(max - min) / 100}
          value={threshold}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="absolute top-0 left-0 w-full h-8 opacity-0 cursor-pointer"
        />
      </div>
    </div>
  );
}

// ============================================================
// AlertTimeline
// ============================================================

interface AlertTimelineProps {
  history: AlertHistory[];
}

const ACTION_STYLES: Record<string, { color: string; icon: React.ReactNode }> = {
  triggered: { color: 'bg-red-500', icon: <AlertTriangle className="w-3 h-3 text-white" /> },
  acknowledged: { color: 'bg-amber-500', icon: <CheckCircle className="w-3 h-3 text-white" /> },
  resolved: { color: 'bg-emerald-500', icon: <CheckCircle className="w-3 h-3 text-white" /> },
  escalated: { color: 'bg-violet-500', icon: <TrendingUp className="w-3 h-3 text-white" /> },
};

export function AlertTimeline({ history }: AlertTimelineProps) {
  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-slate-200" />

      <div className="space-y-4">
        {history.map((entry) => {
          const actionStyle = ACTION_STYLES[entry.action] ?? ACTION_STYLES.triggered;
          return (
            <div key={entry.id} className="relative flex gap-4 pl-0">
              {/* Dot */}
              <div className={`relative z-10 w-6 h-6 rounded-full ${actionStyle.color} flex items-center justify-center shrink-0`}>
                {actionStyle.icon}
              </div>
              {/* Content */}
              <div className="flex-1 min-w-0 pb-2">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-medium text-slate-900 capitalize">
                    {entry.action}
                  </span>
                  {entry.actor && (
                    <span className="text-xs text-slate-500">by {entry.actor}</span>
                  )}
                </div>
                <p className="text-xs text-slate-400">{formatDateTime(entry.timestamp)}</p>
                {entry.notes && (
                  <p className="text-xs text-slate-600 mt-1 bg-slate-50 rounded-lg p-2">
                    {entry.notes}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// ChannelSelector
// ============================================================

interface ChannelSelectorProps {
  selected: AlertChannel[];
  onChange: (channels: AlertChannel[]) => void;
}

export function ChannelSelector({ selected, onChange }: ChannelSelectorProps) {
  const handleToggle = (channelId: AlertChannel) => {
    if (selected.includes(channelId)) {
      onChange(selected.filter((c) => c !== channelId));
    } else {
      onChange([...selected, channelId]);
    }
  };

  return (
    <div className="grid grid-cols-2 gap-3">
      {ALERT_CHANNELS.map((channel) => {
        const isSelected = selected.includes(channel.id as AlertChannel);
        return (
          <button
            key={channel.id}
            onClick={() => handleToggle(channel.id as AlertChannel)}
            className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
              isSelected
                ? 'border-brand-300 bg-brand-50 text-brand-700'
                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
            }`}
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              isSelected ? 'bg-brand-100' : 'bg-slate-100'
            }`}>
              {CHANNEL_ICONS[channel.id]}
            </div>
            <div>
              <p className="text-sm font-medium">{channel.label}</p>
              <p className="text-2xs text-slate-400">{channel.description}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
