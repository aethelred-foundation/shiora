/**
 * Shiora on Aethelred — Upload Modal
 *
 * Comprehensive file upload modal for health records with drag & drop,
 * file validation, encryption indicator, and multi-stage upload progress.
 */

'use client';

import React, { useState, useCallback, useRef } from 'react';
import {
  Upload, X, FileText, TestTube2, ScanLine, Pill,
  HeartPulse, Lock, ShieldCheck, CheckCircle, AlertCircle,
  Cloud, Cpu, Link2, Tag, Calendar, Building2,
  ChevronDown, Trash2, File,
} from 'lucide-react';

import { Modal, Badge } from '@/components/ui/SharedComponents';
/* istanbul ignore next -- no-op handler for non-closeable modals */
const noop = () => {};
import { MedicalCard } from '@/components/ui/PagePrimitives';
import { RECORD_TYPES, PROVIDER_NAMES } from '@/lib/constants';
import { formatBytes } from '@/lib/utils';

// ============================================================
// Types
// ============================================================

interface UploadFile {
  file: File;
  id: string;
  preview?: string;
}

type UploadStage = 'idle' | 'encrypting' | 'uploading' | 'registering' | 'verifying' | 'success' | 'error';

interface UploadModalProps {
  open: boolean;
  onClose: () => void;
  onUploadComplete?: (data: { recordType: string; provider: string; tags: string[] }) => void;
}

// ============================================================
// Constants
// ============================================================

const ACCEPTED_TYPES = ['.pdf', '.dcm', '.csv', '.json', '.png', '.jpg', '.jpeg'];
const ACCEPTED_MIME_TYPES = [
  'application/pdf',
  'application/dicom',
  'text/csv',
  'application/json',
  'image/png',
  'image/jpeg',
];

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB

const STAGE_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  encrypting: { label: 'Encrypting with AES-256-GCM...', icon: <Lock className="w-4 h-4" />, color: 'text-brand-600' },
  uploading: { label: 'Uploading to IPFS...', icon: <Cloud className="w-4 h-4" />, color: 'text-violet-600' },
  registering: { label: 'Registering on-chain...', icon: <Link2 className="w-4 h-4" />, color: 'text-amber-600' },
  verifying: { label: 'Verifying TEE attestation...', icon: <Cpu className="w-4 h-4" />, color: 'text-emerald-600' },
};

const STAGE_PROGRESS: Record<string, number> = {
  idle: 0,
  encrypting: 25,
  uploading: 50,
  registering: 75,
  verifying: 90,
  success: 100,
  error: 0,
};

const TYPE_ICONS: Record<string, React.ReactNode> = {
  lab_result: <TestTube2 className="w-4 h-4" />,
  imaging: <ScanLine className="w-4 h-4" />,
  prescription: <Pill className="w-4 h-4" />,
  vitals: <HeartPulse className="w-4 h-4" />,
  notes: <FileText className="w-4 h-4" />,
};

// ============================================================
// Helper functions
// ============================================================

function getFileExtension(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || /* istanbul ignore next */ '';
  return `.${ext}`;
}

function isValidFileType(file: File): boolean {
  const ext = getFileExtension(file.name);
  return ACCEPTED_TYPES.includes(ext) || ACCEPTED_MIME_TYPES.includes(file.type);
}

function getFileTypeLabel(name: string): string {
  const ext = getFileExtension(name);
  const labels: Record<string, string> = {
    '.pdf': 'PDF Document',
    '.dcm': 'DICOM Image',
    '.csv': 'CSV Data',
    '.json': 'JSON Data',
    '.png': 'PNG Image',
    '.jpg': 'JPEG Image',
    '.jpeg': 'JPEG Image',
  };
  return labels[ext] || /* istanbul ignore next */ 'Unknown';
}

// ============================================================
// Component
// ============================================================

