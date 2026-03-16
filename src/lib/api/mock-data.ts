// ============================================================
// Shiora on Aethelred — Centralized Mock Data Generators
// Deterministic data using seeded random for API consistency
// ============================================================

import {
  seededRandom, seededInt, seededHex, seededPick, seededAddress,
  generateCID, generateTxHash, generateAttestation,
} from '@/lib/utils';
import {
  PROVIDER_NAMES, SPECIALTIES, DATA_SCOPES,
  AI_MODELS, TEE_PLATFORMS,
} from '@/lib/constants';

// ────────────────────────────────────────────────────────────
// Record Types
// ────────────────────────────────────────────────────────────

export interface MockHealthRecord {
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
  deleted: boolean;
  ownerAddress: string;
  blockHeight: number;
}

export interface MockAccessGrant {
  id: string;
  provider: string;
  specialty: string;
  address: string;
  status: 'Active' | 'Expired' | 'Revoked' | 'Pending';
  scope: string;
  grantedAt: number;
  expiresAt: number;
  lastAccess: number | null;
  accessCount: number;
  txHash: string;
  attestation: string;
  canView: boolean;
  canDownload: boolean;
  canShare: boolean;
  ownerAddress: string;
}

export interface MockAuditEntry {
  id: string;
  provider: string;
  action: string;
  timestamp: number;
  details: string;
  txHash: string;
  type: 'access' | 'grant' | 'revoke' | 'modify' | 'download';
}

export interface MockAnomaly {
  id: string;
  type: string;
  description: string;
  severity: 'High' | 'Medium' | 'Low';
  detectedAt: number;
  confidence: number;
  model: string;
  modelId: string;
  attestation: string;
  resolved: boolean;
}

export interface MockInference {
  id: string;
  model: {
    id: string;
    name: string;
    version: string;
    type: string;
    accuracy: number;
  };
  result: string;
  confidence: number;
  timestamp: number;
  attestation: string;
  blockHeight: number;
  inputHash: string;
  outputHash: string;
}

export interface MockAttestation {
  id: string;
  hash: string;
  platform: string;
  enclaveId: string;
  timestamp: number;
  verified: boolean;
  modelId: string | null;
  modelName: string | null;
  blockHeight: number;
  txHash: string;
}

// ────────────────────────────────────────────────────────────
// Constants for generators
// ────────────────────────────────────────────────────────────

const RECORD_SEED = 200;
const ACCESS_SEED = 400;
const INSIGHTS_SEED = 300;
const TEE_SEED = 500;

const TYPE_DESCRIPTIONS: Record<string, string[]> = {
  lab_result: [
    'Complete Blood Count', 'Thyroid Panel (TSH, T3, T4)', 'Lipid Panel',
    'Hemoglobin A1C', 'Hormone Panel (Estradiol, Progesterone)',
    'Comprehensive Metabolic Panel', 'Iron Studies', 'Vitamin D Level',
  ],
  imaging: [
    'Pelvic Ultrasound', 'Mammogram Bilateral', 'Transvaginal Sonogram',
    'Bone Density Scan', 'MRI Pelvis', 'HSG Report',
  ],
  prescription: [
    'Estradiol 2mg Oral', 'Progesterone 200mg', 'Levothyroxine 50mcg',
    'Prenatal Vitamins', 'Metformin 500mg',
  ],
  vitals: [
    'Blood Pressure Reading', 'Weight & BMI Check', 'Heart Rate Monitoring',
    'Oxygen Saturation', 'Temperature Log',
  ],
  notes: [
    'Annual Exam Notes', 'Follow-up Visit Summary', 'Pre-conception Consultation',
    'Specialist Referral', 'Treatment Plan Update',
  ],
};

const TAGS_POOL = [
  'routine', 'urgent', 'follow-up', 'annual', 'specialist',
  'lab', 'imaging', 'medication', 'monitoring', 'fertility',
  'prenatal', 'postpartum',
];

const AUDIT_ACTIONS = [
  { action: 'Viewed lab results', type: 'access' as const, detail: 'Accessed Complete Blood Count record' },
  { action: 'Access granted', type: 'grant' as const, detail: 'Full Records access granted for 90 days' },
  { action: 'Downloaded imaging', type: 'download' as const, detail: 'Downloaded Pelvic Ultrasound report' },
  { action: 'Access revoked', type: 'revoke' as const, detail: 'Provider access revoked by patient' },
  { action: 'Scope modified', type: 'modify' as const, detail: 'Access scope changed from Full Records to Lab Results Only' },
  { action: 'Viewed vitals', type: 'access' as const, detail: 'Accessed Blood Pressure reading history' },
  { action: 'Access request', type: 'grant' as const, detail: 'New access request submitted by provider' },
  { action: 'Viewed prescriptions', type: 'access' as const, detail: 'Accessed Estradiol prescription record' },
  { action: 'Access expired', type: 'revoke' as const, detail: 'Time-limited access expired automatically' },
  { action: 'Downloaded lab results', type: 'download' as const, detail: 'Downloaded Thyroid Panel report' },
];

