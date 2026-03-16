/**
 * Shiora on Aethelred — Health Records Page
 *
 * Encrypted health record management with IPFS storage,
 * AES-256 encryption, and TEE-verified integrity proofs.
 */

'use client';

import { useState, useMemo } from 'react';
import {
  FolderLock, Upload, Search, Filter, Download, Eye,
  TestTube2, ScanLine, Pill, HeartPulse, FileText,
  Lock, ShieldCheck, Clock, HardDrive, Layers,
  ChevronDown, ChevronRight, CheckCircle, ArrowUpDown,
  Hash, ExternalLink, Grid3X3, List,
} from 'lucide-react';

import { useApp } from '@/contexts/AppContext';
import { TopNav, Footer, ToastContainer, SearchOverlay, Badge, Tabs, Modal } from '@/components/ui/SharedComponents';
import {
  MedicalCard, HealthMetricCard, SectionHeader, StatusBadge,
  EncryptionBadge, TEEBadge, TruncatedHash, CopyButton,
} from '@/components/ui/PagePrimitives';
import { BRAND, RECORD_TYPES, PROVIDER_NAMES } from '@/lib/constants';
import {
  seededRandom, seededInt, seededHex, seededPick, seededAddress,
  formatNumber, formatBytes, formatDate, formatDateTime,
  timeAgo, generateCID, generateTxHash, generateAttestation,
} from '@/lib/utils';

// ============================================================
// Types
// ============================================================

interface HealthRecord {
  id: string;
  type: string;
  label: string;
  description: string;
  date: number;
  uploadDate: number;
  encrypted: boolean;
  encryption: string;
  cid: string;
  txHash: string;
  attestation: string;
  size: number;
  provider: string;
  status: 'Verified' | 'Pinning' | 'Pinned' | 'Processing';
  ipfsNodes: number;
  tags: string[];
}

// ============================================================
// Mock Data
// ============================================================

const SEED = 200;

const TYPE_DESCRIPTIONS: Record<string, string[]> = {
  lab_result: ['Complete Blood Count', 'Thyroid Panel (TSH, T3, T4)', 'Lipid Panel', 'Hemoglobin A1C', 'Hormone Panel (Estradiol, Progesterone)', 'Comprehensive Metabolic Panel', 'Iron Studies', 'Vitamin D Level'],
  imaging: ['Pelvic Ultrasound', 'Mammogram Bilateral', 'Transvaginal Sonogram', 'Bone Density Scan', 'MRI Pelvis', 'HSG Report'],
  prescription: ['Estradiol 2mg Oral', 'Progesterone 200mg', 'Levothyroxine 50mcg', 'Prenatal Vitamins', 'Metformin 500mg'],
  vitals: ['Blood Pressure Reading', 'Weight & BMI Check', 'Heart Rate Monitoring', 'Oxygen Saturation', 'Temperature Log'],
  notes: ['Annual Exam Notes', 'Follow-up Visit Summary', 'Pre-conception Consultation', 'Specialist Referral', 'Treatment Plan Update'],
};

const TAGS_POOL = ['routine', 'urgent', 'follow-up', 'annual', 'specialist', 'lab', 'imaging', 'medication', 'monitoring', 'fertility', 'prenatal', 'postpartum'];

function generateRecords(): HealthRecord[] {
  const types = ['lab_result', 'imaging', 'prescription', 'vitals', 'notes'] as const;
  const statuses: HealthRecord['status'][] = ['Verified', 'Pinned', 'Pinning', 'Processing'];

  return Array.from({ length: 24 }, (_, i) => {
    const type = seededPick(SEED + i * 7, types);
    const descriptions = TYPE_DESCRIPTIONS[type] ||
      /* istanbul ignore next -- type always found in TYPE_DESCRIPTIONS for seeded data */
      ['Record'];
    return {
      id: `rec-${seededHex(SEED + i * 100, 12)}`,
      type,
      label: seededPick(SEED + i * 3, descriptions),
      description: `Encrypted health record processed via TEE enclave at block ${2847000 + seededInt(SEED + i * 5, 0, 500)}`,
      date: Date.now() - i * 86400000 * (1 + seededRandom(SEED + i) * 3),
      uploadDate: Date.now() - i * 86400000 * (1 + seededRandom(SEED + i) * 3) + 3600000,
      encrypted: true,
      encryption: 'AES-256-GCM',
      cid: generateCID(SEED + i * 50),
      txHash: generateTxHash(SEED + i * 30),
      attestation: generateAttestation(SEED + i * 40),
      size: seededInt(SEED + i * 11, 20, 2000) * 1024,
      provider: seededPick(SEED + i * 13, PROVIDER_NAMES),
      status: i < 2 ? 'Processing' : i < 4 ? 'Pinning' : seededPick(SEED + i * 9, ['Verified', 'Pinned'] as const),
      ipfsNodes: seededInt(SEED + i * 17, 12, 64),
      tags: [TAGS_POOL[i % TAGS_POOL.length], TAGS_POOL[(i + 3) % TAGS_POOL.length]],
    };
  });
}

