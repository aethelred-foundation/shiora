/**
 * Shiora on Aethelred — Clinical Decision Support Components
 * Reusable components for pathways, drug interactions, differentials, alerts, and audit.
 */

'use client';

import React from 'react';
import {
  CheckCircle,
  Clock,
  AlertTriangle,
  AlertCircle,
  SkipForward,
  ShieldCheck,
  Shield,
  Pill,
  FileSearch,
  Activity,
  Stethoscope,
  ChevronRight,
  Info,
  XCircle,
  Minus,
  Eye,
  Siren,
} from 'lucide-react';

import { MedicalCard, TEEBadge, TruncatedHash } from '@/components/ui/PagePrimitives';
import { Badge } from '@/components/ui/SharedComponents';
import { BRAND, CHART_COLORS, DRUG_SEVERITY_LEVELS, EXTENDED_STATUS_STYLES } from '@/lib/constants';
import { formatDate, formatDateTime, timeAgo } from '@/lib/utils';
import type {
  ClinicalPathway,
  ClinicalPathwayStep,
  DrugInteraction,
  DifferentialDiagnosis,
  ClinicalAlert,
  ClinicalDecisionAuditEntry,
  PathwayStepStatus,
  InteractionSeverity,
} from '@/types';

// ============================================================
// Step status styling
// ============================================================

const STEP_STATUS_CONFIG: Record<
  PathwayStepStatus,
  {
    icon: React.ReactNode;
    bg: string;
    text: string;
    border: string;
    line: string;
    label: string;
  }
> = {
  completed: {
    icon: <CheckCircle className="w-5 h-5 text-emerald-600" />,
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-300',
    line: 'bg-emerald-300',
    label: 'Completed',
  },
  active: {
    icon: <Activity className="w-5 h-5 text-blue-600 animate-pulse" />,
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-300',
    line: 'bg-blue-300',
    label: 'Active',
  },
  pending: {
    icon: <Clock className="w-5 h-5 text-slate-400" />,
    bg: 'bg-slate-50',
    text: 'text-slate-500',
    border: 'border-slate-200',
    line: 'bg-slate-200',
    label: 'Pending',
  },
  skipped: {
    icon: <SkipForward className="w-5 h-5 text-amber-500" />,
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-300',
    line: 'bg-amber-200',
    label: 'Skipped',
  },
};

// ============================================================
// Severity styling for drug interactions
// ============================================================

const SEVERITY_BADGE_VARIANT: Record<InteractionSeverity, string> = {
  major: 'error',
  moderate: 'warning',
  minor: 'info',
  none: 'success',
};

// ============================================================
// Alert type icons
// ============================================================

const ALERT_TYPE_ICONS: Record<ClinicalAlert['type'], React.ReactNode> = {
  drug_interaction: <Pill className="w-5 h-5 text-red-500" />,
  overdue_screening: <Clock className="w-5 h-5 text-amber-500" />,
  lab_abnormal: <AlertTriangle className="w-5 h-5 text-rose-500" />,
  guideline_deviation: <FileSearch className="w-5 h-5 text-blue-500" />,
  contraindication: <XCircle className="w-5 h-5 text-red-600" />,
};

const ALERT_TYPE_LABELS: Record<ClinicalAlert['type'], string> = {
  drug_interaction: 'Drug Interaction',
  overdue_screening: 'Overdue Screening',
  lab_abnormal: 'Lab Abnormal',
  guideline_deviation: 'Guideline Deviation',
  contraindication: 'Contraindication',
};

// ============================================================
// Decision type labels and colors
// ============================================================

const DECISION_TYPE_CONFIG: Record<
  ClinicalDecisionAuditEntry['decisionType'],
  {
    label: string;
    variant: string;
  }
> = {
  pathway_step: { label: 'Pathway Step', variant: 'info' },
  drug_check: { label: 'Drug Check', variant: 'error' },
  differential: { label: 'Differential', variant: 'medical' },
  guideline_applied: { label: 'Guideline', variant: 'success' },
  alert_generated: { label: 'Alert', variant: 'warning' },
};

