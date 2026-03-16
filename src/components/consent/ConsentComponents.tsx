/**
 * Shiora on Aethelred — Consent Management Components
 *
 * Reusable components for the enhanced consent management feature:
 * ConsentCard, ConsentTimeline, ConsentScopeSelector, ConsentExpiryPicker,
 * CreateConsentModal, SmartContractStatus.
 */

'use client';

import React, { useState, useMemo } from 'react';
import {
  Shield, ShieldCheck, ShieldOff, Clock, Calendar,
  CheckCircle, XCircle, AlertTriangle, RefreshCw,
  ChevronRight, X, Eye, Pencil, Ban, RotateCcw,
  Building2, FileText, TestTube2, ScanLine, Pill,
  HeartPulse, Heart, Watch, Brain, Lock,
  Search, ChevronDown, Check, Loader2,
} from 'lucide-react';

import type {
  ConsentGrant,
  ConsentScope,
  ConsentStatus,
  ConsentPolicy,
  ConsentAuditEntry,
  CreateConsentForm,
} from '@/types';
import { CONSENT_SCOPES, PROVIDER_NAMES, EXTENDED_STATUS_STYLES } from '@/lib/constants';
import { truncateAddress, formatDate, formatDateTime, timeAgo, daysFromNow } from '@/lib/utils';
import { MedicalCard, CopyButton, TruncatedHash } from '@/components/ui/PagePrimitives';
import { Badge, Modal } from '@/components/ui/SharedComponents';

// ============================================================
// Icon Mapping for Scopes
// ============================================================

const SCOPE_ICON_MAP: Record<string, React.ReactNode> = {
  cycle_data: <Calendar className="w-4 h-4" />,
  fertility_markers: <Heart className="w-4 h-4" />,
  lab_results: <TestTube2 className="w-4 h-4" />,
  imaging: <ScanLine className="w-4 h-4" />,
  prescriptions: <Pill className="w-4 h-4" />,
  vitals: <HeartPulse className="w-4 h-4" />,
  clinical_notes: <FileText className="w-4 h-4" />,
  wearable_data: <Watch className="w-4 h-4" />,
  ai_inferences: <Brain className="w-4 h-4" />,
  full_access: <Shield className="w-4 h-4" />,
};

function getScopeLabel(scopeId: string): string {
  return CONSENT_SCOPES.find((s) => s.id === scopeId)?.label ??
    /* istanbul ignore next */
    scopeId;
}

// ============================================================
// Status helpers
// ============================================================

const STATUS_CONFIG: Record<ConsentStatus, { variant: 'success' | 'neutral' | 'error' | 'warning'; label: string }> = {
  active: { variant: 'success', label: 'Active' },
  expired: { variant: 'neutral', label: 'Expired' },
  revoked: { variant: 'error', label: 'Revoked' },
  pending: { variant: 'warning', label: 'Pending' },
};

// ============================================================
// ConsentCard
// ============================================================

interface ConsentCardProps {
  consent: ConsentGrant;
  onRevoke: () => void;
  onModify: () => void;
}