// ============================================================
// Sub-components
// ============================================================

const ICON_MAP: Record<string, React.ReactNode> = {
  lab_result: <TestTube2 className="w-4 h-4" />,
  imaging: <ScanLine className="w-4 h-4" />,
  prescription: <Pill className="w-4 h-4" />,
  vitals: <HeartPulse className="w-4 h-4" />,
  notes: <FileText className="w-4 h-4" />,
};

const TYPE_COLORS: Record<string, string> = {
  lab_result: 'bg-brand-50 text-brand-600',
  imaging: 'bg-violet-50 text-violet-600',
  prescription: 'bg-emerald-50 text-emerald-600',
  vitals: 'bg-rose-50 text-rose-600',
  notes: 'bg-amber-50 text-amber-600',
};

const TYPE_LABELS: Record<string, string> = {
  lab_result: 'Lab Result',
  imaging: 'Imaging',
  prescription: 'Prescription',
  vitals: 'Vitals',
  notes: 'Clinical Notes',
};

function RecordDetailModal({ record, open, onClose }: { record: HealthRecord | null; open: boolean; onClose: () => void }) {
  if (!record) return null;

  return (
    <Modal open={open} onClose={onClose} title="Record Details" size="lg">
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-start gap-4">
          <div className={`w-12 h-12 rounded-xl ${TYPE_COLORS[record.type]} flex items-center justify-center`}>
            {ICON_MAP[record.type]}
          </div>
          <div className="flex-1">
            <h4 className="text-lg font-semibold text-slate-900">{record.label}</h4>
            <p className="text-sm text-slate-500">{record.provider}</p>
            <div className="flex items-center gap-2 mt-2">
              <StatusBadge status={record.status} />
              <EncryptionBadge type={record.encryption} />
              <TEEBadge verified />
            </div>
          </div>
        </div>

        {/* Metadata Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-xs text-slate-400 mb-1">Record Date</p>
            <p className="text-sm font-medium text-slate-900">{formatDateTime(record.date)}</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-xs text-slate-400 mb-1">Upload Date</p>
            <p className="text-sm font-medium text-slate-900">{formatDateTime(record.uploadDate)}</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-xs text-slate-400 mb-1">File Size</p>
            <p className="text-sm font-medium text-slate-900">{formatBytes(record.size)}</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-xs text-slate-400 mb-1">IPFS Nodes</p>
            <p className="text-sm font-medium text-slate-900">{record.ipfsNodes} nodes</p>
          </div>
        </div>

        {/* Cryptographic Details */}
        <div className="space-y-3">
          <h5 className="text-sm font-semibold text-slate-900">Cryptographic Details</h5>
          <div className="bg-slate-50 rounded-xl p-4 space-y-3">
            <div>
              <p className="text-xs text-slate-400 mb-1">IPFS CID</p>
              <TruncatedHash hash={record.cid} startLen={12} endLen={8} />
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-1">Transaction Hash</p>
              <TruncatedHash hash={record.txHash} startLen={12} endLen={8} />
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-1">TEE Attestation</p>
              <TruncatedHash hash={record.attestation} startLen={12} endLen={8} />
            </div>
          </div>
        </div>

        {/* Tags */}
        <div>
          <h5 className="text-sm font-semibold text-slate-900 mb-2">Tags</h5>
          <div className="flex flex-wrap gap-2">
            {record.tags.map((tag) => (
              <Badge key={tag} variant="info">{tag}</Badge>
            ))}
          </div>
        </div>

        {/* Security Notice */}
        <div className="p-3 bg-emerald-50 rounded-xl flex items-start gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
          <p className="text-xs text-emerald-700">
            This record is encrypted with {record.encryption} and stored on IPFS across {record.ipfsNodes} nodes.
            The TEE attestation proves this record was processed inside an Intel SGX enclave.
          </p>
        </div>
      </div>
    </Modal>
  );
}

