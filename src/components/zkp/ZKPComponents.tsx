'use client';

import React from 'react';
import {
  Shield, ShieldCheck, ShieldX, Loader2, Lock,
  CheckCircle, XCircle, Clock, Hash, Layers,
  Eye, EyeOff, Fingerprint, Brain, Heart,
  Pill, BarChart3, UserCheck, Calendar,
  AlertTriangle, Zap,
} from 'lucide-react';

import type { ZKClaim, ZKClaimType, ZKProof } from '@/types';
import { MedicalCard } from '@/components/ui/PagePrimitives';
import { Badge } from '@/components/ui/SharedComponents';
import { formatDateTime, timeAgo, truncateAddress } from '@/lib/utils';

// ============================================================
// Shared Helpers
// ============================================================

const CLAIM_TYPE_ICONS: Record<ZKClaimType, React.ReactNode> = {
  age_range: <Calendar className="w-4 h-4" />,
  condition_present: <AlertTriangle className="w-4 h-4" />,
  medication_active: <Pill className="w-4 h-4" />,
  data_quality: <BarChart3 className="w-4 h-4" />,
  provider_verified: <UserCheck className="w-4 h-4" />,
  fertility_window: <Heart className="w-4 h-4" />,
};

const CLAIM_TYPE_LABELS: Record<ZKClaimType, string> = {
  age_range: 'Age Range',
  condition_present: 'Condition Present',
  medication_active: 'Medication Active',
  data_quality: 'Data Quality',
  provider_verified: 'Provider Verified',
  fertility_window: 'Fertility Window',
};

const CLAIM_TYPE_EXPLAINERS: Record<ZKClaimType, { proves: string; hides: string }> = {
  age_range: {
    proves: 'Proves you are between 25-35 years old',
    hides: 'Without revealing your exact date of birth',
  },
  condition_present: {
    proves: 'Proves a medical condition exists in your records',
    hides: 'Without revealing which specific condition',
  },
  medication_active: {
    proves: 'Proves you are on an active medication',
    hides: 'Without revealing the specific medication or dosage',
  },
  data_quality: {
    proves: 'Proves your health data meets quality thresholds',
    hides: 'Without revealing the actual health data values',
  },
  provider_verified: {
    proves: 'Proves you have been verified by a licensed provider',
    hides: 'Without revealing provider identity or visit details',
  },
  fertility_window: {
    proves: 'Proves you are within a predicted fertile window',
    hides: 'Without revealing your cycle data or predictions',
  },
};

const STATUS_CONFIG: Record<string, { badge: 'success' | 'warning' | 'error' | 'info' | 'neutral'; label: string }> = {
  verified: { badge: 'success', label: 'Verified' },
  proving: { badge: 'info', label: 'Proving' },
  unproven: { badge: 'neutral', label: 'Unproven' },
  expired: { badge: 'warning', label: 'Expired' },
  failed: { badge: 'error', label: 'Failed' },
};

// ============================================================
// ProofGenerator
// ============================================================

interface ProofGeneratorProps {
  claimType: ZKClaimType;
  onGenerate: () => void;
  isLoading: boolean;
}

export function ProofGenerator({ claimType, onGenerate, isLoading }: ProofGeneratorProps) {
  const estimatedGas = {
    age_range: '~85,000',
    condition_present: '~120,000',
    medication_active: '~95,000',
    data_quality: '~72,000',
    provider_verified: '~105,000',
    fertility_window: '~110,000',
  }[claimType] ??
    /* istanbul ignore next -- claimType always found in gas map */
    '~100,000';

  return (
    <MedicalCard>
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center text-violet-600">
          {CLAIM_TYPE_ICONS[claimType]}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-slate-900">
            {CLAIM_TYPE_LABELS[claimType]}
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {CLAIM_TYPE_EXPLAINERS[claimType].proves}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4 p-3 bg-slate-50 rounded-xl">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Zap className="w-3.5 h-3.5" />
          <span>Estimated Gas: {estimatedGas}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Clock className="w-3.5 h-3.5" />
          <span>~15-30s</span>
        </div>
      </div>

      <button
        onClick={onGenerate}
        disabled={isLoading}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-violet-600 rounded-xl hover:bg-violet-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Generating Proof...
          </>
        ) : (
          <>
            <Fingerprint className="w-4 h-4" />
            Generate Proof
          </>
        )}
      </button>
    </MedicalCard>
  );
}

