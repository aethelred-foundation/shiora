/**
 * Shiora on Aethelred — GDPR Privacy Rights Components
 *
 * Reusable components for the privacy rights feature on the Settings page:
 * PrivacyRequestCard, DataExportPanel, ErasureRequestPanel.
 */

'use client';

import React, { useState, useMemo } from 'react';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Clock,
  Calendar,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Download,
  Trash2,
  FileText,
  Database,
  Loader2,
  Eye,
  Send,
  Package,
  ChevronDown,
} from 'lucide-react';

import type { PrivacyRequest, PrivacyRequestType, PrivacyRequestStatus } from '@/types';
import { formatDate, formatDateTime, timeAgo } from '@/lib/utils';
import { MedicalCard } from '@/components/ui/PagePrimitives';
import { Badge } from '@/components/ui/SharedComponents';

// ============================================================
// Constants
// ============================================================

const DATA_CATEGORIES = [
  'Health Records',
  'Lab Results',
  'Cycle Data',
  'Wearable Data',
  'AI Inferences',
  'Consent History',
  'Prescription Data',
  'Imaging Data',
  'Vitals',
  'Clinical Notes',
];

const EXPORT_FORMATS = [
  {
    id: 'json',
    label: 'JSON (FHIR R4)',
    description: 'Standard healthcare interoperability format',
  },
  { id: 'csv', label: 'CSV', description: 'Spreadsheet-compatible tabular format' },
  { id: 'xml', label: 'XML (CDA)', description: 'Clinical Document Architecture format' },
];

// ============================================================
// Type helpers
// ============================================================

const TYPE_CONFIG: Record<
  PrivacyRequestType,
  { icon: React.ReactNode; label: string; variant: 'info' | 'warning' | 'brand' | 'medical' }
> = {
  access: { icon: <Eye className="w-4 h-4" />, label: 'Data Access', variant: 'info' },
  portability: {
    icon: <Package className="w-4 h-4" />,
    label: 'Data Portability',
    variant: 'brand',
  },
  erasure: { icon: <Trash2 className="w-4 h-4" />, label: 'Data Erasure', variant: 'warning' },
  rectification: {
    icon: <FileText className="w-4 h-4" />,
    label: 'Rectification',
    variant: 'medical',
  },
};

const STATUS_CONFIG: Record<
  PrivacyRequestStatus,
  { icon: React.ReactNode; label: string; variant: 'warning' | 'info' | 'success' | 'error' }
> = {
  pending: { icon: <Clock className="w-4 h-4" />, label: 'Pending', variant: 'warning' },
  processing: {
    icon: <Loader2 className="w-4 h-4 animate-spin" />,
    label: 'Processing',
    variant: 'info',
  },
  completed: { icon: <CheckCircle className="w-4 h-4" />, label: 'Completed', variant: 'success' },
  denied: { icon: <XCircle className="w-4 h-4" />, label: 'Denied', variant: 'error' },
};

// ============================================================
// PrivacyRequestCard
// ============================================================

interface PrivacyRequestCardProps {
  request: PrivacyRequest;
  onViewDetails?: (request: PrivacyRequest) => void;
}