const ANOMALY_TYPES = [
  'Elevated Temperature',
  'Irregular Cycle Length',
  'Unusual Pattern',
  'Missed Phase Detection',
  'Atypical Hormone Levels',
];

const OWNER_ADDRESS = 'aeth1q8r4k2m7x9p3v5l6j1n0w2e4t8y6u3i5o7a9s2d';

// ────────────────────────────────────────────────────────────
// Health Records
// ────────────────────────────────────────────────────────────

let _cachedRecords: MockHealthRecord[] | null = null;

export function generateMockRecords(count: number = 24): MockHealthRecord[] {
  if (_cachedRecords && _cachedRecords.length === count) return _cachedRecords;

  const types = ['lab_result', 'imaging', 'prescription', 'vitals', 'notes'] as const;

  _cachedRecords = Array.from({ length: count }, (_, i) => {
    const type = seededPick(RECORD_SEED + i * 7, types);
    const descriptions = TYPE_DESCRIPTIONS[type] || ['Record'];
    return {
      id: `rec-${seededHex(RECORD_SEED + i * 100, 12)}`,
      type,
      label: seededPick(RECORD_SEED + i * 3, descriptions),
      description: `Encrypted health record processed via TEE enclave at block ${2847000 + seededInt(RECORD_SEED + i * 5, 0, 500)}`,
      date: Date.now() - i * 86400000 * (1 + seededRandom(RECORD_SEED + i) * 3),
      uploadDate: Date.now() - i * 86400000 * (1 + seededRandom(RECORD_SEED + i) * 3) + 3600000,
      encrypted: true,
      encryption: 'AES-256-GCM',
      cid: generateCID(RECORD_SEED + i * 50),
      txHash: generateTxHash(RECORD_SEED + i * 30),
      attestation: generateAttestation(RECORD_SEED + i * 40),
      size: seededInt(RECORD_SEED + i * 11, 20, 2000) * 1024,
      provider: seededPick(RECORD_SEED + i * 13, PROVIDER_NAMES),
      status: (i < 2 ? 'Processing' : i < 4 ? 'Pinning' : seededPick(RECORD_SEED + i * 9, ['Verified', 'Pinned'] as const)) as MockHealthRecord['status'],
      ipfsNodes: seededInt(RECORD_SEED + i * 17, 12, 64),
      tags: [TAGS_POOL[i % TAGS_POOL.length], TAGS_POOL[(i + 3) % TAGS_POOL.length]],
      deleted: false,
      ownerAddress: OWNER_ADDRESS,
      blockHeight: 2847000 + seededInt(RECORD_SEED + i * 5, 0, 500),
    };
  });

  return _cachedRecords;
}

export function findRecordById(id: string): MockHealthRecord | undefined {
  return generateMockRecords().find((r) => r.id === id && !r.deleted);
}

// ────────────────────────────────────────────────────────────
// Access Grants
// ────────────────────────────────────────────────────────────

let _cachedGrants: MockAccessGrant[] | null = null;

export function generateMockGrants(count: number = 8): MockAccessGrant[] {
  if (_cachedGrants && _cachedGrants.length === count) return _cachedGrants;

  const statuses: MockAccessGrant['status'][] = [
    'Active', 'Active', 'Active', 'Expired', 'Revoked', 'Pending', 'Active', 'Expired',
  ];

  _cachedGrants = Array.from({ length: count }, (_, i) => ({
    id: `grant-${seededHex(ACCESS_SEED + i * 100, 8)}`,
    provider: PROVIDER_NAMES[i % PROVIDER_NAMES.length],
    specialty: seededPick(ACCESS_SEED + i * 7, SPECIALTIES),
    address: seededAddress(ACCESS_SEED + i * 50),
    status: statuses[i % statuses.length],
    scope: seededPick(ACCESS_SEED + i * 3, DATA_SCOPES),
    grantedAt: Date.now() - seededInt(ACCESS_SEED + i * 11, 7, 180) * 86400000,
    expiresAt: statuses[i % statuses.length] === 'Expired'
      ? Date.now() - seededInt(ACCESS_SEED + i * 13, 1, 30) * 86400000
      : Date.now() + seededInt(ACCESS_SEED + i * 15, 7, 90) * 86400000,
    lastAccess: statuses[i % statuses.length] === 'Active'
      ? Date.now() - seededInt(ACCESS_SEED + i * 17, 1, 48) * 3600000
      : null,
    accessCount: statuses[i % statuses.length] === 'Active'
      ? seededInt(ACCESS_SEED + i * 19, 3, 47)
      : seededInt(ACCESS_SEED + i * 19, 0, 15),
    txHash: generateTxHash(ACCESS_SEED + i * 30),
    attestation: generateAttestation(ACCESS_SEED + i * 40),
    canView: true,
    canDownload: i < 4,
    canShare: i < 2,
    ownerAddress: OWNER_ADDRESS,
  }));

  return _cachedGrants;
}

