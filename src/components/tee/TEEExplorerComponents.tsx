'use client';

import React, { useState } from 'react';
import {
  Cpu,
  Shield,
  ShieldCheck,
  Server,
  Cloud,
  ChevronRight,
  ChevronDown,
  Clock,
  Zap,
  CheckCircle,
  XCircle,
  ArrowRight,
  Eye,
  Hash,
  Lock,
  Fingerprint,
  Network,
} from 'lucide-react';

import { MedicalCard, TruncatedHash, TEEBadge, StatusBadge } from '@/components/ui/PagePrimitives';
import { Badge } from '@/components/ui/SharedComponents';
import { BRAND, TEE_ENCLAVE_TYPES, COMPUTE_JOB_STATES } from '@/lib/constants';
import { formatNumber, timeAgo, formatDateTime, seededHex } from '@/lib/utils';
import type { TEEVerificationChain, TEEComputeJob, TEEEnclaveInfo, TEEPlatform } from '@/types';

// ============================================================
// Platform Icon Mapping
// ============================================================

const PLATFORM_ICONS: Record<string, React.ReactNode> = {
  'Intel SGX': <Cpu className="w-5 h-5 text-blue-600" />,
  'AWS Nitro': <Cloud className="w-5 h-5 text-orange-500" />,
  'AMD SEV': <Server className="w-5 h-5 text-red-600" />,
};

function getPlatformIcon(platform: TEEPlatform): React.ReactNode {
  return PLATFORM_ICONS[platform] || <Cpu className="w-5 h-5 text-slate-500" />;
}

// ============================================================
// AttestationRow — Expandable table row for attestations
// ============================================================

interface AttestationRowProps {
  attestation: TEEVerificationChain;
  index: number;
}

