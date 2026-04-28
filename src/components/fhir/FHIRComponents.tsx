/**
 * Shiora on Aethelred — FHIR Bridge Components
 * Reusable components for the FHIR Bridge feature.
 */

'use client';

import React, { useState } from 'react';
import {
  User,
  Eye,
  Pill,
  AlertCircle,
  FileSearch,
  Syringe,
  Scissors,
  AlertTriangle,
  Link2,
  Upload,
  Download,
  ArrowRight,
  CheckCircle,
  XCircle,
  Clock,
  Edit3,
  Code,
  FileJson,
} from 'lucide-react';

import { MedicalCard, StatusBadge } from '@/components/ui/PagePrimitives';
import { Badge } from '@/components/ui/SharedComponents';
import { FHIR_RESOURCE_TYPES, EXTENDED_STATUS_STYLES } from '@/lib/constants';
import { formatDate, timeAgo, truncateAddress } from '@/lib/utils';
import type {
  FHIRResource,
  FHIRMapping,
  FHIRImportJob,
  FHIRExportConfig,
  FHIRResourceType,
} from '@/types';

// ============================================================
// Resource type icon map
// ============================================================

const RESOURCE_ICON_MAP: Record<string, React.ReactNode> = {
  Patient: <User className="w-4 h-4" />,
  Observation: <Eye className="w-4 h-4" />,
  MedicationRequest: <Pill className="w-4 h-4" />,
  Condition: <AlertCircle className="w-4 h-4" />,
  DiagnosticReport: <FileSearch className="w-4 h-4" />,
  Immunization: <Syringe className="w-4 h-4" />,
  Procedure: <Scissors className="w-4 h-4" />,
  AllergyIntolerance: <AlertTriangle className="w-4 h-4" />,
};

const RESOURCE_COLORS: Record<string, string> = {
  Patient: '#6366f1',
  Observation: '#10b981',
  MedicationRequest: '#8B1538',
  Condition: '#f43f5e',
  DiagnosticReport: '#a78bfa',
  Immunization: '#eab308',
  Procedure: '#fb923c',
  AllergyIntolerance: '#ef4444',
};

// ============================================================
// FHIRBadge
// ============================================================

export function FHIRBadge({ resourceType }: { resourceType: FHIRResourceType }) {
  const meta = FHIR_RESOURCE_TYPES.find((t) => t.id === resourceType);
  const color = RESOURCE_COLORS[resourceType] ?? '#94a3b8';

  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border"
      style={{
        backgroundColor: `${color}10`,
        color: color,
        borderColor: `${color}30`,
      }}
    >
      {RESOURCE_ICON_MAP[resourceType] ?? <Code className="w-3 h-3" />}
      {meta?.label ?? resourceType}
    </span>
  );
}

// ============================================================
// ResourceViewer
// ============================================================