// ============================================================
// Main Page
// ============================================================

export default function RecordsPage() {
  const { healthData } = useApp();

  const records = useMemo(() => generateRecords(), []);

  const [searchQuery, setSearchQuery] = useState('');
  const [activeType, setActiveType] = useState('all');
  const [sortField, setSortField] = useState<'date' | 'label' | 'size'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [selectedRecord, setSelectedRecord] = useState<HealthRecord | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const typeTabs = [
    { id: 'all', label: 'All', count: records.length },
    { id: 'lab_result', label: 'Labs', count: records.filter((r) => r.type === 'lab_result').length },
    { id: 'imaging', label: 'Imaging', count: records.filter((r) => r.type === 'imaging').length },
    { id: 'prescription', label: 'Rx', count: records.filter((r) => r.type === 'prescription').length },
    { id: 'vitals', label: 'Vitals', count: records.filter((r) => r.type === 'vitals').length },
    { id: 'notes', label: 'Notes', count: records.filter((r) => r.type === 'notes').length },
  ];

  const filtered = useMemo(() => {
    let result = records;
    if (activeType !== 'all') result = result.filter((r) => r.type === activeType);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((r) =>
        r.label.toLowerCase().includes(q) ||
        r.provider.toLowerCase().includes(q) ||
        r.tags.some((t) => t.includes(q))
      );
    }
    result = [...result].sort((a, b) => {
      const mul = sortDir === 'asc' ? 1 : -1;
      if (sortField === 'date') return mul * (a.date - b.date);
      if (sortField === 'size') return mul * (a.size - b.size);
      return mul * a.label.localeCompare(b.label);
    });
    return result;
  }, [records, activeType, searchQuery, sortField, sortDir]);

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortDir('desc'); }
  };

  const openDetail = (record: HealthRecord) => {
    setSelectedRecord(record);
    setDetailOpen(true);
  };

  return (
    <>
      <TopNav />
      <SearchOverlay />
      <ToastContainer />

      <main id="main-content" className="flex-1">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">

          {/* ─── Header ─── */}
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <FolderLock className="w-6 h-6 text-brand-500" />
                <h1 className="text-2xl font-bold text-slate-900">Health Records</h1>
              </div>
              <p className="text-sm text-slate-500">
                AES-256 encrypted, IPFS-pinned, and TEE-verified on the Aethelred blockchain
              </p>
            </div>
            <button className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-500 text-white rounded-xl font-medium text-sm hover:bg-brand-600 transition-colors shadow-sm shrink-0">
              <Upload className="w-4 h-4" />
              Upload Record
            </button>
          </div>

          {/* ─── Stats Bar ─── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <MedicalCard>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center">
                  <Layers className="w-5 h-5 text-brand-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Total Records</p>
                  <p className="text-xl font-bold text-slate-900">{healthData.totalRecords}</p>
                </div>
              </div>
            </MedicalCard>
            <MedicalCard>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                  <Lock className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Encrypted</p>
                  <p className="text-xl font-bold text-slate-900">{healthData.encryptedRecords}</p>
                </div>
              </div>
            </MedicalCard>
            <MedicalCard>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center">
                  <HardDrive className="w-5 h-5 text-violet-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Storage Used</p>
                  <p className="text-xl font-bold text-slate-900">{formatBytes(healthData.storageUsed)}</p>
                </div>
              </div>
            </MedicalCard>
            <MedicalCard>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                  <Hash className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">IPFS Nodes</p>
                  <p className="text-xl font-bold text-slate-900">{healthData.ipfsNodes}</p>
                </div>
              </div>
            </MedicalCard>
          </div>

          {/* ─── Filters ─── */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
            <Tabs tabs={typeTabs} activeTab={activeType} onChange={setActiveType} />
            <div className="flex items-center gap-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search records..."
                  className="pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-brand-500 focus:border-transparent w-56"
                />
              </div>
              {/* View mode */}
              <div className="flex bg-slate-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
                  aria-label="List view"
                >
                  <List className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
                  aria-label="Grid view"
                >
                  <Grid3X3 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* ─── Records ─── */}
          {viewMode === 'list' ? (
            <MedicalCard padding={false} hover={false}>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-100">
                  <thead>
                    <tr className="bg-slate-50/80">
                      <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Type</th>
                      <th
                        className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-700"
                        onClick={() => toggleSort('label')}
                      >
                        <span className="inline-flex items-center gap-1">Record <ArrowUpDown className="w-3 h-3" /></span>
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Provider</th>
                      <th
                        className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-700"
                        onClick={() => toggleSort('date')}
                      >
                        <span className="inline-flex items-center gap-1">Date <ArrowUpDown className="w-3 h-3" /></span>
                      </th>
                      <th
                        className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-700"
                        onClick={() => toggleSort('size')}
                      >
                        <span className="inline-flex items-center gap-1">Size <ArrowUpDown className="w-3 h-3" /></span>
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                      <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Security</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filtered.map((record) => (
                      <tr
                        key={record.id}
                        className="hover:bg-slate-50 cursor-pointer transition-colors"
                        onClick={() => openDetail(record)}
                      >
                        <td className="px-5 py-3">
                          <div className={`w-8 h-8 rounded-lg ${TYPE_COLORS[record.type]} flex items-center justify-center`}>
                            {ICON_MAP[record.type]}
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <div>
                            <p className="text-sm font-medium text-slate-900">{record.label}</p>
                            <p className="text-xs text-slate-400">{TYPE_LABELS[record.type]}</p>
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <p className="text-sm text-slate-600 max-w-[200px] truncate">{record.provider}</p>
                        </td>
                        <td className="px-5 py-3">
                          <p className="text-sm text-slate-600">{formatDate(record.date)}</p>
                        </td>
                        <td className="px-5 py-3">
                          <p className="text-sm text-slate-600">{formatBytes(record.size)}</p>
                        </td>
                        <td className="px-5 py-3">
                          <StatusBadge status={record.status} />
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-1.5">
                            <EncryptionBadge type="AES-256" />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filtered.length === 0 && (
                <div className="py-12 text-center">
                  <FolderLock className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-sm text-slate-500">No records match your filters</p>
                </div>
              )}
            </MedicalCard>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((record) => (
                <MedicalCard key={record.id} onClick={() => openDetail(record)} className="cursor-pointer">
                  <div className="flex items-start justify-between mb-3">
                    <div className={`w-10 h-10 rounded-xl ${TYPE_COLORS[record.type]} flex items-center justify-center`}>
                      {ICON_MAP[record.type]}
                    </div>
                    <StatusBadge status={record.status} />
                  </div>
                  <h4 className="text-sm font-semibold text-slate-900 mb-1">{record.label}</h4>
                  <p className="text-xs text-slate-500 mb-3 truncate">{record.provider}</p>
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>{formatDate(record.date)}</span>
                    <span>{formatBytes(record.size)}</span>
                  </div>
                  <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2">
                    <EncryptionBadge type="AES-256" />
                    <TEEBadge verified />
                  </div>
                </MedicalCard>
              ))}
              {filtered.length === 0 && (
                <div className="col-span-full py-12 text-center">
                  <FolderLock className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-sm text-slate-500">No records match your filters</p>
                </div>
              )}
            </div>
          )}

          {/* ─── Result count ─── */}
          <div className="mt-4 text-xs text-slate-400 text-center">
            Showing {filtered.length} of {records.length} records
          </div>
        </div>
      </main>

      <Footer />

      {/* Detail Modal */}
      <RecordDetailModal record={selectedRecord} open={detailOpen} onClose={() => setDetailOpen(false)} />
    </>
  );
}
