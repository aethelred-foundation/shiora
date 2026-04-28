/**
 * Shiora on Aethelred — Grant Access Modal
 *
 * Modal for granting healthcare provider access to encrypted health data
 * with granular permissions, duration selection, and blockchain transaction simulation.
 */

'use client';

import React, { useState, useMemo, useCallback } from 'react';
import {
  Shield,
  Search,
  Building2,
  Eye,
  Download,
  ExternalLink,
  Calendar,
  Clock,
  CheckCircle,
  AlertCircle,
  Lock,
  ChevronRight,
  ChevronLeft,
  Fingerprint,
  Link2,
} from 'lucide-react';

import { Modal, Badge } from '@/components/ui/SharedComponents';
import { MedicalCard, TruncatedHash } from '@/components/ui/PagePrimitives';
import { PROVIDER_NAMES, SPECIALTIES, DATA_SCOPES } from '@/lib/constants';
import { seededAddress, generateTxHash } from '@/lib/utils';
/* istanbul ignore next -- no-op handler for non-closeable modals */
const noop = () => {};

// ============================================================
// Types
// ============================================================

interface GrantAccessModalProps {
  open: boolean;
  onClose: () => void;
  onGrantComplete?: (data: GrantData) => void;
}

interface GrantData {
  provider: string;
  address: string;
  scope: string;
  permissions: { view: boolean; download: boolean; share: boolean };
  duration: string;
  customExpiry: string;
}

type GrantStep = 'provider' | 'permissions' | 'review' | 'submitting' | 'success' | 'error';

// ============================================================
// Duration options
// ============================================================

const DURATION_OPTIONS = [
  { value: '7', label: '7 Days' },
  { value: '30', label: '30 Days' },
  { value: '90', label: '90 Days' },
  { value: '365', label: '1 Year' },
  { value: 'custom', label: 'Custom' },
];

// ============================================================
// Component
// ============================================================