export function PrivacyRequestCard({ request, onViewDetails }: PrivacyRequestCardProps) {
  const typeCfg = TYPE_CONFIG[request.type];
  const statusCfg = STATUS_CONFIG[request.status];

  return (
    <MedicalCard>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-100 to-brand-200 flex items-center justify-center shrink-0">
            {typeCfg.icon}
          </div>
          <div>
            <h4 className="text-sm font-semibold text-slate-900">{typeCfg.label} Request</h4>
            <p className="text-xs text-slate-500">ID: {request.id}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={typeCfg.variant}>{typeCfg.label}</Badge>
          <Badge variant={statusCfg.variant} dot>
            {statusCfg.label}
          </Badge>
        </div>
      </div>

      {/* Details */}
      <p className="text-sm text-slate-600 mb-3">{request.details}</p>

      {/* Data Categories */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {request.dataCategories.map((cat) => (
          <span
            key={cat}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-50 text-slate-600 border border-slate-200"
          >
            <Database className="w-3 h-3" />
            {cat}
          </span>
        ))}
      </div>

      {/* Timestamps and Actions */}
      <div className="flex items-center justify-between pt-3 border-t border-slate-100">
        <div className="flex items-center gap-4 text-xs text-slate-400">
          <span className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" />
            Submitted {formatDate(request.requestedAt)}
          </span>
          {request.completedAt && (
            <span className="flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5" />
              Completed {formatDate(request.completedAt)}
            </span>
          )}
          {!request.completedAt && (
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {timeAgo(request.requestedAt)}
            </span>
          )}
        </div>
        {onViewDetails && (
          <button
            onClick={() => onViewDetails(request)}
            className="text-xs font-medium text-brand-600 hover:text-brand-700 transition-colors"
          >
            View Details
          </button>
        )}
      </div>
    </MedicalCard>
  );
}

// ============================================================
// DataExportPanel
// ============================================================

interface DataExportPanelProps {
  onSubmit: (categories: string[], format: string) => void;
  isLoading?: boolean;
}

export function DataExportPanel({ onSubmit, isLoading = false }: DataExportPanelProps) {
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedFormat, setSelectedFormat] = useState('json');
  const [showCategories, setShowCategories] = useState(false);

  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
    );
  };

  const selectAll = () => {
    setSelectedCategories(
      selectedCategories.length === DATA_CATEGORIES.length ? [] : [...DATA_CATEGORIES],
    );
  };

  const handleSubmit = () => {
    /* istanbul ignore next -- button is disabled when no categories selected */
    if (selectedCategories.length === 0) return;
    onSubmit(selectedCategories, selectedFormat);
    setSelectedCategories([]);
  };

  return (
    <MedicalCard>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-100 to-emerald-200 flex items-center justify-center">
          <Download className="w-5 h-5 text-emerald-600" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Export Your Data</h3>
          <p className="text-xs text-slate-500">
            Request a copy of your personal health data (GDPR Article 15 / Article 20)
          </p>
        </div>
      </div>

      {/* Format Selection */}
      <div className="mb-4">
        <label className="block text-xs font-medium text-slate-700 mb-2">Export Format</label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {EXPORT_FORMATS.map((fmt) => (
            <button
              key={fmt.id}
              type="button"
              onClick={() => setSelectedFormat(fmt.id)}
              className={`p-3 rounded-xl border text-left transition-all ${
                selectedFormat === fmt.id
                  ? 'border-brand-300 bg-brand-50 ring-1 ring-brand-200'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <span className="text-sm font-medium text-slate-900">{fmt.label}</span>
              <p className="text-xs text-slate-500 mt-0.5">{fmt.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Category Selection */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <label className="block text-xs font-medium text-slate-700">Data Categories</label>
          <button
            type="button"
            onClick={selectAll}
            className="text-xs font-medium text-brand-600 hover:text-brand-700"
          >
            {selectedCategories.length === DATA_CATEGORIES.length ? 'Deselect All' : 'Select All'}
          </button>
        </div>

        <button
          type="button"
          onClick={() => setShowCategories(!showCategories)}
          className="w-full flex items-center justify-between px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 hover:border-slate-300 transition-colors"
        >
          <span>
            {selectedCategories.length === 0
              ? 'Select categories...'
              : `${selectedCategories.length} categor${selectedCategories.length === 1 ? 'y' : 'ies'} selected`}
          </span>
          <ChevronDown
            className={`w-4 h-4 text-slate-400 transition-transform ${showCategories ? 'rotate-180' : ''}`}
          />
        </button>

        {showCategories && (
          <div className="mt-2 p-2 rounded-xl border border-slate-200 bg-white max-h-48 overflow-y-auto">
            {DATA_CATEGORIES.map((cat) => (
              <label
                key={cat}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedCategories.includes(cat)}
                  onChange={() => toggleCategory(cat)}
                  className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                />
                <span className="text-sm text-slate-700">{cat}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Submit */}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={selectedCategories.length === 0 || isLoading}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 text-white text-sm font-medium shadow-sm hover:from-brand-600 hover:to-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Submitting Request...
          </>
        ) : (
          <>
            <Send className="w-4 h-4" />
            Request Data Export
          </>
        )}
      </button>
    </MedicalCard>
  );
}

// ============================================================
// ErasureRequestPanel
// ============================================================

interface ErasureRequestPanelProps {
  onSubmit: (categories: string[]) => void;
  isLoading?: boolean;
}

export function ErasureRequestPanel({ onSubmit, isLoading = false }: ErasureRequestPanelProps) {
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [showCategories, setShowCategories] = useState(false);

  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
    );
    setConfirmed(false);
  };

  const handleSubmit = () => {
    /* istanbul ignore next -- button is disabled when no categories or not confirmed */
    if (selectedCategories.length === 0 || !confirmed) return;
    onSubmit(selectedCategories);
    setSelectedCategories([]);
    setConfirmed(false);
  };

  return (
    <MedicalCard>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-100 to-red-200 flex items-center justify-center">
          <Trash2 className="w-5 h-5 text-red-600" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Request Data Erasure</h3>
          <p className="text-xs text-slate-500">Right to be forgotten (GDPR Article 17)</p>
        </div>
      </div>

      {/* Warning Banner */}
      <div className="flex items-start gap-3 p-3 rounded-xl bg-red-50 border border-red-200 mb-4">
        <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-red-800">Permanent Deletion Warning</p>
          <p className="text-xs text-red-600 mt-1">
            Data erasure is irreversible. Once your data is deleted, it cannot be recovered. This
            includes all associated IPFS pins, blockchain anchors, and TEE attestations for the
            selected categories. Please review your selection carefully before submitting.
          </p>
        </div>
      </div>

      {/* Category Selection */}
      <div className="mb-4">
        <label className="block text-xs font-medium text-slate-700 mb-2">
          Select categories to permanently delete
        </label>

        <button
          type="button"
          onClick={() => setShowCategories(!showCategories)}
          className="w-full flex items-center justify-between px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 hover:border-slate-300 transition-colors"
        >
          <span>
            {selectedCategories.length === 0
              ? 'Select categories to erase...'
              : `${selectedCategories.length} categor${selectedCategories.length === 1 ? 'y' : 'ies'} selected for deletion`}
          </span>
          <ChevronDown
            className={`w-4 h-4 text-slate-400 transition-transform ${showCategories ? 'rotate-180' : ''}`}
          />
        </button>

        {showCategories && (
          <div className="mt-2 p-2 rounded-xl border border-slate-200 bg-white max-h-48 overflow-y-auto">
            {DATA_CATEGORIES.map((cat) => (
              <label
                key={cat}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedCategories.includes(cat)}
                  onChange={() => toggleCategory(cat)}
                  className="rounded border-slate-300 text-red-600 focus:ring-red-500"
                />
                <span className="text-sm text-slate-700">{cat}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Confirmation Checkbox */}
      {selectedCategories.length > 0 && (
        <label className="flex items-start gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200 mb-4 cursor-pointer">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="rounded border-slate-300 text-red-600 focus:ring-red-500 mt-0.5"
          />
          <span className="text-xs text-slate-600">
            I understand that this action is permanent and irreversible. All selected data
            categories will be permanently deleted from Shiora, including associated IPFS pins and
            blockchain records.
          </span>
        </label>
      )}

      {/* Submit */}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={selectedCategories.length === 0 || !confirmed || isLoading}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-red-500 to-red-600 text-white text-sm font-medium shadow-sm hover:from-red-600 hover:to-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Submitting Erasure Request...
          </>
        ) : (
          <>
            <Trash2 className="w-4 h-4" />
            Submit Erasure Request
          </>
        )}
      </button>
    </MedicalCard>
  );
}
