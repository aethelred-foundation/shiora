/**
 * Shiora on Aethelred — FHIR Bridge Page
 *
 * Import, export, and map FHIR R4 resources to Shiora health records
 * with TEE verification and blockchain anchoring.
 */

'use client';

import { useState } from 'react';
import {
  Link2, Upload, Download, ArrowRight,
  FileJson, Code, CheckCircle, XCircle,
  Clock, AlertTriangle, Database,
  User, Eye, Pill, AlertCircle, FileSearch,
  Syringe, Scissors,
} from 'lucide-react';

import { useApp } from '@/contexts/AppContext';
import { TopNav, Footer, ToastContainer, SearchOverlay, Badge, Tabs } from '@/components/ui/SharedComponents';
import { MedicalCard, SectionHeader, StatusBadge, HealthMetricCard } from '@/components/ui/PagePrimitives';
import {
  ResourceViewer,
  MappingTable,
  ImportWizard,
  ExportConfigPanel,
  FHIRBadge,
} from '@/components/fhir/FHIRComponents';
import { useFHIRBridge } from '@/hooks/useFHIRBridge';
import { FHIR_RESOURCE_TYPES, BRAND, EXTENDED_STATUS_STYLES } from '@/lib/constants';
import { formatNumber, formatDate, timeAgo, truncateAddress } from '@/lib/utils';
import type { FHIRResourceType, FHIRExportConfig } from '@/types';

// ============================================================
// Constants
// ============================================================

const SEED = 1110;

const TAB_ITEMS = [
  { id: 'import', label: 'Import' },
  { id: 'export', label: 'Export' },
  { id: 'mappings', label: 'Mappings' },
  { id: 'history', label: 'History' },
];

const STATUS_ICON_MAP: Record<string, React.ReactNode> = {
  completed: <CheckCircle className="w-4 h-4 text-emerald-500" />,
  processing: <Clock className="w-4 h-4 text-brand-500 animate-spin" />,
  failed: <XCircle className="w-4 h-4 text-red-500" />,
  pending: <Clock className="w-4 h-4 text-amber-500" />,
};

// ============================================================
// Main Page
// ============================================================