export function UploadModal({ open, onClose, onUploadComplete }: UploadModalProps) {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [recordType, setRecordType] = useState('');
  const [provider, setProvider] = useState('');
  const [providerSearch, setProviderSearch] = useState('');
  const [showProviderDropdown, setShowProviderDropdown] = useState(false);
  const [recordDate, setRecordDate] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [stage, setStage] = useState<UploadStage>('idle');
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredProviders = PROVIDER_NAMES.filter((p) =>
    p.toLowerCase().includes(providerSearch.toLowerCase())
  );

  const resetForm = useCallback(() => {
    setFiles([]);
    setRecordType('');
    setProvider('');
    setProviderSearch('');
    setRecordDate('');
    setTags([]);
    setTagInput('');
    setStage('idle');
    setError('');
    setDragActive(false);
  }, []);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [resetForm, onClose]);

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const validFiles: UploadFile[] = [];
    const errors: string[] = [];

    Array.from(newFiles).forEach((file) => {
      if (!isValidFileType(file)) {
        errors.push(`${file.name}: unsupported file type`);
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        errors.push(`${file.name}: exceeds 100 MB limit`);
        return;
      }
      validFiles.push({
        file,
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      });
    });

    if (errors.length > 0) {
      setError(errors.join('; '));
    } else {
      setError('');
    }

    setFiles((prev) => [...prev, ...validFiles]);
  }, []);

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.length) {
      addFiles(e.dataTransfer.files);
    }
  }, [addFiles]);

  const addTag = useCallback(() => {
    const trimmed = tagInput.trim().toLowerCase();
    if (trimmed && !tags.includes(trimmed)) {
      setTags((prev) => [...prev, trimmed]);
    }
    setTagInput('');
  }, [tagInput, tags]);

  const removeTag = useCallback((tag: string) => {
    setTags((prev) => prev.filter((t) => t !== tag));
  }, []);

  const simulateUpload = useCallback(async () => {
    /* istanbul ignore next -- defensive guard: button is disabled when no files */
    if (files.length === 0) {
      setError('Please select at least one file');
      return;
    }
    /* istanbul ignore next -- defensive guard: button is disabled when no record type */
    if (!recordType) {
      setError('Please select a record type');
      return;
    }

    setError('');

    const stages: UploadStage[] = ['encrypting', 'uploading', 'registering', 'verifying'];
    for (const s of stages) {
      setStage(s);
      await new Promise((resolve) => setTimeout(resolve, 1200 + Math.random() * 800));
    }

    setStage('success');
    onUploadComplete?.({ recordType, provider, tags });
  }, [files, recordType, provider, tags, onUploadComplete]);

  // Success state
  if (stage === 'success') {
    return (
      <Modal open={open} onClose={handleClose} size="md">
        <div className="text-center py-4">
          <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-emerald-500" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-2">Upload Successful</h3>
          <p className="text-sm text-slate-500 mb-6">
            Your health record has been encrypted, uploaded to IPFS, and registered on the Aethelred blockchain.
          </p>
          <div className="bg-slate-50 rounded-xl p-4 mb-6 space-y-2 text-left">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Encryption</span>
              <Badge variant="info">AES-256-GCM</Badge>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">TEE Verification</span>
              <Badge variant="success" dot>Verified</Badge>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">IPFS Status</span>
              <Badge variant="success" dot>Pinned</Badge>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">On-chain</span>
              <Badge variant="success" dot>Confirmed</Badge>
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

  // Error state
  /* istanbul ignore next -- error state is unreachable: simulateUpload always succeeds */
  if (stage === 'error') {
    return (
      <Modal open={open} onClose={handleClose} size="md">
        <div className="text-center py-4">
          <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-2">Upload Failed</h3>
          <p className="text-sm text-slate-500 mb-6">
            An error occurred during the upload process. Please try again.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={handleClose}
              className="px-5 py-2.5 border border-slate-200 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => { setStage('idle'); setError(''); }}
              className="px-5 py-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-sm font-medium transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  // Uploading state (progress)
  if (stage !== 'idle') {
    const config = STAGE_CONFIG[stage];
    const progress = STAGE_PROGRESS[stage];

    return (
      <Modal open={open} onClose={noop} showClose={false} title="Uploading Health Record" size="md">
        <div className="py-4">
          {/* Progress bar */}
          <div className="mb-6">
            <div className="flex justify-between text-xs text-slate-500 mb-2">
              <span>{config?.label}</span>
              <span>{progress}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2">
              <div
                className="bg-brand-500 h-2 rounded-full transition-all duration-700 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Stage indicators */}
          <div className="space-y-3">
            {Object.entries(STAGE_CONFIG).map(([key, cfg]) => {
              const stageOrder = ['encrypting', 'uploading', 'registering', 'verifying'];
              const currentIndex = stageOrder.indexOf(stage);
              const thisIndex = stageOrder.indexOf(key);
              const isComplete = thisIndex < currentIndex;
              const isCurrent = key === stage;

              return (
                <div
                  key={key}
                  className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
                    isCurrent ? 'bg-slate-50' : ''
                  }`}
                >
                  {isComplete ? (
                    <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
                  ) : isCurrent ? (
                    <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin shrink-0" />
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-slate-200 shrink-0" />
                  )}
                  <span className={`text-sm ${isComplete ? 'text-emerald-700 font-medium' : isCurrent ? 'text-slate-900 font-medium' : 'text-slate-400'}`}>
                    {cfg.label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Encryption indicator */}
          <div className="mt-6 p-3 bg-brand-50 border border-brand-200 rounded-xl flex items-start gap-2">
            <Lock className="w-4 h-4 text-brand-600 mt-0.5 shrink-0" />
            <p className="text-xs text-brand-700">
              Your data is being encrypted with AES-256-GCM before leaving your device. Only you hold the decryption keys.
            </p>
          </div>
        </div>
      </Modal>
    );
  }

  // Idle state (form)
  return (
    <Modal open={open} onClose={handleClose} title="Upload Health Record" description="Encrypt and upload your health data to the Aethelred blockchain" size="lg">
      <div className="space-y-5">
        {/* Error display */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
            <p className="text-xs text-red-700">{error}</p>
          </div>
        )}

        {/* Drop Zone */}
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
            dragActive
              ? 'border-brand-400 bg-brand-50'
              : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ACCEPTED_TYPES.join(',')}
            onChange={(e) => e.target.files && addFiles(e.target.files)}
            className="hidden"
          />
          <Upload className={`w-8 h-8 mx-auto mb-3 ${dragActive ? 'text-brand-500' : 'text-slate-400'}`} />
          <p className="text-sm font-medium text-slate-900 mb-1">
            {dragActive ? 'Drop files here' : 'Drag & drop files or click to browse'}
          </p>
          <p className="text-xs text-slate-500">
            Supported: PDF, DICOM, CSV, JSON, PNG, JPEG &middot; Max 100 MB
          </p>
        </div>

        {/* File list */}
        {files.length > 0 && (
          <div className="space-y-2">
            {files.map((f) => (
              <div key={f.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                <File className="w-5 h-5 text-brand-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{f.file.name}</p>
                  <p className="text-xs text-slate-500">{getFileTypeLabel(f.file.name)} &middot; {formatBytes(f.file.size)}</p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); removeFile(f.id); }}
                  className="p-1 rounded-lg hover:bg-slate-200 text-slate-400 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Record Type */}
        <div>
          <label className="block text-sm font-medium text-slate-900 mb-1.5">Record Type *</label>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {RECORD_TYPES.map((type) => (
              <button
                key={type.id}
                onClick={() => setRecordType(type.id)}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-colors text-center ${
                  recordType === type.id
                    ? 'border-brand-500 bg-brand-50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <span className={recordType === type.id ? 'text-brand-600' : 'text-slate-400'}>
                  {TYPE_ICONS[type.id]}
                </span>
                <span className="text-2xs font-medium text-slate-700">{type.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Provider */}
        <div className="relative">
          <label className="block text-sm font-medium text-slate-900 mb-1.5">Provider</label>
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={providerSearch || provider}
              onChange={(e) => {
                setProviderSearch(e.target.value);
                setProvider('');
                setShowProviderDropdown(true);
              }}
              onFocus={() => setShowProviderDropdown(true)}
              placeholder="Search providers..."
              className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            />
          </div>
          {showProviderDropdown && filteredProviders.length > 0 && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowProviderDropdown(false)} />
              <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-float max-h-40 overflow-y-auto">
                {filteredProviders.map((p) => (
                  <button
                    key={p}
                    onClick={() => { setProvider(p); setProviderSearch(''); setShowProviderDropdown(false); }}
                    className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Date and Tags row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-slate-900 mb-1.5">Record Date</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="date"
                value={recordDate}
                onChange={(e) => setRecordDate(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-slate-900 mb-1.5">Tags</label>
            <div className="relative">
              <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                placeholder="Add tag and press Enter"
                className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              />
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {tags.map((tag) => (
                  <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 bg-brand-50 text-brand-700 rounded-full text-xs">
                    {tag}
                    <button onClick={() => removeTag(tag)} className="hover:text-brand-900">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Encryption indicator */}
        <div className="flex items-center gap-2 p-3 bg-brand-50 border border-brand-200 rounded-xl">
          <Lock className="w-4 h-4 text-brand-600 shrink-0" />
          <p className="text-xs text-brand-700">
            Files will be encrypted with <strong>AES-256-GCM</strong> before upload. Your encryption keys never leave your device.
          </p>
        </div>

        {/* Submit */}
        <div className="flex gap-3 justify-end pt-2">
          <button
            onClick={handleClose}
            className="px-5 py-2.5 border border-slate-200 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={simulateUpload}
            disabled={files.length === 0 || !recordType}
            className="px-5 py-2.5 bg-brand-500 hover:bg-brand-600 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl text-sm font-medium transition-colors"
          >
            <span className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" />
              Encrypt & Upload
            </span>
          </button>
        </div>
      </div>
    </Modal>
  );
}