export function findGrantById(id: string): MockAccessGrant | undefined {
  return generateMockGrants().find((g) => g.id === id);
}

// ────────────────────────────────────────────────────────────
// Audit Log
// ────────────────────────────────────────────────────────────

let _cachedAudit: MockAuditEntry[] | null = null;

export function generateMockAuditLog(count: number = 20): MockAuditEntry[] {
  if (_cachedAudit && _cachedAudit.length === count) return _cachedAudit;

  _cachedAudit = Array.from({ length: count }, (_, i) => {
    const actionEntry = AUDIT_ACTIONS[i % AUDIT_ACTIONS.length];
    return {
      id: `audit-${seededHex(ACCESS_SEED + i * 200, 8)}`,
      provider: PROVIDER_NAMES[i % PROVIDER_NAMES.length],
      action: actionEntry.action,
      timestamp: Date.now() - seededInt(ACCESS_SEED + i * 8, 1, 168) * 3600000,
      details: actionEntry.detail,
      txHash: generateTxHash(ACCESS_SEED + i * 60),
      type: actionEntry.type,
    };
  });

  return _cachedAudit;
}

// ────────────────────────────────────────────────────────────
// Anomalies
// ────────────────────────────────────────────────────────────

let _cachedAnomalies: MockAnomaly[] | null = null;

export function generateMockAnomalies(count: number = 8): MockAnomaly[] {
  if (_cachedAnomalies && _cachedAnomalies.length === count) return _cachedAnomalies;

  const severities: MockAnomaly['severity'][] = ['High', 'Medium', 'Low'];

  _cachedAnomalies = Array.from({ length: count }, (_, i) => ({
    id: `anomaly-${seededHex(INSIGHTS_SEED + i * 100, 8)}`,
    type: ANOMALY_TYPES[i % ANOMALY_TYPES.length],
    description: `AI model detected ${ANOMALY_TYPES[i % ANOMALY_TYPES.length].toLowerCase()} that deviates from your personal baseline pattern by ${seededInt(INSIGHTS_SEED + i * 10, 15, 45)}%.`,
    severity: severities[i % severities.length],
    detectedAt: Date.now() - seededInt(INSIGHTS_SEED + i * 7, 1, 72) * 3600000,
    confidence: parseFloat((85 + seededRandom(INSIGHTS_SEED + i * 3) * 14).toFixed(1)),
    model: AI_MODELS[i % AI_MODELS.length].name,
    modelId: AI_MODELS[i % AI_MODELS.length].id,
    attestation: generateAttestation(INSIGHTS_SEED + i * 40),
    resolved: i > 4,
  }));

  return _cachedAnomalies;
}

// ────────────────────────────────────────────────────────────
// Inferences
// ────────────────────────────────────────────────────────────

let _cachedInferences: MockInference[] | null = null;

export function generateMockInferences(count: number = 20): MockInference[] {
  if (_cachedInferences && _cachedInferences.length === count) return _cachedInferences;

  _cachedInferences = Array.from({ length: count }, (_, i) => {
    const model = AI_MODELS[i % AI_MODELS.length];
    return {
      id: `inf-${seededHex(INSIGHTS_SEED + i * 150, 8)}`,
      model: { ...model },
      result: i % 3 === 0 ? 'Anomaly Detected' : 'Normal',
      confidence: parseFloat((88 + seededRandom(INSIGHTS_SEED + i * 5) * 11).toFixed(1)),
      timestamp: Date.now() - seededInt(INSIGHTS_SEED + i * 8, 1, 48) * 3600000,
      attestation: generateAttestation(INSIGHTS_SEED + i * 60),
      blockHeight: 2847391 - seededInt(INSIGHTS_SEED + i, 0, 200),
      inputHash: `0x${seededHex(INSIGHTS_SEED + i * 70, 64)}`,
      outputHash: `0x${seededHex(INSIGHTS_SEED + i * 80, 64)}`,
    };
  });

  return _cachedInferences;
}