export default function FHIRBridgePage() {
  const { wallet } = useApp();
  const fhir = useFHIRBridge();

  const [activeTab, setActiveTab] = useState('import');

  return (
    <>
      <TopNav />
      <SearchOverlay />
      <ToastContainer />

      <main id="main-content" className="flex-1">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">

          {/* ---- Header ---- */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Link2 className="w-6 h-6 text-brand-600" />
                <h1 className="text-2xl font-bold text-slate-900">FHIR Bridge</h1>
              </div>
              <p className="text-sm text-slate-500">
                Import and export FHIR R4 resources with automatic mapping to Shiora health records
              </p>
            </div>
          </div>

          {/* ---- Stats ---- */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
            <HealthMetricCard
              icon={<Database className="w-5 h-5" />}
              label="FHIR Resources"
              value={fhir.resources.length.toString()}
              unit="imported"
              sparklineData={[4, 6, 8, 8, 10, 10, 12, 12]}
              sparklineColor={BRAND.sky}
            />
            <HealthMetricCard
              icon={<ArrowRight className="w-5 h-5" />}
              label="Mapped"
              value={fhir.totalMapped.toString()}
              unit="resources"
              trend={15}
              trendLabel="this month"
              sparklineData={[2, 3, 5, 6, 7, 8, 8, 9]}
              sparklineColor="#10b981"
            />
            <HealthMetricCard
              icon={<AlertTriangle className="w-5 h-5" />}
              label="Unmapped"
              value={fhir.totalUnmapped.toString()}
              unit="pending"
              sparklineData={[5, 4, 3, 3, 3, 3, 3, 3]}
              sparklineColor="#fb923c"
            />
            <HealthMetricCard
              icon={<Code className="w-5 h-5" />}
              label="Mappings"
              value={fhir.mappings.length.toString()}
              unit="configured"
              sparklineData={[6, 6, 7, 7, 8, 8, 8, 8]}
              sparklineColor="#a78bfa"
            />
          </div>

          {/* ---- Tabs ---- */}
          <Tabs tabs={TAB_ITEMS} activeTab={activeTab} onChange={setActiveTab} className="mb-6" />

          {/* ============================================================ */}
          {/* Import Tab */}
          {/* ============================================================ */}
          {activeTab === 'import' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Import Wizard */}
              <ImportWizard
                onImport={(source) => fhir.importMutation.mutate(source)}
                isLoading={fhir.importMutation.isLoading}
              />

              {/* Recent Imports */}
              <div>
                <h3 className="text-base font-semibold text-slate-900 mb-4">Recent Imports</h3>
                <div className="space-y-3">
                  {fhir.importJobs.map((job) => (
                    <MedicalCard key={job.id}>
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="text-sm font-medium text-slate-900">{job.source}</p>
                          <p className="text-xs text-slate-500">{formatDate(job.startedAt)}</p>
                        </div>
                        <StatusBadge status={job.status} styles={EXTENDED_STATUS_STYLES} />
                      </div>
                      <div className="flex items-center gap-4 text-xs">
                        <span className="text-slate-500">
                          {job.processedCount}/{job.resourceCount} processed
                        </span>
                        {job.failedCount > 0 && (
                          <span className="text-red-600">{job.failedCount} failed</span>
                        )}
                      </div>
                      {job.status === 'processing' && (
                        <div className="mt-2 w-full bg-slate-100 rounded-full h-1.5">
                          <div
                            className="bg-brand-500 h-1.5 rounded-full transition-all"
                            style={{ width: `${(job.processedCount / job.resourceCount) * 100}%` }}
                          />
                        </div>
                      )}
                      {job.errors.length > 0 && (
                        <div className="mt-2 p-2 bg-red-50 rounded-lg">
                          <p className="text-xs text-red-700">{job.errors[0]}</p>
                        </div>
                      )}
                    </MedicalCard>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* Export Tab */}
          {/* ============================================================ */}
          {activeTab === 'export' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Export Config */}
              <ExportConfigPanel
                onExport={(config) => fhir.exportMutation.mutate(config)}
                isLoading={fhir.exportMutation.isLoading}
              />

              {/* Existing Export Configs */}
              <div>
                <h3 className="text-base font-semibold text-slate-900 mb-4">Export History</h3>
                <div className="space-y-3">
                  {fhir.exportConfigs.map((config) => (
                    <MedicalCard key={config.id}>
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="text-sm font-medium text-slate-900">{config.destination}</p>
                          <p className="text-xs text-slate-500">
                            {config.resourceTypes.length} types | {config.format.toUpperCase()} format
                          </p>
                        </div>
                        <Badge variant="info">{config.format.toUpperCase()}</Badge>
                      </div>
                      <div className="flex flex-wrap gap-1 mb-2">
                        {config.resourceTypes.slice(0, 3).map((type) => (
                          <FHIRBadge key={type} resourceType={type} />
                        ))}
                        {config.resourceTypes.length > 3 && (
                          <Badge variant="neutral">+{config.resourceTypes.length - 3}</Badge>
                        )}
                      </div>
                      {config.lastExportAt && (
                        <p className="text-xs text-slate-400">Last export: {timeAgo(config.lastExportAt)}</p>
                      )}
                    </MedicalCard>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* Mappings Tab */}
          {/* ============================================================ */}
          {activeTab === 'mappings' && (
            <>
              <SectionHeader
                title="Resource Mappings"
                subtitle="FHIR R4 to Shiora record type mappings"
                size="sm"
              />
              <MappingTable mappings={fhir.mappings} />

              {/* Resource Grid */}
              <div className="mt-8">
                <SectionHeader
                  title="Imported Resources"
                  subtitle="Browse all FHIR resources in the system"
                  size="sm"
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {fhir.resources.map((resource) => (
                    <ResourceViewer key={resource.id} resource={resource} />
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ============================================================ */}
          {/* History Tab */}
          {/* ============================================================ */}
          {activeTab === 'history' && (
            <>
              <SectionHeader
                title="Import / Export History"
                subtitle="All FHIR operations with status and timestamps"
                size="sm"
              />
              <MedicalCard padding={false}>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase">Type</th>
                        <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase">Source / Destination</th>
                        <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase">Resources</th>
                        <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                        <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {fhir.importJobs.map((job) => (
                        <tr key={job.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-5 py-3">
                            <Badge variant="info">
                              <Upload className="w-3 h-3 mr-1" />
                              Import
                            </Badge>
                          </td>
                          <td className="px-5 py-3 text-slate-700">{job.source}</td>
                          <td className="px-5 py-3 text-slate-700">
                            {job.processedCount}/{job.resourceCount}
                            {job.failedCount > 0 && (
                              <span className="text-red-500 ml-1">({job.failedCount} failed)</span>
                            )}
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-1.5">
                              {STATUS_ICON_MAP[job.status]}
                              <span className="capitalize text-slate-700">{job.status}</span>
                            </div>
                          </td>
                          <td className="px-5 py-3 text-slate-500">{formatDate(job.startedAt)}</td>
                        </tr>
                      ))}
                      {fhir.exportConfigs.map((config) => (
                        <tr key={config.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-5 py-3">
                            <Badge variant="success">
                              <Download className="w-3 h-3 mr-1" />
                              Export
                            </Badge>
                          </td>
                          <td className="px-5 py-3 text-slate-700">{config.destination}</td>
                          <td className="px-5 py-3 text-slate-700">{config.resourceTypes.length} types</td>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-1.5">
                              <CheckCircle className="w-4 h-4 text-emerald-500" />
                              <span className="text-slate-700">Completed</span>
                            </div>
                          </td>
                          <td className="px-5 py-3 text-slate-500">
                            {config.lastExportAt ? formatDate(config.lastExportAt) : 'N/A'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </MedicalCard>
            </>
          )}

        </div>
      </main>

      <Footer />
    </>
  );
}