// ============================================================
// ProofVerifier
// ============================================================

interface ProofVerifierProps {
  proof: ZKProof;
}

export function ProofVerifier({ proof }: ProofVerifierProps) {
  const isVerified = proof.verified;
  const isPending = !proof.verified && !proof.txHash;

  return (
    <MedicalCard>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          {isVerified ? (
            <ShieldCheck className="w-5 h-5 text-emerald-500" />
          ) : isPending ? (
            <Loader2 className="w-5 h-5 text-brand-500 animate-spin" />
          ) : (
            <ShieldX className="w-5 h-5 text-red-500" />
          )}
          <h3 className="text-sm font-semibold text-slate-900">
            {CLAIM_TYPE_LABELS[proof.claimType]}
          </h3>
        </div>
        <Badge variant={isVerified ? 'success' : isPending ? 'info' : 'error'} dot>
          {isVerified ? 'Verified' : isPending ? 'Pending' : 'Failed'}
        </Badge>
      </div>

      <div className="space-y-2 mb-3">
        <div className="flex items-center gap-2 text-xs">
          <Hash className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-500">Proof Hash:</span>
          <span className="font-mono text-slate-700">{truncateAddress(proof.proofHash, 10, 6)}</span>
        </div>
        <div className="flex items-start gap-2 text-xs">
          <Eye className="w-3.5 h-3.5 text-slate-400 mt-0.5" />
          <span className="text-slate-500 shrink-0">Public Inputs:</span>
          <span className="font-mono text-slate-700">{proof.publicInputs}</span>
        </div>
        {isVerified && proof.verifiedAt && (
          <div className="flex items-center gap-2 text-xs">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
            <span className="text-slate-500">Verified:</span>
            <span className="text-slate-700">{formatDateTime(proof.verifiedAt)}</span>
          </div>
        )}
        {proof.txHash && (
          <div className="flex items-center gap-2 text-xs">
            <Layers className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-500">Tx:</span>
            <span className="font-mono text-slate-700">{truncateAddress(proof.txHash, 10, 6)}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 text-2xs text-slate-400">
        <Clock className="w-3 h-3" />
        <span>Created {timeAgo(proof.createdAt)}</span>
        {proof.expiresAt && (
          <>
            <span className="text-slate-300">|</span>
            <span>Expires {formatDateTime(proof.expiresAt)}</span>
          </>
        )}
      </div>
    </MedicalCard>
  );
}

// ============================================================
// ClaimBadge
// ============================================================

interface ClaimBadgeProps {
  claim: ZKClaim;
}

export function ClaimBadge({ claim }: ClaimBadgeProps) {
  const statusCfg = STATUS_CONFIG[claim.status] ?? STATUS_CONFIG.unproven;

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white border border-slate-200 text-xs">
      <span className="text-violet-600">
        {CLAIM_TYPE_ICONS[claim.claimType]}
      </span>
      <span className="font-medium text-slate-700">
        {CLAIM_TYPE_LABELS[claim.claimType]}
      </span>
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          claim.status === 'verified' ? 'bg-emerald-500' :
          claim.status === 'proving' ? 'bg-brand-500 animate-pulse' :
          claim.status === 'failed' ? 'bg-red-500' :
          claim.status === 'expired' ? 'bg-amber-500' :
          'bg-slate-400'
        }`}
      />
    </span>
  );
}

// ============================================================
// ZKPExplainer
// ============================================================

interface ZKPExplainerProps {
  claimType: ZKClaimType;
}

export function ZKPExplainer({ claimType }: ZKPExplainerProps) {
  const explainer = CLAIM_TYPE_EXPLAINERS[claimType];

  return (
    <MedicalCard>
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center text-violet-600 shrink-0">
          <Lock className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-slate-900 mb-2">
            How This ZK Proof Works
          </h3>

          <div className="space-y-3">
            <div className="flex items-start gap-2">
              <div className="w-6 h-6 rounded-full bg-emerald-50 flex items-center justify-center shrink-0 mt-0.5">
                <Eye className="w-3.5 h-3.5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs font-medium text-emerald-700">What it proves</p>
                <p className="text-xs text-slate-600">{explainer.proves}</p>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <div className="w-6 h-6 rounded-full bg-rose-50 flex items-center justify-center shrink-0 mt-0.5">
                <EyeOff className="w-3.5 h-3.5 text-rose-600" />
              </div>
              <div>
                <p className="text-xs font-medium text-rose-700">What remains private</p>
                <p className="text-xs text-slate-600">{explainer.hides}</p>
              </div>
            </div>
          </div>

          <div className="mt-3 p-2.5 bg-slate-50 rounded-lg">
            <div className="flex items-start gap-2">
              <Shield className="w-3.5 h-3.5 text-brand-600 mt-0.5 shrink-0" />
              <p className="text-2xs text-slate-500">
                ZK proofs are generated inside a TEE enclave and verified on the Aethelred blockchain.
                Your private data never leaves the enclave.
              </p>
            </div>
          </div>
        </div>
      </div>
    </MedicalCard>
  );
}

// ============================================================
// ZKPDashboard
// ============================================================

interface ZKPDashboardProps {
  claims: ZKClaim[];
  proofs: ZKProof[];
}

export function ZKPDashboard({ claims, proofs }: ZKPDashboardProps) {
  const verifiedCount = claims.filter((c) => c.status === 'verified').length;
  const pendingCount = claims.filter((c) => c.status === 'proving').length;
  const expiredCount = claims.filter((c) => c.status === 'expired').length;

  // Claim type breakdown
  const typeBreakdown = claims.reduce<Record<string, number>>((acc, c) => {
    acc[c.claimType] = (acc[c.claimType] ?? 0) + 1;
    return acc;
  }, {});

  // Recent proofs
  const recentProofs = proofs.slice(0, 5);

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <MedicalCard>
        <h3 className="text-sm font-semibold text-slate-900 mb-4">ZKP Summary</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-3 bg-emerald-50 rounded-xl">
            <p className="text-2xl font-bold text-emerald-700">{verifiedCount}</p>
            <p className="text-xs text-emerald-600">Verified</p>
          </div>
          <div className="text-center p-3 bg-brand-50 rounded-xl">
            <p className="text-2xl font-bold text-brand-700">{pendingCount}</p>
            <p className="text-xs text-brand-600">Pending</p>
          </div>
          <div className="text-center p-3 bg-amber-50 rounded-xl">
            <p className="text-2xl font-bold text-amber-700">{expiredCount}</p>
            <p className="text-xs text-amber-600">Expired</p>
          </div>
        </div>
      </MedicalCard>

      {/* Claim Type Breakdown */}
      <MedicalCard>
        <h3 className="text-sm font-semibold text-slate-900 mb-3">Claims by Type</h3>
        <div className="space-y-2">
          {Object.entries(typeBreakdown).map(([type, count]) => (
            <div key={type} className="flex items-center justify-between py-1.5">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-violet-600">
                  {CLAIM_TYPE_ICONS[type as ZKClaimType]}
                </span>
                <span className="text-slate-700">
                  {CLAIM_TYPE_LABELS[type as ZKClaimType] ??
                    /* istanbul ignore next -- type always in CLAIM_TYPE_LABELS */
                    type}
                </span>
              </div>
              <Badge variant="neutral">{count}</Badge>
            </div>
          ))}
        </div>
      </MedicalCard>

      {/* Recent Proofs */}
      <MedicalCard>
        <h3 className="text-sm font-semibold text-slate-900 mb-3">Recent Proofs</h3>
        <div className="space-y-3">
          {recentProofs.map((proof) => (
            <div key={proof.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
              <div className="flex items-center gap-2">
                {proof.verified ? (
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                ) : (
                  <Clock className="w-4 h-4 text-brand-500" />
                )}
                <div>
                  <p className="text-xs font-medium text-slate-700">
                    {CLAIM_TYPE_LABELS[proof.claimType]}
                  </p>
                  <p className="text-2xs text-slate-400">
                    {timeAgo(proof.createdAt)}
                  </p>
                </div>
              </div>
              <Badge variant={proof.verified ? 'success' : 'info'}>
                {proof.verified ? 'Verified' : 'Pending'}
              </Badge>
            </div>
          ))}
        </div>
      </MedicalCard>
    </div>
  );
}