// ────────────────────────────────────────────────────────────
// TEE Attestations
// ────────────────────────────────────────────────────────────

let _cachedAttestations: MockAttestation[] | null = null;

export function generateMockAttestations(count: number = 20): MockAttestation[] {
  if (_cachedAttestations && _cachedAttestations.length === count) return _cachedAttestations;

  _cachedAttestations = Array.from({ length: count }, (_, i) => {
    const hasModel = i % 2 === 0;
    const model = hasModel ? AI_MODELS[i % AI_MODELS.length] : null;
    return {
      id: `att-${seededHex(TEE_SEED + i * 100, 8)}`,
      hash: generateAttestation(TEE_SEED + i * 50),
      platform: seededPick(TEE_SEED + i * 7, TEE_PLATFORMS),
      enclaveId: `enclave-${seededHex(TEE_SEED + i * 30, 16)}`,
      timestamp: Date.now() - seededInt(TEE_SEED + i * 11, 1, 168) * 3600000,
      verified: i < 17,
      modelId: model?.id ?? null,
      modelName: model?.name ?? null,
      blockHeight: 2847391 - seededInt(TEE_SEED + i, 0, 300),
      txHash: generateTxHash(TEE_SEED + i * 40),
    };
  });

  return _cachedAttestations;
}

// ────────────────────────────────────────────────────────────
// Insights Overview
// ────────────────────────────────────────────────────────────

export function generateInsightsOverview() {
  const anomalies = generateMockAnomalies();
  return {
    cyclePrediction: {
      nextPeriodDays: 12,
      fertileWindowStart: 8,
      fertileWindowEnd: 13,
      averageCycleLength: 28.3,
      avgBBTShift: 0.5,
      predictionAccuracy: 96.2,
      model: 'Cycle LSTM v2.1',
    },
    healthScores: {
      overall: 82,
      cycleRegularity: 92,
      hormoneBalance: 78,
      sleepQuality: 85,
      stressLevel: 65,
      activityLevel: 88,
      nutrition: 74,
    },
    anomaliesSummary: {
      total: anomalies.length,
      active: anomalies.filter((a) => !a.resolved).length,
      highSeverity: anomalies.filter((a) => a.severity === 'High' && !a.resolved).length,
    },
    weeklyWellness: {
      avgEnergy: 72,
      avgMood: 78,
      avgSleep: 7.2,
    },
    modelsActive: AI_MODELS.length,
    totalInferences: Math.round(12400 + seededRandom(INSIGHTS_SEED + 60) * 800),
  };
}

// ────────────────────────────────────────────────────────────
// Network Status
// ────────────────────────────────────────────────────────────

export function generateNetworkStatus() {
  return {
    blockHeight: 2847391 + Math.floor(Date.now() / 3000) % 1000,
    tps: Math.round(1800 + seededRandom(100) * 1000),
    epoch: 247,
    networkLoad: Math.round(60 + seededRandom(130) * 25),
    validators: 128,
    totalStaked: 847_000_000,
    aethelPrice: parseFloat((1.24 + (seededRandom(140) - 0.5) * 0.1).toFixed(4)),
    avgBlockTime: 2.8,
    totalTransactions: 284_739_100,
    activeAccounts: 127_450,
  };
}

// ────────────────────────────────────────────────────────────
// TEE Status
// ────────────────────────────────────────────────────────────

export function generateTEEStatus() {
  return {
    status: 'operational' as const,
    platform: 'Intel SGX',
    firmwareVersion: '2.18.100.2',
    enclaveUptime: 99.97,
    attestationsToday: Math.round(280 + seededRandom(TEE_SEED + 50) * 120),
    attestationsTotal: 47_832,
    lastAttestation: Date.now() - 1000 * 60 * 2,
    inferencesCompleted: Math.round(12400 + seededRandom(TEE_SEED + 60) * 800),
    modelsLoaded: AI_MODELS.length,
    memoryUsed: '3.2 GB',
    memoryTotal: '8 GB',
    securityLevel: 'Hardware-backed',
    enclaveId: `enclave-${seededHex(TEE_SEED, 16)}`,
    measurementHash: generateAttestation(TEE_SEED + 100),
  };
}