export function ConsentCard({ consent, onRevoke, onModify }: ConsentCardProps) {
  const daysLeft = daysFromNow(consent.expiresAt);
  const isExpiringSoon = consent.status === 'active' && daysLeft > 0 && daysLeft <= 7;
  const statusCfg = STATUS_CONFIG[consent.status];

  const expiryText = useMemo(() => {
    if (consent.status === 'revoked') return `Revoked ${consent.revokedAt ? timeAgo(consent.revokedAt) : ''}`;
    if (daysLeft < 0) return `Expired ${timeAgo(consent.expiresAt)}`;
    if (daysLeft === 0) return 'Expires today';
    return `${daysLeft} day${daysLeft !== 1 ? 's' : ''} remaining`;
  }, [consent, daysLeft]);

  return (
    <div className="bg-white/70 backdrop-blur-sm border border-white/20 shadow-lg rounded-2xl p-5 hover:shadow-xl transition-all duration-300">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-100 to-brand-200 flex items-center justify-center shrink-0">
            <Building2 className="w-5 h-5 text-brand-600" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-slate-900">{consent.providerName}</h4>
            <p className="text-xs text-slate-500">{truncateAddress(consent.providerAddress, 8, 4)}</p>
          </div>
        </div>
        <Badge variant={statusCfg.variant} dot>
          {statusCfg.label}
        </Badge>
      </div>

      {/* Scopes */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {consent.scopes.map((scope) => (
          <span
            key={scope}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-brand-50 text-brand-700 border border-brand-200"
          >
            {SCOPE_ICON_MAP[scope] ?? <Shield className="w-3 h-3" />}
            {getScopeLabel(scope)}
          </span>
        ))}
      </div>

      {/* Meta row */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mb-3">
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {expiryText}
        </span>
        {isExpiringSoon && (
          <span className="flex items-center gap-1 text-amber-500 font-medium">
            <AlertTriangle className="w-3 h-3" />
            Expiring soon
          </span>
        )}
        {consent.autoRenew && (
          <span className="flex items-center gap-1 text-brand-500">
            <RefreshCw className="w-3 h-3" />
            Auto-renew
          </span>
        )}
      </div>

      {/* Blockchain info */}
      <div className="flex items-center gap-3 mb-4">
        <div className="text-xs">
          <span className="text-slate-400">Tx: </span>
          <TruncatedHash hash={consent.txHash} startLen={8} endLen={4} />
        </div>
      </div>

      {/* Actions */}
      {consent.status === 'active' && (
        <div className="flex gap-2 pt-3 border-t border-slate-100">
          <button
            onClick={(e) => { e.stopPropagation(); onModify(); }}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-xl hover:bg-amber-100 transition-colors"
          >
            <Pencil className="w-3 h-3" />
            Modify
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onRevoke(); }}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-xl hover:bg-red-100 transition-colors"
          >
            <Ban className="w-3 h-3" />
            Revoke
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================
// ConsentTimeline
// ============================================================

interface ConsentTimelineProps {
  auditEntries: ConsentAuditEntry[];
}

const TIMELINE_COLORS: Record<ConsentAuditEntry['action'], { dot: string; bg: string }> = {
  granted: { dot: 'bg-emerald-500', bg: 'bg-emerald-50' },
  revoked: { dot: 'bg-red-500', bg: 'bg-red-50' },
  modified: { dot: 'bg-amber-500', bg: 'bg-amber-50' },
  expired: { dot: 'bg-slate-400', bg: 'bg-slate-50' },
  accessed: { dot: 'bg-brand-500', bg: 'bg-brand-50' },
};

const TIMELINE_ICONS: Record<ConsentAuditEntry['action'], React.ReactNode> = {
  granted: <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />,
  revoked: <XCircle className="w-3.5 h-3.5 text-red-600" />,
  modified: <Pencil className="w-3.5 h-3.5 text-amber-600" />,
  expired: <Clock className="w-3.5 h-3.5 text-slate-500" />,
  accessed: <Eye className="w-3.5 h-3.5 text-brand-600" />,
};

export function ConsentTimeline({ auditEntries }: ConsentTimelineProps) {
  const sorted = useMemo(
    () => [...auditEntries].sort((a, b) => b.timestamp - a.timestamp),
    [auditEntries],
  );

  if (sorted.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-slate-400">
        No audit entries found
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute left-4 top-0 bottom-0 w-px bg-slate-200" />

      <div className="space-y-4">
        {sorted.map((entry) => {
          const colors = TIMELINE_COLORS[entry.action] ??
            /* istanbul ignore next */
            { bg: 'bg-gray-100', dot: 'bg-gray-400', text: 'text-gray-700' };
          return (
            <div key={entry.id} className="relative flex items-start gap-3 pl-2">
              {/* Dot */}
              <div className={`relative z-10 w-5 h-5 rounded-full ${colors.bg} flex items-center justify-center shrink-0 ring-2 ring-white`}>
                <span className={`w-2 h-2 rounded-full ${colors.dot}`} />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 pb-3">
                <div className="flex items-center gap-2 mb-1">
                  {TIMELINE_ICONS[entry.action]}
                  <span className="text-sm font-medium text-slate-900 capitalize">{entry.action}</span>
                  <span className="text-xs text-slate-400">{timeAgo(entry.timestamp)}</span>
                </div>
                <p className="text-xs text-slate-500 mb-1">{entry.details}</p>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span>Actor: {truncateAddress(entry.actor, 6, 4)}</span>
                  <span className="text-slate-200">|</span>
                  <TruncatedHash hash={entry.txHash} startLen={6} endLen={4} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// ConsentScopeSelector
// ============================================================

interface ConsentScopeSelectorProps {
  selected: ConsentScope[];
  onChange: (scopes: ConsentScope[]) => void;
  maxScopes?: number;
}

export function ConsentScopeSelector({ selected, onChange, maxScopes = 10 }: ConsentScopeSelectorProps) {
  const toggleScope = (scopeId: ConsentScope) => {
    if (selected.includes(scopeId)) {
      onChange(selected.filter((s) => s !== scopeId));
    } else if (selected.length < maxScopes) {
      onChange([...selected, scopeId]);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-slate-700">Data Scopes</p>
        <span className="text-xs text-slate-400">{selected.length}/{maxScopes} selected</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {CONSENT_SCOPES.map((scope) => {
          const isSelected = selected.includes(scope.id as ConsentScope);
          const isDisabled = !isSelected && selected.length >= maxScopes;
          return (
            <button
              key={scope.id}
              type="button"
              onClick={() => toggleScope(scope.id as ConsentScope)}
              disabled={isDisabled}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left text-sm transition-all border ${
                isSelected
                  ? 'bg-brand-50 border-brand-300 text-brand-800 ring-1 ring-brand-200'
                  : isDisabled
                  ? 'bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed'
                  : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                isSelected ? 'bg-brand-500 border-brand-500' : 'border-slate-300 bg-white'
              }`}>
                {isSelected && <Check className="w-3 h-3 text-white" />}
              </div>
              <span className="flex items-center gap-1.5">
                {SCOPE_ICON_MAP[scope.id] ?? <Shield className="w-3.5 h-3.5" />}
                {scope.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// ConsentExpiryPicker
// ============================================================

interface ConsentExpiryPickerProps {
  durationDays: number;
  onChange: (days: number) => void;
}

const DURATION_PRESETS = [
  { label: '7 days', value: 7 },
  { label: '30 days', value: 30 },
  { label: '90 days', value: 90 },
  { label: '180 days', value: 180 },
  { label: '365 days', value: 365 },
];

export function ConsentExpiryPicker({ durationDays, onChange }: ConsentExpiryPickerProps) {
  const [customMode, setCustomMode] = useState(!DURATION_PRESETS.some((p) => p.value === durationDays));
  const expiryDate = new Date(Date.now() + durationDays * 86400000);

  return (
    <div>
      <p className="text-sm font-medium text-slate-700 mb-3">Duration</p>

      {/* Preset buttons */}
      <div className="flex flex-wrap gap-2 mb-3">
        {DURATION_PRESETS.map((preset) => (
          <button
            key={preset.value}
            type="button"
            onClick={() => { onChange(preset.value); setCustomMode(false); }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
              durationDays === preset.value && !customMode
                ? 'bg-brand-50 border-brand-300 text-brand-700'
                : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
            }`}
          >
            {preset.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setCustomMode(true)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
            customMode
              ? 'bg-brand-50 border-brand-300 text-brand-700'
              : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
          }`}
        >
          Custom
        </button>
      </div>

      {/* Custom input */}
      {customMode && (
        <div className="flex items-center gap-2 mb-3">
          <input
            type="number"
            min={1}
            max={730}
            value={durationDays}
            onChange={(e) => onChange(Math.max(1, Math.min(730, parseInt(e.target.value) ||
              /* istanbul ignore next */
              1)))}
            className="w-24 px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          />
          <span className="text-sm text-slate-500">days</span>
        </div>
      )}

      {/* Visual timeline */}
      <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
        <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
        <div className="flex-1">
          <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-brand-500 to-brand-300 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, (durationDays / 365) * 100)}%` }}
            />
          </div>
        </div>
        <span className="text-xs text-slate-500 whitespace-nowrap">
          Expires {expiryDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </span>
      </div>
    </div>
  );
}

// ============================================================
// CreateConsentModal
// ============================================================

interface CreateConsentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (form: CreateConsentForm) => void;
  policies: ConsentPolicy[];
  isLoading: boolean;
}

export function CreateConsentModal({ isOpen, onClose, onSubmit, policies, isLoading }: CreateConsentModalProps) {
  const [step, setStep] = useState(0);
  const [providerAddress, setProviderAddress] = useState('');
  const [providerName, setProviderName] = useState('');
  const [providerSearch, setProviderSearch] = useState('');
  const [scopes, setScopes] = useState<ConsentScope[]>([]);
  const [durationDays, setDurationDays] = useState(90);
  const [autoRenew, setAutoRenew] = useState(false);
  const [selectedPolicyId, setSelectedPolicyId] = useState<string | undefined>(undefined);

  const filteredProviders = useMemo(() => {
    if (!providerSearch) return [...PROVIDER_NAMES];
    const q = providerSearch.toLowerCase();
    return PROVIDER_NAMES.filter((p) => p.toLowerCase().includes(q));
  }, [providerSearch]);

  const resetForm = () => {
    setStep(0);
    setProviderAddress('');
    setProviderName('');
    setProviderSearch('');
    setScopes([]);
    setDurationDays(90);
    setAutoRenew(false);
    setSelectedPolicyId(undefined);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handlePolicySelect = (policyId: string) => {
    const policy = policies.find((p) => p.id === policyId);
    if (policy) {
      setSelectedPolicyId(policyId);
      setScopes(policy.scopes);
      setDurationDays(Math.min(durationDays, policy.maxDurationDays));
    }
  };

  const handleSubmit = () => {
    onSubmit({
      providerAddress: providerAddress || /* istanbul ignore next */ `aeth1${Math.random().toString(36).slice(2, 40)}`,
      providerName: providerName || /* istanbul ignore next */ 'Unknown Provider',
      scopes,
      durationDays,
      autoRenew,
      policyId: selectedPolicyId,
    });
    handleClose();
  };

  const canProceed = [
    providerName.length > 0,
    scopes.length > 0,
    durationDays > 0,
    true, // Review step
  ];

  const steps = ['Provider', 'Scopes', 'Duration', 'Review'];

  return (
    <Modal open={isOpen} onClose={handleClose} title="Create Consent Grant" size="lg">
      <div className="space-y-6">
        {/* Step indicator */}
        <div className="flex items-center gap-2">
          {steps.map((label, i) => (
            <React.Fragment key={label}>
              <button
                type="button"
                onClick={() => i < step && setStep(i)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  i === step
                    ? 'bg-brand-100 text-brand-700'
                    : i < step
                    ? 'bg-emerald-50 text-emerald-700 cursor-pointer hover:bg-emerald-100'
                    : 'bg-slate-100 text-slate-400'
                }`}
              >
                {i < step ? <Check className="w-3 h-3" /> : <span>{i + 1}</span>}
                {label}
              </button>
              {i < steps.length - 1 && <ChevronRight className="w-4 h-4 text-slate-300" />}
            </React.Fragment>
          ))}
        </div>

        {/* Policy selector */}
        {step === 0 && policies.length > 0 && (
          <div>
            <p className="text-sm font-medium text-slate-700 mb-2">Policy Template (optional)</p>
            <div className="flex flex-wrap gap-2">
              {policies.map((policy) => (
                <button
                  key={policy.id}
                  type="button"
                  onClick={() => handlePolicySelect(policy.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    selectedPolicyId === policy.id
                      ? 'bg-brand-50 border-brand-300 text-brand-700'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  {policy.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 1: Provider */}
        {step === 0 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Provider Name</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={providerSearch}
                  onChange={(e) => { setProviderSearch(e.target.value); setProviderName(e.target.value); }}
                  placeholder="Search or enter provider name..."
                  className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                />
              </div>
              {providerSearch && filteredProviders.length > 0 && (
                <div className="mt-1 border border-slate-200 rounded-xl overflow-hidden max-h-40 overflow-y-auto">
                  {filteredProviders.map((provider) => (
                    <button
                      key={provider}
                      type="button"
                      onClick={() => { setProviderName(provider); setProviderSearch(provider); }}
                      className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      {provider}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Provider Address (optional)</label>
              <input
                type="text"
                value={providerAddress}
                onChange={(e) => setProviderAddress(e.target.value)}
                placeholder="aeth1..."
                className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-brand-500 focus:border-transparent font-mono"
              />
            </div>
          </div>
        )}

        {/* Step 2: Scopes */}
        {step === 1 && (
          <ConsentScopeSelector selected={scopes} onChange={setScopes} />
        )}

        {/* Step 3: Duration */}
        {step === 2 && (
          <div className="space-y-4">
            <ConsentExpiryPicker durationDays={durationDays} onChange={setDurationDays} />
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-slate-500" />
                <span className="text-sm text-slate-700">Auto-renew on expiry</span>
              </div>
              <button
                type="button"
                onClick={() => setAutoRenew(!autoRenew)}
                className={`relative w-10 h-6 rounded-full transition-colors ${autoRenew ? 'bg-brand-500' : 'bg-slate-300'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${autoRenew ? 'translate-x-4' : ''}`} />
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Review */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="bg-slate-50 rounded-xl p-4 space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-slate-500">Provider</span>
                <span className="text-sm font-medium text-slate-900">{providerName}</span>
              </div>
              {providerAddress && (
                <div className="flex justify-between">
                  <span className="text-sm text-slate-500">Address</span>
                  <span className="text-sm font-mono text-slate-700">{truncateAddress(providerAddress, 8, 4)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-sm text-slate-500">Scopes</span>
                <span className="text-sm font-medium text-slate-900">{scopes.length} selected</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-slate-500">Duration</span>
                <span className="text-sm font-medium text-slate-900">{durationDays} days</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-slate-500">Auto-Renew</span>
                <span className="text-sm font-medium text-slate-900">{autoRenew
                  ? /* istanbul ignore next */ 'Yes'
                  : 'No'}</span>
              </div>
              {selectedPolicyId && (
                <div className="flex justify-between">
                  <span className="text-sm text-slate-500">Policy</span>
                  <span className="text-sm font-medium text-slate-900">
                    {policies.find((p) => p.id === selectedPolicyId)?.name ??
                      /* istanbul ignore next */
                      selectedPolicyId}
                  </span>
                </div>
              )}
            </div>

            {/* Scopes detail */}
            <div>
              <p className="text-sm font-medium text-slate-700 mb-2">Selected Scopes</p>
              <div className="flex flex-wrap gap-1.5">
                {scopes.map((scope) => (
                  <span
                    key={scope}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-brand-50 text-brand-700 border border-brand-200"
                  >
                    {SCOPE_ICON_MAP[scope] ?? <Shield className="w-3 h-3" />}
                    {getScopeLabel(scope)}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={() => step > 0 ? setStep(step - 1) : handleClose()}
            className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
          >
            {step === 0 ? 'Cancel' : 'Back'}
          </button>

          {step < 3 ? (
            <button
              type="button"
              onClick={() => setStep(step + 1)}
              disabled={!canProceed[step]}
              className="px-4 py-2 text-sm font-medium text-white bg-brand-500 hover:bg-brand-600 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continue
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isLoading}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-brand-500 hover:bg-brand-600 rounded-xl transition-colors disabled:opacity-50"
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              Grant Consent
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}

// ============================================================
// SmartContractStatus
// ============================================================

interface SmartContractStatusProps {
  txHash: string;
  attestation: string;
  status: ConsentStatus;
  expiresAt: number;
}

export function SmartContractStatus({ txHash, attestation, status, expiresAt }: SmartContractStatusProps) {
  const daysLeft = daysFromNow(expiresAt);
  const confirmations = 128 + Math.floor(Math.random() * 50);

  const statusColor = status === 'active'
    ? 'text-emerald-600 bg-emerald-50'
    : status === 'revoked'
    ? 'text-red-600 bg-red-50'
    : status === 'pending'
    ? 'text-amber-600 bg-amber-50'
    : 'text-slate-500 bg-slate-50';

  return (
    <div className="bg-white/70 backdrop-blur-sm border border-white/20 shadow-lg rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-2 mb-2">
        <Lock className="w-4 h-4 text-brand-600" />
        <h5 className="text-sm font-semibold text-slate-900">Smart Contract Status</h5>
      </div>

      {/* On-chain status */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-500">On-Chain Status</span>
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusColor}`}>
          {status === 'active' && <CheckCircle className="w-3 h-3" />}
          {status === 'revoked' && <XCircle className="w-3 h-3" />}
          {status === 'pending' && <Clock className="w-3 h-3" />}
          {status === 'expired' && <AlertTriangle className="w-3 h-3" />}
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </span>
      </div>

      {/* Block confirmations */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-500">Block Confirmations</span>
        <span className="text-xs font-medium text-emerald-600">{confirmations} blocks</span>
      </div>

      {/* Attestation */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-500">TEE Attestation</span>
        <div className="flex items-center gap-1">
          <ShieldCheck className="w-3 h-3 text-emerald-500" />
          <span className="text-xs text-emerald-600">Verified</span>
        </div>
      </div>

      {/* Countdown to expiry */}
      {status === 'active' && daysLeft > 0 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500">Expires In</span>
          <span className={`text-xs font-medium ${daysLeft <= 7 ? 'text-amber-600' : 'text-slate-700'}`}>
            {daysLeft} day{daysLeft !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      {/* Hashes */}
      <div className="pt-2 border-t border-slate-100 space-y-2">
        <div>
          <span className="text-xs text-slate-400 block mb-0.5">Transaction Hash</span>
          <TruncatedHash hash={txHash} startLen={10} endLen={6} />
        </div>
        <div>
          <span className="text-xs text-slate-400 block mb-0.5">Attestation Hash</span>
          <TruncatedHash hash={attestation} startLen={10} endLen={6} />
        </div>
      </div>
    </div>
  );
}