export function AttestationRow({ attestation, index }: AttestationRowProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <tr
        className={`border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors ${
          index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
        }`}
        onClick={() => setExpanded(!expanded)}
      >
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            {expanded ? (
              <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
            ) : (
              <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
            )}
            <TruncatedHash hash={attestation.attestationHash} startLen={8} endLen={6} />
          </div>
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            {getPlatformIcon(attestation.platform)}
            <span className="text-sm text-slate-700">{attestation.platform}</span>
          </div>
        </td>
        <td className="px-4 py-3 text-sm text-slate-600">{attestation.modelId}</td>
        <td className="px-4 py-3">
          {attestation.verifiedOnChain ? (
            <Badge variant="success" dot>
              Verified
            </Badge>
          ) : (
            <Badge variant="warning" dot>
              Pending
            </Badge>
          )}
        </td>
        <td className="px-4 py-3 text-sm font-mono text-slate-600">
          {formatNumber(attestation.blockHeight)}
        </td>
        <td className="px-4 py-3 text-sm text-slate-500">{timeAgo(attestation.timestamp)}</td>
      </tr>
      {expanded && (
        <tr className="bg-slate-50 border-b border-slate-200">
          <td colSpan={6} className="px-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="space-y-2">
                <div>
                  <span className="text-slate-500 font-medium">Measurement Hash</span>
                  <div className="mt-0.5">
                    <TruncatedHash hash={attestation.measurementHash} startLen={12} endLen={8} />
                  </div>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Input Hash</span>
                  <div className="mt-0.5">
                    <TruncatedHash hash={attestation.inputHash} startLen={12} endLen={8} />
                  </div>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Output Hash</span>
                  <div className="mt-0.5">
                    <TruncatedHash hash={attestation.outputHash} startLen={12} endLen={8} />
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <div>
                  <span className="text-slate-500 font-medium">Nonce</span>
                  <div className="mt-0.5">
                    <TruncatedHash hash={attestation.nonce} startLen={12} endLen={8} />
                  </div>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">PCR Values</span>
                  <div className="mt-0.5 space-y-1">
                    {attestation.pcrValues.map((pcr, i) => (
                      <div key={i} className="flex items-center gap-1">
                        <span className="text-slate-400">PCR[{i}]:</span>
                        <TruncatedHash hash={pcr} startLen={10} endLen={6} />
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Signature</span>
                  <div className="mt-0.5">
                    <TruncatedHash hash={attestation.signature} startLen={12} endLen={8} />
                  </div>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Transaction</span>
                  <div className="mt-0.5">
                    <TruncatedHash hash={attestation.txHash} startLen={12} endLen={8} />
                  </div>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ============================================================
// ComputeJobRow — Table row with status badge
// ============================================================

interface ComputeJobRowProps {
  job: TEEComputeJob;
  index: number;
}

const JOB_STATUS_VARIANT: Record<string, 'success' | 'error' | 'warning' | 'info' | 'neutral'> = {
  completed: 'success',
  running: 'info',
  queued: 'neutral',
  failed: 'error',
  cancelled: 'neutral',
};

const PRIORITY_VARIANT: Record<
  string,
  'success' | 'error' | 'warning' | 'info' | 'neutral' | 'brand'
> = {
  low: 'neutral',
  normal: 'info',
  high: 'warning',
  critical: 'error',
};

export function ComputeJobRow({ job, index }: ComputeJobRowProps) {
  return (
    <tr
      className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${
        index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
      }`}
    >
      <td className="px-4 py-3">
        <span className="text-sm font-mono text-slate-700">{job.id}</span>
      </td>
      <td className="px-4 py-3 text-sm text-slate-700">{job.modelName}</td>
      <td className="px-4 py-3">
        <span className="text-xs font-mono text-slate-500">{job.enclaveId}</span>
      </td>
      <td className="px-4 py-3">
        <Badge variant={JOB_STATUS_VARIANT[job.status] ?? 'neutral'} dot>
          {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
        </Badge>
      </td>
      <td className="px-4 py-3 text-sm text-slate-600">
        {job.executionTimeMs < 1000
          ? `${job.executionTimeMs}ms`
          : `${(job.executionTimeMs / 1000).toFixed(2)}s`}
      </td>
      <td className="px-4 py-3 text-sm font-mono text-slate-600">{job.gasCost.toFixed(4)} AETH</td>
      <td className="px-4 py-3">
        <Badge variant={PRIORITY_VARIANT[job.priority] ?? 'neutral'}>
          {job.priority.charAt(0).toUpperCase() + job.priority.slice(1)}
        </Badge>
      </td>
    </tr>
  );
}

// ============================================================
// EnclaveCard — Grid card with stats and progress bar
// ============================================================

interface EnclaveCardProps {
  enclave: TEEEnclaveInfo;
}

const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  operational: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  degraded: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  offline: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
};

export function EnclaveCard({ enclave }: EnclaveCardProps) {
  const statusStyle = STATUS_COLORS[enclave.status] ?? STATUS_COLORS.operational;

  return (
    <MedicalCard className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
            {getPlatformIcon(enclave.platform)}
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">{enclave.id}</p>
            <p className="text-xs text-slate-500">{enclave.platform}</p>
          </div>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${statusStyle.bg} ${statusStyle.text}`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${statusStyle.dot} ${enclave.status === 'operational' ? 'animate-pulse' : ''}`}
          />
          {enclave.status.charAt(0).toUpperCase() + enclave.status.slice(1)}
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <span className="text-slate-500">Firmware</span>
          <p className="font-mono text-slate-700">{enclave.firmwareVersion}</p>
        </div>
        <div>
          <span className="text-slate-500">Region</span>
          <p className="text-slate-700">{enclave.region}</p>
        </div>
        <div>
          <span className="text-slate-500">Uptime</span>
          <p className="text-slate-700 font-medium">{enclave.uptime.toFixed(1)}%</p>
        </div>
        <div>
          <span className="text-slate-500">Jobs Processed</span>
          <p className="text-slate-700 font-medium">{formatNumber(enclave.jobsProcessed)}</p>
        </div>
      </div>

      {/* Trust Score Progress Bar */}
      <div>
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-slate-500">Trust Score</span>
          <span className="font-medium text-slate-700">{enclave.trustScore.toFixed(1)}/100</span>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-2">
          <div
            className="h-2 rounded-full transition-all duration-500"
            style={{
              width: `${Math.min(enclave.trustScore, 100)}%`,
              backgroundColor:
                enclave.trustScore >= 95
                  ? '#10b981'
                  : enclave.trustScore >= 90
                    ? '#C9A227'
                    : '#f43f5e',
            }}
          />
        </div>
      </div>

      {/* Last Attestation */}
      <div className="flex items-center gap-1.5 text-xs text-slate-500 pt-1 border-t border-slate-100">
        <Clock className="w-3.5 h-3.5" />
        <span>Last attestation: {timeAgo(enclave.lastAttestationAt)}</span>
      </div>
    </MedicalCard>
  );
}

// ============================================================
// VerificationPipeline — 5-step connected visualization
// ============================================================

interface PipelineStep {
  label: string;
  icon: React.ReactNode;
  hash: string;
  timestamp: string;
  completed: boolean;
}

interface VerificationPipelineProps {
  seed: number;
}

export function VerificationPipeline({ seed }: VerificationPipelineProps) {
  const steps: PipelineStep[] = [
    {
      label: 'Request Submitted',
      icon: <Hash className="w-5 h-5" />,
      hash: `0x${seededHex(seed, 16)}`,
      timestamp: '2.3s ago',
      completed: true,
    },
    {
      label: 'Enclave Selected',
      icon: <Cpu className="w-5 h-5" />,
      hash: `enc-${seededHex(seed + 100, 8)}`,
      timestamp: '2.1s ago',
      completed: true,
    },
    {
      label: 'Measurement Computed',
      icon: <Fingerprint className="w-5 h-5" />,
      hash: `0x${seededHex(seed + 200, 16)}`,
      timestamp: '1.4s ago',
      completed: true,
    },
    {
      label: 'Remote Attestation',
      icon: <ShieldCheck className="w-5 h-5" />,
      hash: `0x${seededHex(seed + 300, 16)}`,
      timestamp: '0.8s ago',
      completed: true,
    },
    {
      label: 'On-chain Anchor',
      icon: <Lock className="w-5 h-5" />,
      hash: `0x${seededHex(seed + 400, 16)}`,
      timestamp: '0.2s ago',
      completed: true,
    },
  ];

  return (
    <div className="relative">
      {/* Desktop: horizontal pipeline */}
      <div className="hidden md:flex items-start justify-between gap-2">
        {steps.map((step, i) => (
          <React.Fragment key={i}>
            <div className="flex flex-col items-center text-center flex-1">
              <div
                className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-3 transition-colors ${
                  step.completed
                    ? 'bg-brand-50 text-brand-600 ring-2 ring-brand-200'
                    : /* istanbul ignore next -- all steps are completed */
                      'bg-slate-100 text-slate-400 ring-2 ring-slate-200'
                }`}
              >
                {step.icon}
              </div>
              <p className="text-sm font-medium text-slate-900 mb-1">{step.label}</p>
              <p className="font-mono text-[10px] text-slate-500 break-all max-w-[120px]">
                {step.hash}
              </p>
              <p className="text-[10px] text-slate-400 mt-1">{step.timestamp}</p>
            </div>
            {i < steps.length - 1 && (
              <div className="flex items-center pt-6 shrink-0">
                <ArrowRight className="w-5 h-5 text-brand-400" />
              </div>
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Mobile: vertical pipeline */}
      <div className="md:hidden space-y-0">
        {steps.map((step, i) => (
          <div key={i} className="flex gap-4">
            {/* Line connector */}
            <div className="flex flex-col items-center">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  step.completed
                    ? 'bg-brand-50 text-brand-600 ring-2 ring-brand-200'
                    : /* istanbul ignore next -- all steps are completed */
                      'bg-slate-100 text-slate-400 ring-2 ring-slate-200'
                }`}
              >
                {step.icon}
              </div>
              {i < steps.length - 1 && <div className="w-0.5 h-8 bg-brand-200 my-1" />}
            </div>
            {/* Content */}
            <div className="pb-6">
              <p className="text-sm font-medium text-slate-900">{step.label}</p>
              <p className="font-mono text-[10px] text-slate-500 mt-0.5">{step.hash}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">{step.timestamp}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// RecentVerificationChains — 5 expandable chain entries
// ============================================================

interface RecentVerificationChainsProps {
  attestations: TEEVerificationChain[];
}

export function RecentVerificationChains({ attestations }: RecentVerificationChainsProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const recent = attestations.slice(0, 5);

  if (recent.length === 0) {
    return (
      <div className="text-center py-8 text-slate-400">
        <ShieldCheck className="w-10 h-10 mx-auto mb-2 opacity-40" />
        <p className="text-sm">No recent verification chains</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {recent.map((att) => {
        const isExpanded = expandedId === att.id;
        return (
          <div
            key={att.id}
            className="rounded-xl border border-slate-200 bg-white overflow-hidden transition-shadow hover:shadow-sm"
          >
            {/* Summary row */}
            <button
              type="button"
              className="w-full flex items-center gap-4 px-4 py-3 text-left"
              onClick={() => setExpandedId(isExpanded ? null : att.id)}
            >
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                  att.verifiedOnChain
                    ? 'bg-emerald-50 text-emerald-600'
                    : 'bg-amber-50 text-amber-600'
                }`}
              >
                {att.verifiedOnChain ? (
                  <CheckCircle className="w-4.5 h-4.5" />
                ) : (
                  <Clock className="w-4.5 h-4.5" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-900 truncate">{att.id}</span>
                  <Badge variant={att.verifiedOnChain ? 'success' : 'warning'} dot>
                    {att.verifiedOnChain ? 'Anchored' : 'Pending'}
                  </Badge>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                  <span className="flex items-center gap-1">
                    {getPlatformIcon(att.platform)}
                    {att.platform}
                  </span>
                  <span>Block #{formatNumber(att.blockHeight)}</span>
                  <span>{timeAgo(att.timestamp)}</span>
                </div>
              </div>
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
              ) : (
                <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
              )}
            </button>

            {/* Expanded details */}
            {isExpanded && (
              <div className="px-4 pb-4 pt-1 border-t border-slate-100">
                {/* Mini pipeline visualization */}
                <div className="flex items-center gap-1 mb-4 py-2 px-3 bg-slate-50 rounded-lg overflow-x-auto">
                  {['Request', 'Enclave', 'Measurement', 'Attestation', 'On-chain'].map(
                    (step, i) => (
                      <React.Fragment key={step}>
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-brand-50 text-brand-700 text-[10px] font-medium whitespace-nowrap">
                          <CheckCircle className="w-3 h-3" />
                          {step}
                        </span>
                        {i < 4 && <ArrowRight className="w-3 h-3 text-brand-300 shrink-0" />}
                      </React.Fragment>
                    ),
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="space-y-2.5">
                    <div>
                      <span className="text-slate-500 font-medium">Attestation Hash</span>
                      <div className="mt-0.5">
                        <TruncatedHash hash={att.attestationHash} startLen={14} endLen={8} />
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-500 font-medium">Measurement Hash</span>
                      <div className="mt-0.5">
                        <TruncatedHash hash={att.measurementHash} startLen={14} endLen={8} />
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-500 font-medium">Input Hash</span>
                      <div className="mt-0.5">
                        <TruncatedHash hash={att.inputHash} startLen={14} endLen={8} />
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-500 font-medium">Output Hash</span>
                      <div className="mt-0.5">
                        <TruncatedHash hash={att.outputHash} startLen={14} endLen={8} />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2.5">
                    <div>
                      <span className="text-slate-500 font-medium">Nonce</span>
                      <div className="mt-0.5">
                        <TruncatedHash hash={att.nonce} startLen={14} endLen={8} />
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-500 font-medium">Signature</span>
                      <div className="mt-0.5">
                        <TruncatedHash hash={att.signature} startLen={14} endLen={8} />
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-500 font-medium">PCR Values</span>
                      <div className="mt-0.5 space-y-1">
                        {att.pcrValues.map((pcr, i) => (
                          <div key={i} className="flex items-center gap-1">
                            <span className="text-slate-400">PCR[{i}]:</span>
                            <TruncatedHash hash={pcr} startLen={10} endLen={6} />
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-500 font-medium">Transaction</span>
                      <div className="mt-0.5">
                        <TruncatedHash hash={att.txHash} startLen={14} endLen={8} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// PlatformDistribution — Pie chart legend wrapper
// ============================================================

interface PlatformDistributionProps {
  data: { platform: TEEPlatform; count: number; percentage: number }[];
  colors: readonly string[];
}

export function PlatformDistribution({ data, colors }: PlatformDistributionProps) {
  return (
    <div className="space-y-3">
      {data.map((item, i) => (
        <div key={item.platform} className="flex items-center gap-3">
          <div
            className="w-3 h-3 rounded-full shrink-0"
            style={{ backgroundColor: colors[i] ?? '#94a3b8' }}
          />
          <div className="flex items-center gap-2 flex-1">
            {getPlatformIcon(item.platform)}
            <span className="text-sm text-slate-700 flex-1">{item.platform}</span>
            <span className="text-sm font-medium text-slate-900">{item.count}</span>
            <span className="text-xs text-slate-400 w-10 text-right">{item.percentage}%</span>
          </div>
        </div>
      ))}
    </div>
  );
}
