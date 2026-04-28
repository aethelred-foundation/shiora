/**
 * Shiora on Aethelred — Research Components
 *
 * Reusable UI components for the Research Portal:
 * StudyCard, ContributionHistory, EnrollModal.
 */

'use client';

import React, { useState } from 'react';
import {
  Microscope,
  Building2,
  User,
  Calendar,
  Users,
  Shield,
  ShieldCheck,
  CheckCircle,
  AlertTriangle,
  Loader2,
  TestTube2,
  ScanLine,
  HeartPulse,
  FileText,
  Clock,
  Coins,
  X,
} from 'lucide-react';

import type { ResearchStudy, DataContribution, RecordType, StudyStatus } from '@/types';
import { RECORD_TYPES } from '@/lib/constants';
import { MedicalCard, StatusBadge } from '@/components/ui/PagePrimitives';
import { Modal, Badge } from '@/components/ui/SharedComponents';
import { formatDate, timeAgo } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const RECORD_TYPE_ICON_MAP: Record<string, React.ReactNode> = {
  lab_result: <TestTube2 className="w-3.5 h-3.5" />,
  imaging: <ScanLine className="w-3.5 h-3.5" />,
  prescription: <FileText className="w-3.5 h-3.5" />,
  vitals: <HeartPulse className="w-3.5 h-3.5" />,
  notes: <FileText className="w-3.5 h-3.5" />,
};

function getRecordTypeLabel(id: string): string {
  return RECORD_TYPES.find((r) => r.id === id)?.label ?? id;
}

const STATUS_MAP: Record<StudyStatus, string> = {
  recruiting: 'Recruiting',
  active: 'Active',
  completed: 'Completed',
  suspended: 'Suspended',
};

const CONTRIBUTION_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  pending: { bg: 'bg-amber-50', text: 'text-amber-700' },
  accepted: { bg: 'bg-emerald-50', text: 'text-emerald-700' },
  rejected: { bg: 'bg-red-50', text: 'text-red-700' },
};

// ---------------------------------------------------------------------------
// StudyCard
// ---------------------------------------------------------------------------

export function StudyCard({
  study,
  onEnroll,
  isEnrolling,
}: {
  study: ResearchStudy;
  onEnroll?: (id: string) => void;
  isEnrolling?: boolean;
}) {
  const progress = Math.min(100, (study.participantCount / study.targetParticipants) * 100);
  const isRecruiting = study.status === 'recruiting';

  return (
    <MedicalCard>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center">
            <Microscope className="w-5 h-5 text-brand-600" />
          </div>
          <div>
            <StatusBadge status={STATUS_MAP[study.status]} />
          </div>
        </div>
        {study.zkpRequired && (
          <Badge variant="medical">
            <Shield className="w-3 h-3 mr-1" />
            ZKP Required
          </Badge>
        )}
      </div>

      <h4 className="text-sm font-semibold text-slate-900 mb-1.5 line-clamp-2">{study.title}</h4>

      <div className="flex items-center gap-3 mb-3 text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <Building2 className="w-3 h-3" />
          {study.institution}
        </span>
      </div>

      <p className="text-xs text-slate-500 mb-3">PI: {study.principalInvestigator}</p>

      {/* Participant progress */}
      <div className="mb-3">
        <div className="flex justify-between text-xs text-slate-500 mb-1">
          <span className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            {study.participantCount}/{study.targetParticipants} participants
          </span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-2">
          <div
            className="bg-brand-500 h-2 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Data types */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {study.dataTypesRequired.map((dt) => (
          <span
            key={dt}
            className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-50 border border-slate-200 rounded-full text-2xs text-slate-600"
          >
            {RECORD_TYPE_ICON_MAP[dt]}
            {getRecordTypeLabel(dt)}
          </span>
        ))}
      </div>

      {/* Compensation + Enroll */}
      <div className="flex items-center justify-between pt-3 border-t border-slate-100">
        <div className="flex items-center gap-1.5">
          <Coins className="w-4 h-4 text-amber-500" />
          <span className="text-sm font-bold text-slate-900">{study.compensationShio} AETHEL</span>
        </div>
        {isRecruiting && onEnroll && (
          <button
            onClick={() => onEnroll(study.id)}
            disabled={isEnrolling}
            className="px-4 py-1.5 text-xs font-medium bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors disabled:opacity-50"
          >
            {isEnrolling ? 'Enrolling...' : 'Enroll'}
          </button>
        )}
      </div>
    </MedicalCard>
  );
}

// ---------------------------------------------------------------------------
// ContributionHistory
// ---------------------------------------------------------------------------

