/**
 * Shiora on Aethelred — Consent Tab Component
 *
 * Self-contained consent management tab to be embedded
 * in the Access Control page. Uses the useConsentManagement hook
 * and renders stats, filters, consent cards, and the create modal.
 */

'use client';

import React, { useState } from 'react';
import {
  ShieldCheck, ShieldOff, Clock, AlertTriangle,
  Plus, Search, ChevronDown, Loader2, History,
  Filter,
} from 'lucide-react';

import type { ConsentScope, ConsentStatus, ConsentGrant } from '@/types';
import { useConsentManagement } from '@/hooks/useConsentManagement';
import { CONSENT_SCOPES } from '@/lib/constants';
import { MedicalCard } from '@/components/ui/PagePrimitives';
import { ConfirmDialog } from '@/components/ui/SharedComponents';
import {
  ConsentCard,
  ConsentTimeline,
  CreateConsentModal,
  SmartContractStatus,
} from '@/components/consent/ConsentComponents';

// ============================================================
// Scope filter label helper
// ============================================================

function getScopeLabel(scopeId: string): string {
  return CONSENT_SCOPES.find((s) => s.id === scopeId)?.label ??
    /* istanbul ignore next -- scope always found for known scope IDs */
    scopeId;
}

// ============================================================
// ConsentTab — Main component
// ============================================================