export function ResourceViewer({ resource }: { resource: FHIRResource }) {
  const [showRaw, setShowRaw] = useState(false);
  const meta = FHIR_RESOURCE_TYPES.find((t) => t.id === resource.resourceType);
  const color =
    RESOURCE_COLORS[resource.resourceType] ??
    /* istanbul ignore next -- resourceType always in RESOURCE_COLORS */
    '#94a3b8';

  return (
    <MedicalCard>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
            style={{ backgroundColor: color }}
          >
            {RESOURCE_ICON_MAP[resource.resourceType] ?? (
              /* istanbul ignore next -- icon always found for known resourceTypes */
              <Code className="w-5 h-5" />
            )}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              {meta?.label ??
                /* istanbul ignore next -- meta always found for known resourceTypes */
                resource.resourceType}
            </h3>
            <p className="text-xs text-slate-500 font-mono">{resource.id}</p>
          </div>
        </div>
        <Badge
          variant={
            resource.status === 'active' ||
            resource.status === 'final' ||
            resource.status === 'completed'
              ? 'success'
              : 'warning'
          }
        >
          {resource.status}
        </Badge>
      </div>

      <div className="space-y-2 text-xs mb-3">
        <div className="flex justify-between">
          <span className="text-slate-500">Last Updated</span>
          <span className="text-slate-700">{formatDate(resource.lastUpdated)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Mapped to Shiora</span>
          <span
            className={resource.mappedRecordId ? 'text-emerald-600 font-medium' : 'text-slate-400'}
          >
            {resource.mappedRecordId ? 'Yes' : 'No'}
          </span>
        </div>
      </div>

      <button
        onClick={() => setShowRaw(!showRaw)}
        className="text-xs text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1"
      >
        <Code className="w-3 h-3" />
        {showRaw ? 'Hide' : 'Show'} Raw FHIR JSON
      </button>

      {showRaw && (
        <pre className="mt-2 p-3 bg-slate-50 rounded-lg text-xs text-slate-700 overflow-x-auto max-h-40 font-mono">
          {JSON.stringify(JSON.parse(resource.rawJson), null, 2)}
        </pre>
      )}
    </MedicalCard>
  );
}

// ============================================================
// MappingTable
// ============================================================

export function MappingTable({ mappings }: { mappings: FHIRMapping[] }) {
  return (
    <MedicalCard padding={false}>
      <div className="p-5 pb-3">
        <h3 className="text-base font-semibold text-slate-900">FHIR to Shiora Mappings</h3>
        <p className="text-xs text-slate-400 mt-0.5">
          {mappings.length} resource type mappings configured
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="px-5 py-2 text-left text-xs font-medium text-slate-500 uppercase">
                FHIR Type
              </th>
              <th className="px-5 py-2 text-left text-xs font-medium text-slate-500 uppercase" />
              <th className="px-5 py-2 text-left text-xs font-medium text-slate-500 uppercase">
                Shiora Type
              </th>
              <th className="px-5 py-2 text-left text-xs font-medium text-slate-500 uppercase">
                Fields
              </th>
              <th className="px-5 py-2 text-left text-xs font-medium text-slate-500 uppercase">
                Default
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {mappings.map((m) => (
              <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-5 py-3">
                  <FHIRBadge resourceType={m.fhirResourceType} />
                </td>
                <td className="px-5 py-3">
                  <ArrowRight className="w-4 h-4 text-slate-300" />
                </td>
                <td className="px-5 py-3">
                  <Badge variant="brand">{m.shioraRecordType}</Badge>
                </td>
                <td className="px-5 py-3 text-slate-600">{m.fieldMappings.length} fields</td>
                <td className="px-5 py-3">
                  {m.isDefault ? (
                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <Edit3 className="w-4 h-4 text-slate-400" />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </MedicalCard>
  );
}

// ============================================================
// ImportWizard
// ============================================================

export function ImportWizard({
  onImport,
  isLoading,
}: {
  onImport: (source: string) => void;
  isLoading: boolean;
}) {
  const [step, setStep] = useState(1);
  const [importSource, setImportSource] = useState('');
  const [importUrl, setImportUrl] = useState('');

  return (
    <MedicalCard>
      <h3 className="text-base font-semibold text-slate-900 mb-4">Import FHIR Resources</h3>

      {/* Progress */}
      <div className="flex items-center gap-3 mb-6">
        {['Source', 'Preview', 'Confirm'].map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                step > i + 1
                  ? 'bg-emerald-600 text-white'
                  : step === i + 1
                    ? 'bg-brand-600 text-white'
                    : 'bg-slate-100 text-slate-400'
              }`}
            >
              {step > i + 1 ? <CheckCircle className="w-3.5 h-3.5" /> : i + 1}
            </div>
            <span
              className={`text-xs font-medium ${step === i + 1 ? 'text-brand-700' : 'text-slate-400'}`}
            >
              {label}
            </span>
            {i < 2 && (
              <div className={`w-8 h-0.5 ${step > i + 1 ? 'bg-emerald-600' : 'bg-slate-200'}`} />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Source */}
      {step === 1 && (
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1 block">
              FHIR JSON Bundle
            </label>
            <textarea
              rows={4}
              placeholder="Paste FHIR Bundle JSON here..."
              value={importSource}
              onChange={(e) => setImportSource(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div className="text-center text-xs text-slate-400">or</div>
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1 block">FHIR Server URL</label>
            <input
              type="url"
              placeholder="https://fhir.example.com/api/Patient"
              value={importUrl}
              onChange={(e) => setImportUrl(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <button
            onClick={() => setStep(2)}
            disabled={!importSource && !importUrl}
            className="w-full px-4 py-2.5 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-xl transition-colors disabled:opacity-50"
          >
            Preview Resources
          </button>
        </div>
      )}

      {/* Step 2: Preview */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="p-4 bg-slate-50 rounded-xl">
            <p className="text-sm font-medium text-slate-900 mb-2">Resources to Import</p>
            <div className="space-y-1">
              {FHIR_RESOURCE_TYPES.slice(0, 4).map((rt) => (
                <div key={rt.id} className="flex items-center justify-between text-xs">
                  <FHIRBadge resourceType={rt.id as FHIRResourceType} />
                  <span className="text-slate-600">2 resources</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-2">8 resources total from source</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setStep(1)}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
            >
              Back
            </button>
            <button
              onClick={() => setStep(3)}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-xl transition-colors"
            >
              Confirm Import
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Confirm */}
      {step === 3 && (
        <div className="space-y-4 text-center">
          <div className="w-12 h-12 rounded-full bg-brand-50 flex items-center justify-center mx-auto">
            <Upload className="w-6 h-6 text-brand-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">Ready to Import</p>
            <p className="text-xs text-slate-500 mt-1">
              8 FHIR resources will be imported, mapped, encrypted, and stored on IPFS.
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setStep(2)}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
            >
              Back
            </button>
            <button
              onClick={() => {
                onImport(importUrl || 'Manual JSON Paste');
                setStep(1);
                setImportSource('');
                setImportUrl('');
              }}
              disabled={isLoading}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-xl transition-colors disabled:opacity-50"
            >
              {isLoading ? 'Importing...' : 'Start Import'}
            </button>
          </div>
        </div>
      )}
    </MedicalCard>
  );
}

// ============================================================
// ExportConfig
// ============================================================

export function ExportConfigPanel({
  onExport,
  isLoading,
}: {
  onExport: (config: Omit<FHIRExportConfig, 'id' | 'lastExportAt'>) => void;
  isLoading: boolean;
}) {
  const [format, setFormat] = useState<'json' | 'xml'>('json');
  const [selectedTypes, setSelectedTypes] = useState<FHIRResourceType[]>([
    'Patient',
    'Observation',
  ]);
  const [destination, setDestination] = useState('IPFS Encrypted Bundle');

  const toggleType = (type: FHIRResourceType) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    );
  };

  return (
    <MedicalCard>
      <h3 className="text-base font-semibold text-slate-900 mb-4">Export FHIR Resources</h3>

      <div className="space-y-4">
        {/* Resource Types */}
        <div>
          <label className="text-sm font-medium text-slate-700 mb-2 block">Resource Types</label>
          <div className="flex flex-wrap gap-2">
            {FHIR_RESOURCE_TYPES.map((rt) => (
              <button
                key={rt.id}
                onClick={() => toggleType(rt.id as FHIRResourceType)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  selectedTypes.includes(rt.id as FHIRResourceType)
                    ? 'bg-brand-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {rt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Format */}
        <div>
          <label className="text-sm font-medium text-slate-700 mb-2 block">Format</label>
          <div className="flex gap-2">
            {(['json', 'xml'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFormat(f)}
                className={`px-4 py-2 text-xs font-medium rounded-lg transition-colors uppercase ${
                  format === f
                    ? 'bg-brand-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Destination */}
        <div>
          <label className="text-sm font-medium text-slate-700 mb-1 block">Destination</label>
          <select
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option>IPFS Encrypted Bundle</option>
            <option>Epic MyChart</option>
            <option>Download (Local)</option>
          </select>
        </div>

        <button
          onClick={() =>
            onExport({
              format,
              resourceTypes: selectedTypes,
              destination,
            })
          }
          disabled={isLoading || selectedTypes.length === 0}
          className="w-full px-4 py-2.5 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-xl transition-colors disabled:opacity-50"
        >
          {isLoading ? 'Exporting...' : 'Export Resources'}
        </button>
      </div>
    </MedicalCard>
  );
}