export function ContributionHistory({
  contributions,
  studies,
}: {
  contributions: DataContribution[];
  studies: ResearchStudy[];
}) {
  const totalComp = contributions
    .filter((c) => c.status === 'accepted')
    .reduce((sum, c) => sum + c.compensation, 0);

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-4">
        <MedicalCard>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center">
              <Microscope className="w-5 h-5 text-brand-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Contributions</p>
              <p className="text-xl font-bold text-slate-900">{contributions.length}</p>
            </div>
          </div>
        </MedicalCard>
        <MedicalCard>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
              <Coins className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Total Compensation</p>
              <p className="text-xl font-bold text-slate-900">{totalComp} AETHEL</p>
            </div>
          </div>
        </MedicalCard>
      </div>

      {/* Contribution list */}
      <MedicalCard padding={false} hover={false}>
        <div className="divide-y divide-slate-100">
          {contributions.length === 0 ? (
            <div className="py-12 text-center">
              <Microscope className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500">No contributions yet</p>
            </div>
          ) : (
            contributions.map((contrib) => {
              const study = studies.find((s) => s.id === contrib.studyId);
              const statusStyle = CONTRIBUTION_STATUS_COLORS[contrib.status] ?? {
                bg: 'bg-slate-50',
                text: 'text-slate-600',
              };

              return (
                <div
                  key={contrib.id}
                  className="px-5 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors"
                >
                  <div className="w-9 h-9 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
                    <Microscope className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {study?.title ?? 'Unknown Study'}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-slate-400">
                        {timeAgo(contrib.contributedAt)}
                      </span>
                      <span className="text-xs text-slate-300">|</span>
                      <span className="text-xs text-slate-400">
                        {contrib.dataTypes.map(getRecordTypeLabel).join(', ')}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span
                      className={`px-2 py-0.5 rounded-full text-2xs font-medium ${statusStyle.bg} ${statusStyle.text}`}
                    >
                      {contrib.status}
                    </span>
                    <span className="text-sm font-medium text-slate-900">
                      +{contrib.compensation} AETHEL
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </MedicalCard>
    </div>
  );
}

// ---------------------------------------------------------------------------
// EnrollModal
// ---------------------------------------------------------------------------

export function EnrollModal({
  study,
  open,
  onClose,
  onConfirm,
  isLoading,
}: {
  study: ResearchStudy | null;
  open: boolean;
  onClose: () => void;
  onConfirm: (studyId: string, dataTypes: RecordType[]) => void;
  isLoading: boolean;
}) {
  const [selectedTypes, setSelectedTypes] = useState<RecordType[]>([]);
  const [consentChecks, setConsentChecks] = useState({
    dataUsage: false,
    privacy: false,
    withdrawal: false,
  });

  if (!study) return null;

  const allConsented = consentChecks.dataUsage && consentChecks.privacy && consentChecks.withdrawal;
  const hasSelectedTypes = selectedTypes.length > 0;

  const toggleType = (type: RecordType) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    );
  };

  const handleConfirm = () => {
    onConfirm(study.id, selectedTypes);
  };

  return (
    <Modal open={open} onClose={onClose} title="Enroll in Study" size="lg">
      <div className="space-y-5">
        {/* Study details */}
        <div className="bg-slate-50 rounded-xl p-4">
          <h4 className="text-sm font-semibold text-slate-900 mb-1">{study.title}</h4>
          <p className="text-xs text-slate-500 mb-2">
            {study.institution} | PI: {study.principalInvestigator}
          </p>
          <p className="text-xs text-slate-600 line-clamp-3">{study.description}</p>
        </div>

        {/* Data type selection */}
        <div>
          <h5 className="text-sm font-medium text-slate-700 mb-2">
            Select Data Types to Contribute
          </h5>
          <div className="space-y-2">
            {study.dataTypesRequired.map((dt) => (
              <label
                key={dt}
                className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                  selectedTypes.includes(dt)
                    ? 'bg-brand-50 border-brand-200'
                    : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedTypes.includes(dt)}
                  onChange={() => toggleType(dt)}
                  className="w-4 h-4 text-brand-600 border-slate-300 rounded focus:ring-brand-500"
                />
                <div className="flex items-center gap-2">
                  {RECORD_TYPE_ICON_MAP[dt]}
                  <span className="text-sm text-slate-700">{getRecordTypeLabel(dt)}</span>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Compensation */}
        <div className="bg-amber-50 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-amber-800">Compensation</p>
            <p className="text-xs text-amber-600">Paid upon acceptance of contribution</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-amber-900">{study.compensationShio} AETHEL</p>
          </div>
        </div>

        {/* Consent checkboxes */}
        <div className="space-y-3">
          <h5 className="text-sm font-medium text-slate-700">Consent</h5>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={consentChecks.dataUsage}
              onChange={(e) =>
                setConsentChecks((prev) => ({ ...prev, dataUsage: e.target.checked }))
              }
              className="w-4 h-4 mt-0.5 text-brand-600 border-slate-300 rounded focus:ring-brand-500"
            />
            <span className="text-sm text-slate-600">
              I consent to my anonymized health data being used for this research study under IRB
              approval <strong>{study.irbApprovalId}</strong>.
            </span>
          </label>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={consentChecks.privacy}
              onChange={(e) => setConsentChecks((prev) => ({ ...prev, privacy: e.target.checked }))}
              className="w-4 h-4 mt-0.5 text-brand-600 border-slate-300 rounded focus:ring-brand-500"
            />
            <span className="text-sm text-slate-600">
              I understand my data will be processed inside TEE enclaves and only aggregate results
              will be shared with researchers.
            </span>
          </label>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={consentChecks.withdrawal}
              onChange={(e) =>
                setConsentChecks((prev) => ({ ...prev, withdrawal: e.target.checked }))
              }
              className="w-4 h-4 mt-0.5 text-brand-600 border-slate-300 rounded focus:ring-brand-500"
            />
            <span className="text-sm text-slate-600">
              I understand I can withdraw my participation and revoke data access at any time.
            </span>
          </label>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 px-4 bg-slate-50 text-slate-600 border border-slate-200 rounded-xl text-sm font-medium hover:bg-slate-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isLoading || !allConsented || !hasSelectedTypes}
            className="flex-1 py-2.5 px-4 bg-brand-500 text-white rounded-xl text-sm font-medium hover:bg-brand-600 transition-colors disabled:opacity-50"
          >
            {isLoading ? 'Enrolling...' : 'Confirm Enrollment'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