export default function ConsentTab() {
  const {
    consents,
    total,
    isLoading,
    error,
    policies,
    auditLog,
    isLoadingAudit,
    statusFilter,
    setStatusFilter,
    scopeFilter,
    setScopeFilter,
    searchQuery,
    setSearchQuery,
    createConsent,
    revokeConsent,
    modifyConsent,
    activeCount,
    expiredCount,
    revokedCount,
    pendingCount,
    refetch,
  } = useConsentManagement();

  // Modal state
  const [createOpen, setCreateOpen] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<string | null>(null);
  const [selectedConsent, setSelectedConsent] = useState<ConsentGrant | null>(null);
  const [showTimeline, setShowTimeline] = useState(false);

  // Status filter dropdown
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [scopeDropdownOpen, setScopeDropdownOpen] = useState(false);

  const statusOptions: { value: ConsentStatus | undefined; label: string }[] = [
    { value: undefined, label: 'All Statuses' },
    { value: 'active', label: 'Active' },
    { value: 'pending', label: 'Pending' },
    { value: 'expired', label: 'Expired' },
    { value: 'revoked', label: 'Revoked' },
  ];

  const scopeOptions: { value: ConsentScope | undefined; label: string }[] = [
    { value: undefined, label: 'All Scopes' },
    ...CONSENT_SCOPES.map((s) => ({ value: s.id as ConsentScope, label: s.label })),
  ];

  const handleRevoke = () => {
    if (revokeTarget) {
      revokeConsent.mutate(revokeTarget);
      setRevokeTarget(null);
    }
  };

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayMs = todayStart.getTime();
  const tomorrowMs = todayMs + 86400000;

  const expiredToday = consents.filter(
    (c) => c.status === 'expired' && c.expiresAt >= todayMs && c.expiresAt < tomorrowMs,
  ).length;

  const revokedToday = consents.filter(
    (c) => c.status === 'revoked' && c.revokedAt && c.revokedAt >= todayMs && c.revokedAt < tomorrowMs,
  ).length;

  return (
    <div className="space-y-6">
      {/* ─── Stats Bar ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MedicalCard>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Active Consents</p>
              <p className="text-xl font-bold text-slate-900">{activeCount}</p>
            </div>
          </div>
        </MedicalCard>
        <MedicalCard>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Pending</p>
              <p className="text-xl font-bold text-slate-900">{pendingCount}</p>
            </div>
          </div>
        </MedicalCard>
        <MedicalCard>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-slate-500" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Expired Today</p>
              <p className="text-xl font-bold text-slate-900">{expiredToday}</p>
            </div>
          </div>
        </MedicalCard>
        <MedicalCard>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
              <ShieldOff className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Revoked Today</p>
              <p className="text-xl font-bold text-slate-900">{revokedToday}</p>
            </div>
          </div>
        </MedicalCard>
      </div>

      {/* ─── Filter Bar ─── */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {/* Status filter dropdown */}
          <div className="relative">
            <button
              onClick={() => { setStatusDropdownOpen(!statusDropdownOpen); setScopeDropdownOpen(false); }}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white hover:bg-slate-50 transition-colors"
            >
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              {statusFilter ? statusOptions.find((o) => o.value === statusFilter)?.label : 'All Statuses'}
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>
            {statusDropdownOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setStatusDropdownOpen(false)} />
                <div className="absolute left-0 top-full mt-1 z-20 bg-white border border-slate-200 rounded-xl shadow-lg py-1 w-44">
                  {statusOptions.map((opt) => (
                    <button
                      key={opt.label}
                      onClick={() => { setStatusFilter(opt.value); setStatusDropdownOpen(false); }}
                      className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                        statusFilter === opt.value
                          ? 'bg-brand-50 text-brand-700'
                          : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Scope filter dropdown */}
          <div className="relative">
            <button
              onClick={() => { setScopeDropdownOpen(!scopeDropdownOpen); setStatusDropdownOpen(false); }}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white hover:bg-slate-50 transition-colors"
            >
              {scopeFilter ? getScopeLabel(scopeFilter) : 'All Scopes'}
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>
            {scopeDropdownOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setScopeDropdownOpen(false)} />
                <div className="absolute left-0 top-full mt-1 z-20 bg-white border border-slate-200 rounded-xl shadow-lg py-1 w-48 max-h-60 overflow-y-auto">
                  {scopeOptions.map((opt) => (
                    <button
                      key={opt.label}
                      onClick={() => { setScopeFilter(opt.value); setScopeDropdownOpen(false); }}
                      className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                        scopeFilter === opt.value
                          ? 'bg-brand-50 text-brand-700'
                          : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search providers..."
              className="pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-brand-500 focus:border-transparent w-56"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowTimeline(!showTimeline)}
            className={`inline-flex items-center gap-2 px-3 py-2 text-sm font-medium border rounded-xl transition-colors ${
              showTimeline
                ? 'bg-brand-50 border-brand-200 text-brand-700'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <History className="w-4 h-4" />
            Timeline
          </button>
          <button
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-brand-500 text-white rounded-xl font-medium text-sm hover:bg-brand-600 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            New Consent
          </button>
        </div>
      </div>

      {/* ─── Content ─── */}
      {showTimeline ? (
        /* Audit Timeline */
        <MedicalCard>
          <h3 className="text-sm font-semibold text-slate-900 mb-4">Consent Audit Timeline</h3>
          {isLoadingAudit ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
            </div>
          ) : (
            <ConsentTimeline auditEntries={auditLog} />
          )}
        </MedicalCard>
      ) : (
        /* Consent Cards Grid */
        <>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
            </div>
          ) : error ? (
            <div className="py-12 text-center">
              <AlertTriangle className="w-12 h-12 text-red-300 mx-auto mb-3" />
              <p className="text-sm text-red-500">Failed to load consents</p>
            </div>
          ) : consents.length === 0 ? (
            <div className="py-12 text-center">
              <ShieldCheck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-500">No consent grants match your filters</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {consents.map((consent) => (
                <ConsentCard
                  key={consent.id}
                  consent={consent}
                  onRevoke={() => setRevokeTarget(consent.id)}
                  onModify={() => setSelectedConsent(consent)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* ─── Create Modal ─── */}
      <CreateConsentModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={(form) => createConsent.mutate(form)}
        policies={policies}
        isLoading={createConsent.isLoading}
      />

      {/* ─── Revoke Confirmation ─── */}
      <ConfirmDialog
        open={revokeTarget !== null}
        onClose={() => setRevokeTarget(null)}
        onConfirm={handleRevoke}
        title="Revoke Consent"
        description="This will permanently revoke the provider's access. This action is recorded on the blockchain and cannot be undone."
        confirmLabel="Revoke"
        cancelLabel="Keep Active"
        variant="danger"
      />
    </div>
  );
}