// ============================================================
// Urgency styling
// ============================================================

const URGENCY_VARIANT: Record<DifferentialDiagnosis['urgency'], string> = {
  emergent: 'error',
  urgent: 'warning',
  routine: 'info',
  elective: 'neutral',
};

// ============================================================
// ClinicalAlertCard
// ============================================================

export function ClinicalAlertCard({ alert }: { alert: ClinicalAlert }) {
  const severityVariant =
    alert.severity === 'critical' ? 'error' : alert.severity === 'warning' ? 'warning' : 'info';

  return (
    <MedicalCard className="relative">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0">{ALERT_TYPE_ICONS[alert.type]}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h4 className="text-sm font-semibold text-slate-900">{alert.title}</h4>
            <Badge variant={severityVariant as any}>{alert.severity}</Badge>
            <span className="text-xs text-slate-400">{timeAgo(alert.triggeredAt)}</span>
          </div>
          <p className="text-xs text-slate-600 mb-2 leading-relaxed">{alert.message}</p>
          <div className="flex items-start gap-1.5">
            <Info className="w-3.5 h-3.5 text-brand-500 mt-0.5 shrink-0" />
            <p className="text-xs text-brand-700 font-medium">{alert.recommendation}</p>
          </div>
          {(alert.relatedDrugs?.length || alert.relatedConditions?.length) && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {alert.relatedDrugs?.map((drug) => (
                <span
                  key={drug}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-50 text-red-600 border border-red-100"
                >
                  <Pill className="w-2.5 h-2.5" /> {drug}
                </span>
              ))}
              {alert.relatedConditions?.map((cond) => (
                <span
                  key={cond}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200"
                >
                  {cond}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </MedicalCard>
  );
}

// ============================================================
// PathwayFlowchart
// ============================================================

export function PathwayFlowchart({ pathway }: { pathway: ClinicalPathway }) {
  return (
    <MedicalCard>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900">{pathway.name}</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {pathway.guidelineSource} v{pathway.version}
          </p>
        </div>
        <TEEBadge platform="Intel SGX" verified={pathway.teeVerified} />
      </div>

      <p className="text-xs text-slate-600 mb-4 leading-relaxed">{pathway.description}</p>

      {/* Applicable conditions */}
      <div className="flex flex-wrap gap-1.5 mb-5">
        {pathway.applicableConditions.map((cond) => (
          <span
            key={cond}
            className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-brand-50 text-brand-700 border border-brand-200"
          >
            {cond}
          </span>
        ))}
      </div>

      {/* Vertical flowchart */}
      <div className="relative ml-3">
        {pathway.steps.map((step, i) => {
          const config = STEP_STATUS_CONFIG[step.status];
          const isLast = i === pathway.steps.length - 1;

          return (
            <div key={step.id} className="relative flex gap-4 pb-6">
              {/* Vertical connecting line */}
              {!isLast && (
                <div className={`absolute left-[9px] top-[28px] w-0.5 bottom-0 ${config.line}`} />
              )}

              {/* Status icon */}
              <div className="relative z-10 shrink-0 mt-0.5">{config.icon}</div>

              {/* Step content */}
              <div className={`flex-1 border rounded-xl p-3 ${config.border} ${config.bg}`}>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    Step {step.order}
                  </span>
                  <Badge
                    variant={
                      config.text.includes('emerald')
                        ? 'success'
                        : config.text.includes('blue')
                          ? 'info'
                          : config.text.includes('amber')
                            ? 'warning'
                            : 'neutral'
                    }
                  >
                    {config.label}
                  </Badge>
                  {step.completedAt && (
                    <span className="text-[10px] text-slate-400">
                      {formatDate(step.completedAt)}
                    </span>
                  )}
                </div>
                <h4 className="text-sm font-semibold text-slate-900 mb-1">{step.title}</h4>
                <p className="text-xs text-slate-600 mb-2 leading-relaxed">{step.description}</p>
                <div className="flex items-start gap-1.5 mb-2">
                  <ChevronRight className="w-3 h-3 text-brand-500 mt-0.5 shrink-0" />
                  <span className="text-xs text-brand-700 font-medium">{step.actionRequired}</span>
                </div>

                {/* Criteria chips */}
                <div className="flex flex-wrap gap-1 mt-2">
                  {step.criteria.map((c, ci) => (
                    <span
                      key={ci}
                      className="inline-block px-1.5 py-0.5 rounded text-[10px] bg-white/60 text-slate-500 border border-slate-200/50"
                    >
                      {c}
                    </span>
                  ))}
                </div>

                {/* TEE attestation */}
                {step.attestation && (
                  <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-slate-200/50">
                    <ShieldCheck className="w-3 h-3 text-emerald-500" />
                    <TruncatedHash hash={step.attestation} startLen={10} endLen={6} />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </MedicalCard>
  );
}

// ============================================================
// DrugInteractionRow
// ============================================================

export function DrugInteractionRow({ interaction }: { interaction: DrugInteraction }) {
  const sevDef = DRUG_SEVERITY_LEVELS.find((s) => s.id === interaction.severity);

  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
      <td className="py-3 px-3">
        <span className="text-sm font-medium text-slate-900">{interaction.drugA}</span>
      </td>
      <td className="py-3 px-3">
        <span className="text-sm font-medium text-slate-900">{interaction.drugB}</span>
      </td>
      <td className="py-3 px-3">
        <Badge variant={SEVERITY_BADGE_VARIANT[interaction.severity] as any}>
          {interaction.severity}
        </Badge>
      </td>
      <td className="py-3 px-3">
        <p className="text-xs text-slate-600 max-w-xs leading-relaxed">{interaction.mechanism}</p>
      </td>
      <td className="py-3 px-3">
        <p className="text-xs text-slate-600 max-w-xs leading-relaxed">
          {interaction.clinicalEffect}
        </p>
      </td>
      <td className="py-3 px-3">
        <p className="text-xs text-brand-700 font-medium max-w-xs leading-relaxed">
          {interaction.recommendation}
        </p>
      </td>
      <td className="py-3 px-3">
        <Badge
          variant={
            interaction.evidenceLevel === 'established'
              ? 'success'
              : interaction.evidenceLevel === 'probable'
                ? 'info'
                : 'neutral'
          }
        >
          {interaction.evidenceLevel}
        </Badge>
      </td>
      <td className="py-3 px-3">
        {interaction.teeVerified ? (
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
        ) : (
          <Shield className="w-4 h-4 text-slate-300" />
        )}
      </td>
    </tr>
  );
}

// ============================================================
// DifferentialCard
// ============================================================

export function DifferentialCard({ diagnosis }: { diagnosis: DifferentialDiagnosis }) {
  const probabilityPercent = Math.round(diagnosis.probability * 100);
  const barColor =
    probabilityPercent >= 80
      ? BRAND.sky
      : probabilityPercent >= 60
        ? '#f59e0b'
        : probabilityPercent >= 40
          ? '#06b6d4'
          : '#94a3b8';

  return (
    <MedicalCard>
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-sm font-semibold text-slate-900">{diagnosis.condition}</h4>
            <Badge variant={URGENCY_VARIANT[diagnosis.urgency] as any}>{diagnosis.urgency}</Badge>
          </div>
          <span className="text-xs font-mono text-slate-400">ICD-10: {diagnosis.icdCode}</span>
        </div>
        <TEEBadge platform="Intel SGX" verified={diagnosis.teeVerified} />
      </div>

      {/* Probability bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-slate-500">Probability</span>
          <span className="text-sm font-bold" style={{ color: barColor }}>
            {probabilityPercent}%
          </span>
        </div>
        <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${probabilityPercent}%`, backgroundColor: barColor }}
          />
        </div>
      </div>

      {/* Supporting evidence */}
      <div className="mb-3">
        <h5 className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider mb-1.5">
          Supporting Evidence
        </h5>
        <ul className="space-y-1">
          {diagnosis.supportingEvidence.map((ev, i) => (
            <li key={i} className="flex items-start gap-1.5 text-xs text-slate-600">
              <CheckCircle className="w-3 h-3 text-emerald-400 mt-0.5 shrink-0" />
              <span>{ev}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Contradicting evidence */}
      <div className="mb-3">
        <h5 className="text-[10px] font-semibold text-amber-600 uppercase tracking-wider mb-1.5">
          Contradicting Evidence
        </h5>
        <ul className="space-y-1">
          {diagnosis.contradictingEvidence.map((ev, i) => (
            <li key={i} className="flex items-start gap-1.5 text-xs text-slate-600">
              <Minus className="w-3 h-3 text-amber-400 mt-0.5 shrink-0" />
              <span>{ev}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Recommended tests */}
      <div>
        <h5 className="text-[10px] font-semibold text-blue-600 uppercase tracking-wider mb-1.5">
          Recommended Tests
        </h5>
        <div className="flex flex-wrap gap-1.5">
          {diagnosis.recommendedTests.map((test, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-100"
            >
              <Eye className="w-2.5 h-2.5" />
              {test}
            </span>
          ))}
        </div>
      </div>

      {/* Attestation */}
      <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-slate-100">
        <ShieldCheck className="w-3 h-3 text-emerald-500" />
        <TruncatedHash hash={diagnosis.attestation} startLen={10} endLen={6} />
      </div>
    </MedicalCard>
  );
}

// ============================================================
// AuditTrailTable
// ============================================================

export function AuditTrailTable({ entries }: { entries: ClinicalDecisionAuditEntry[] }) {
  return (
    <MedicalCard padding={false}>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/50">
              <th className="py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Timestamp
              </th>
              <th className="py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Decision Type
              </th>
              <th className="py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Model ID
              </th>
              <th className="py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Confidence
              </th>
              <th className="py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Output
              </th>
              <th className="py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Reviewed By
              </th>
              <th className="py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Attestation
              </th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => {
              const typeConfig = DECISION_TYPE_CONFIG[entry.decisionType];
              const confidenceColor =
                entry.confidence >= 95
                  ? 'text-emerald-600'
                  : entry.confidence >= 85
                    ? 'text-blue-600'
                    : entry.confidence >= 75
                      ? 'text-amber-600'
                      : 'text-red-600';

              return (
                <tr
                  key={entry.id}
                  className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors"
                >
                  <td className="py-2.5 px-3">
                    <div className="text-xs text-slate-900 font-medium">
                      {formatDateTime(entry.timestamp)}
                    </div>
                    <div className="text-[10px] text-slate-400">{timeAgo(entry.timestamp)}</div>
                  </td>
                  <td className="py-2.5 px-3">
                    <Badge variant={typeConfig.variant as any}>{typeConfig.label}</Badge>
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="text-xs font-mono text-slate-600">{entry.modelId}</span>
                  </td>
                  <td className="py-2.5 px-3">
                    <span className={`text-sm font-bold ${confidenceColor}`}>
                      {entry.confidence.toFixed(1)}%
                    </span>
                  </td>
                  <td className="py-2.5 px-3 max-w-xs">
                    <p className="text-xs text-slate-600 line-clamp-2">{entry.output}</p>
                  </td>
                  <td className="py-2.5 px-3">
                    {entry.reviewedBy ? (
                      <div>
                        <p className="text-xs text-slate-700 font-medium">{entry.reviewedBy}</p>
                        {entry.reviewedAt && (
                          <p className="text-[10px] text-slate-400">{timeAgo(entry.reviewedAt)}</p>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400 italic">Pending review</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3">
                    <TruncatedHash hash={entry.attestation} startLen={8} endLen={4} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {entries.length === 0 && (
        <div className="flex items-center justify-center py-16 text-slate-400 text-sm">
          Loading audit trail...
        </div>
      )}
    </MedicalCard>
  );
}