export function GrantAccessModal({ open, onClose, onGrantComplete }: GrantAccessModalProps) {
  // Step state
  const [step, setStep] = useState<GrantStep>('provider');

  // Provider step
  const [providerSearch, setProviderSearch] = useState('');
  const [selectedProvider, setSelectedProvider] = useState('');
  const [providerAddress, setProviderAddress] = useState('');
  const [addressError, setAddressError] = useState('');

  // Permissions step
  const [scope, setScope] = useState('Full Records');
  const [canView, setCanView] = useState(true);
  const [canDownload, setCanDownload] = useState(false);
  const [canShare, setCanShare] = useState(false);
  const [duration, setDuration] = useState('30');
  const [customExpiry, setCustomExpiry] = useState('');

  // Submit state
  const [txHash, setTxHash] = useState('');

  const filteredProviders = useMemo(() => {
    if (!providerSearch) return PROVIDER_NAMES;
    return PROVIDER_NAMES.filter((p) => p.toLowerCase().includes(providerSearch.toLowerCase()));
  }, [providerSearch]);

  const resetForm = useCallback(() => {
    setStep('provider');
    setProviderSearch('');
    setSelectedProvider('');
    setProviderAddress('');
    setAddressError('');
    setScope('Full Records');
    setCanView(true);
    setCanDownload(false);
    setCanShare(false);
    setDuration('30');
    setCustomExpiry('');
    setTxHash('');
  }, []);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [resetForm, onClose]);

  const validateAddress = useCallback((addr: string) => {
    /* istanbul ignore next -- defensive guard: validateAddress is only called when addr is truthy */
    if (!addr) {
      setAddressError('Provider address is required');
      return false;
    }
    if (!addr.startsWith('aeth1') || addr.length < 20) {
      setAddressError('Invalid Aethelred address (must start with aeth1)');
      return false;
    }
    setAddressError('');
    return true;
  }, []);

  const selectProvider = useCallback((provider: string) => {
    setSelectedProvider(provider);
    // Generate a mock address for the provider
    const seed = provider.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    setProviderAddress(seededAddress(seed));
    setProviderSearch('');
  }, []);

  const goToPermissions = useCallback(() => {
    if (!selectedProvider && !providerAddress) {
      setAddressError('Please select a provider or enter an address');
      return;
    }
    if (providerAddress && !validateAddress(providerAddress)) return;
    setStep('permissions');
  }, [selectedProvider, providerAddress, validateAddress]);

  const goToReview = useCallback(() => {
    setStep('review');
  }, []);

  const submitGrant = useCallback(async () => {
    setStep('submitting');
    // Simulate blockchain transaction
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const hash = generateTxHash(Date.now());
    setTxHash(hash);
    setStep('success');

    onGrantComplete?.({
      provider: selectedProvider,
      address: providerAddress,
      scope,
      permissions: { view: canView, download: canDownload, share: canShare },
      duration,
      customExpiry,
    });
  }, [
    selectedProvider,
    providerAddress,
    scope,
    canView,
    canDownload,
    canShare,
    duration,
    customExpiry,
    onGrantComplete,
  ]);

  const expiryDate = useMemo(() => {
    if (duration === 'custom') return customExpiry;
    const d = new Date();
    d.setDate(d.getDate() + parseInt(duration, 10));
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }, [duration, customExpiry]);

  // ─── Success state ───
  if (step === 'success') {
    return (
      <Modal open={open} onClose={handleClose} size="md">
        <div className="text-center py-4">
          <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-emerald-500" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-2">Access Granted</h3>
          <p className="text-sm text-slate-500 mb-6">
            Provider access has been recorded on the Aethelred blockchain and will be enforced by
            TEE smart contracts.
          </p>

          <div className="bg-slate-50 rounded-xl p-4 mb-6 space-y-3 text-left">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Provider</span>
              <span className="font-medium text-slate-900">
                {selectedProvider || /* istanbul ignore next */ 'Custom Address'}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Scope</span>
              <Badge variant="info">{scope}</Badge>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Expires</span>
              <span className="font-medium text-slate-900">{expiryDate}</span>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Transaction Hash</p>
              <TruncatedHash hash={txHash} startLen={14} endLen={10} />
            </div>
          </div>

          <button
            onClick={handleClose}
            className="px-6 py-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-sm font-medium transition-colors"
          >
            Done
          </button>
        </div>
      </Modal>
    );
  }

  // ─── Error state ───
  /* istanbul ignore next -- error state is unreachable: submitGrant always succeeds */
  if (step === 'error') {
    return (
      <Modal open={open} onClose={handleClose} size="md">
        <div className="text-center py-4">
          <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-2">Transaction Failed</h3>
          <p className="text-sm text-slate-500 mb-6">
            The blockchain transaction could not be completed. Please try again.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={handleClose}
              className="px-5 py-2.5 border border-slate-200 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => setStep('review')}
              className="px-5 py-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-sm font-medium transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  // ─── Submitting state ───
  if (step === 'submitting') {
    return (
      <Modal open={open} onClose={noop} showClose={false} title="Processing Transaction" size="md">
        <div className="py-8 text-center">
          <div className="w-16 h-16 rounded-full bg-brand-50 flex items-center justify-center mx-auto mb-4">
            <div className="w-8 h-8 border-3 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
          <p className="text-sm text-slate-600 mb-2">Simulating blockchain transaction...</p>
          <p className="text-xs text-slate-400">
            Recording access grant on the Aethelred blockchain
          </p>
        </div>
      </Modal>
    );
  }

  // ─── Step indicators ───
  const steps = ['provider', 'permissions', 'review'] as const;
  const currentStepIndex = steps.indexOf(step as (typeof steps)[number]);

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={
        step === 'provider'
          ? 'Select Provider'
          : step === 'permissions'
            ? 'Set Permissions'
            : 'Review & Confirm'
      }
      description={
        step === 'provider'
          ? 'Choose a healthcare provider to grant access'
          : step === 'permissions'
            ? 'Configure data scope, permissions, and duration'
            : 'Review the access grant before submitting'
      }
      size="lg"
    >
      <div className="space-y-5">
        {/* Progress dots */}
        <div className="flex items-center justify-center gap-2">
          {steps.map((s, i) => (
            <React.Fragment key={s}>
              <div
                className={`w-2.5 h-2.5 rounded-full transition-colors ${
                  i <= currentStepIndex ? 'bg-brand-500' : 'bg-slate-200'
                }`}
              />
              {i < steps.length - 1 && (
                <div
                  className={`w-8 h-0.5 ${i < currentStepIndex ? 'bg-brand-500' : 'bg-slate-200'}`}
                />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* ─── Provider Step ─── */}
        {step === 'provider' && (
          <>
            {/* Provider search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={providerSearch}
                onChange={(e) => setProviderSearch(e.target.value)}
                placeholder="Search healthcare providers..."
                className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              />
            </div>

            {/* Provider list */}
            <div className="max-h-48 overflow-y-auto space-y-1">
              {filteredProviders.map((provider) => (
                <button
                  key={provider}
                  onClick={() => selectProvider(provider)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${
                    selectedProvider === provider
                      ? 'bg-brand-50 border border-brand-200'
                      : 'hover:bg-slate-50 border border-transparent'
                  }`}
                >
                  <div className="w-9 h-9 rounded-lg bg-brand-50 flex items-center justify-center shrink-0">
                    <Building2 className="w-4 h-4 text-brand-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900">{provider}</p>
                  </div>
                  {selectedProvider === provider && (
                    <CheckCircle className="w-4 h-4 text-brand-500 shrink-0" />
                  )}
                </button>
              ))}
            </div>

            {/* Manual address */}
            <div>
              <label className="block text-sm font-medium text-slate-900 mb-1.5">
                Or enter provider address manually
              </label>
              <div className="relative">
                <Fingerprint className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={providerAddress}
                  onChange={(e) => {
                    setProviderAddress(e.target.value);
                    setAddressError('');
                  }}
                  placeholder="aeth1..."
                  className="w-full pl-9 pr-4 py-2 text-sm font-mono border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                />
              </div>
              {addressError && <p className="text-xs text-red-500 mt-1">{addressError}</p>}
            </div>

            {/* Next */}
            <div className="flex justify-end pt-2">
              <button
                onClick={goToPermissions}
                className="px-5 py-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-sm font-medium transition-colors flex items-center gap-2"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </>
        )}

        {/* ─── Permissions Step ─── */}
        {step === 'permissions' && (
          <>
            {/* Data scope */}
            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">Data Scope</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {DATA_SCOPES.map((s) => (
                  <button
                    key={s}
                    onClick={() => setScope(s)}
                    className={`p-3 rounded-xl border-2 text-left transition-colors ${
                      scope === s
                        ? 'border-brand-500 bg-brand-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <span className="text-xs font-medium text-slate-700">{s}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Permissions */}
            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">Permissions</label>
              <div className="space-y-2">
                {[
                  {
                    key: 'view',
                    label: 'View',
                    desc: 'View records within TEE enclave',
                    icon: Eye,
                    enabled: canView,
                    toggle: setCanView,
                  },
                  {
                    key: 'download',
                    label: 'Download',
                    desc: 'Download encrypted records',
                    icon: Download,
                    enabled: canDownload,
                    toggle: setCanDownload,
                  },
                  {
                    key: 'share',
                    label: 'Share',
                    desc: 'Share with other authorized providers',
                    icon: ExternalLink,
                    enabled: canShare,
                    toggle: setCanShare,
                  },
                ].map((perm) => (
                  <button
                    key={perm.key}
                    onClick={() => perm.toggle(!perm.enabled)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-colors text-left ${
                      perm.enabled
                        ? 'border-emerald-300 bg-emerald-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        perm.enabled
                          ? 'bg-emerald-100 text-emerald-600'
                          : 'bg-slate-100 text-slate-400'
                      }`}
                    >
                      <perm.icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-900">{perm.label}</p>
                      <p className="text-xs text-slate-500">{perm.desc}</p>
                    </div>
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        perm.enabled ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300'
                      }`}
                    >
                      {perm.enabled && <CheckCircle className="w-3 h-3 text-white" />}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Duration */}
            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">Duration</label>
              <div className="flex flex-wrap gap-2">
                {DURATION_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setDuration(opt.value)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                      duration === opt.value
                        ? 'bg-brand-500 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {duration === 'custom' && (
                <div className="mt-3 relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="date"
                    value={customExpiry}
                    onChange={(e) => setCustomExpiry(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  />
                </div>
              )}
            </div>

            {/* Navigation */}
            <div className="flex justify-between pt-2">
              <button
                onClick={() => setStep('provider')}
                className="px-5 py-2.5 border border-slate-200 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors flex items-center gap-2"
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </button>
              <button
                onClick={goToReview}
                className="px-5 py-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-sm font-medium transition-colors flex items-center gap-2"
              >
                Review
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </>
        )}

        {/* ─── Review Step ─── */}
        {step === 'review' && (
          <>
            <div className="bg-slate-50 rounded-xl p-5 space-y-4">
              <h4 className="text-sm font-semibold text-slate-900">Access Grant Summary</h4>

              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b border-slate-200">
                  <span className="text-sm text-slate-500">Provider</span>
                  <span className="text-sm font-medium text-slate-900">
                    {selectedProvider || 'Custom Address'}
                  </span>
                </div>
                <div className="flex items-start justify-between py-2 border-b border-slate-200">
                  <span className="text-sm text-slate-500">Address</span>
                  <span className="text-xs font-mono text-slate-700 max-w-[200px] break-all text-right">
                    {providerAddress}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-slate-200">
                  <span className="text-sm text-slate-500">Data Scope</span>
                  <Badge variant="info">{scope}</Badge>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-slate-200">
                  <span className="text-sm text-slate-500">Permissions</span>
                  <div className="flex gap-1.5">
                    {canView && <Badge variant="success">View</Badge>}
                    {canDownload && <Badge variant="success">Download</Badge>}
                    {canShare && <Badge variant="success">Share</Badge>}
                  </div>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-slate-500">Expires</span>
                  <span className="text-sm font-medium text-slate-900">{expiryDate}</span>
                </div>
              </div>
            </div>

            {/* Blockchain notice */}
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2">
              <Link2 className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-700">
                This action will submit a transaction to the Aethelred blockchain. The access grant
                will be enforced by TEE smart contracts and cannot be modified without a new
                transaction.
              </p>
            </div>

            {/* Navigation */}
            <div className="flex justify-between pt-2">
              <button
                onClick={() => setStep('permissions')}
                className="px-5 py-2.5 border border-slate-200 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors flex items-center gap-2"
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </button>
              <button
                onClick={submitGrant}
                className="px-5 py-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-sm font-medium transition-colors flex items-center gap-2"
              >
                <Shield className="w-4 h-4" />
                Grant Access
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
