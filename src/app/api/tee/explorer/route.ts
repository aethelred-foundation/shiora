// ============================================================
// Shiora on Aethelred — TEE Computation Explorer API
// GET /api/tee/explorer — Multi-view TEE data endpoint
// Query param: view = stats | attestations | jobs | enclaves
// ============================================================

import { NextRequest } from 'next/server';
import { successResponse, errorResponse, HTTP } from '@/lib/api/responses';
import { runMiddleware } from '@/lib/api/middleware';
import {
  seededRandom,
  seededInt,
  seededHex,
  seededPick,
  generateTxHash,
  generateAttestation,
  generateDayLabel,
} from '@/lib/utils';
import { TEE_PLATFORMS, AI_MODELS } from '@/lib/constants';
import type {
  TEEPlatformStats,
  TEEVerificationChain,
  TEEComputeJob,
  TEEEnclaveInfo,
  TEEPlatform,
  ComputeJobStatus,
  TEEStatus,
} from '@/types';

// ────────────────────────────────────────────────────────────
// Deterministic seed
// ────────────────────────────────────────────────────────────

const SEED = 2000;

// ────────────────────────────────────────────────────────────
// Mock data generators
// ────────────────────────────────────────────────────────────

function generateStats(): TEEPlatformStats {
  const s = SEED;
  const dailyVolume: { day: string; count: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    dailyVolume.push({
      day: generateDayLabel(i),
      count: seededInt(s + i * 11, 800, 2400),
    });
  }

  return {
    totalEnclaves: 24,
    activeEnclaves: 21,
    attestationSuccessRate: 99.7,
    totalAttestations: 847293,
    attestationsToday: seededInt(s + 100, 1200, 2200),
    computeTPS: parseFloat((seededRandom(s + 200) * 40 + 80).toFixed(1)),
    averageExecutionMs: seededInt(s + 300, 120, 350),
    platformDistribution: [
      { platform: 'Intel SGX' as TEEPlatform, count: 11, percentage: 45 },
      { platform: 'AWS Nitro' as TEEPlatform, count: 8, percentage: 35 },
      { platform: 'AMD SEV' as TEEPlatform, count: 5, percentage: 20 },
    ],
    dailyAttestationVolume: dailyVolume,
  };
}

function generateAttestations(): TEEVerificationChain[] {
  const items: TEEVerificationChain[] = [];
  for (let i = 0; i < 12; i++) {
    const s = SEED + i * 31;
    const platform = seededPick(s, TEE_PLATFORMS) as TEEPlatform;
    const model = seededPick(s + 1, AI_MODELS);
    const pcrValues: string[] = [];
    for (let p = 0; p < 3; p++) {
      pcrValues.push(`0x${seededHex(s + p * 13, 64)}`);
    }

    items.push({
      id: `att-${seededHex(s, 12)}`,
      attestationHash: generateAttestation(s + 2),
      enclaveId: `enc-${seededHex(s + 3, 8)}`,
      platform,
      measurementHash: `0x${seededHex(s + 4, 64)}`,
      pcrValues,
      nonce: `0x${seededHex(s + 5, 32)}`,
      signature: `0x${seededHex(s + 6, 128)}`,
      verifiedOnChain: seededRandom(s + 7) > 0.1,
      blockHeight: 2847000 + seededInt(s + 8, 1, 5000),
      txHash: generateTxHash(s + 9),
      timestamp: Date.now() - seededInt(s + 10, 60_000, 86_400_000 * 7),
      inputHash: `0x${seededHex(s + 11, 64)}`,
      outputHash: `0x${seededHex(s + 12, 64)}`,
      modelId: model.id,
    });
  }
  return items.sort((a, b) => b.timestamp - a.timestamp);
}

function generateJobs(): TEEComputeJob[] {
  const statuses: ComputeJobStatus[] = ['queued', 'running', 'completed', 'failed', 'cancelled'];
  const priorities: Array<'low' | 'normal' | 'high' | 'critical'> = [
    'low',
    'normal',
    'high',
    'critical',
  ];
  const items: TEEComputeJob[] = [];

  for (let i = 0; i < 15; i++) {
    const s = SEED + 500 + i * 37;
    const model = seededPick(s, AI_MODELS);
    const status = seededPick(s + 1, statuses);
    const submitted = Date.now() - seededInt(s + 2, 60_000, 86_400_000 * 3);
    const execTime = seededInt(s + 3, 80, 2500);

    items.push({
      id: `job-${seededHex(s + 4, 8)}`,
      enclaveId: `enc-${seededHex(s + 5, 8)}`,
      modelId: model.id,
      modelName: model.name,
      status,
      submittedAt: submitted,
      startedAt: status !== 'queued' ? submitted + seededInt(s + 6, 500, 5000) : undefined,
      completedAt: status === 'completed' || status === 'failed' ? submitted + execTime : undefined,
      executionTimeMs: execTime,
      inputHash: `0x${seededHex(s + 7, 64)}`,
      outputHash: `0x${seededHex(s + 8, 64)}`,
      attestationHash: generateAttestation(s + 9),
      gasCost: parseFloat((seededRandom(s + 10) * 0.05 + 0.001).toFixed(4)),
      priority: seededPick(s + 11, priorities),
    });
  }
  return items.sort((a, b) => b.submittedAt - a.submittedAt);
}

function generateEnclaves(): TEEEnclaveInfo[] {
  const regions = [
    'us-east-1',
    'us-west-2',
    'eu-west-1',
    'ap-southeast-1',
    'us-central-1',
    'eu-central-1',
    'ap-northeast-1',
    'sa-east-1',
  ];
  const firmwareVersions = [
    '2.18.100.4',
    '3.1.0',
    '1.51.0',
    '2.20.0',
    '3.2.1',
    '1.53.2',
    '2.19.0',
    '3.0.5',
  ];
  const statusOptions: TEEStatus[] = [
    'operational',
    'operational',
    'operational',
    'operational',
    'operational',
    'operational',
    'degraded',
    'offline',
  ];
  const items: TEEEnclaveInfo[] = [];

  for (let i = 0; i < 8; i++) {
    const s = SEED + 1000 + i * 41;
    const platform = seededPick(s, TEE_PLATFORMS) as TEEPlatform;

    items.push({
      id: `enc-${seededHex(s + 1, 8)}`,
      platform,
      firmwareVersion: firmwareVersions[i],
      measurementHash: `0x${seededHex(s + 2, 64)}`,
      status: statusOptions[i],
      uptime: parseFloat((seededRandom(s + 3) * 5 + 95).toFixed(2)),
      jobsProcessed: seededInt(s + 4, 500, 15000),
      trustScore: parseFloat((seededRandom(s + 5) * 10 + 90).toFixed(1)),
      lastAttestationAt: Date.now() - seededInt(s + 6, 30_000, 3_600_000),
      cpuCores: seededPick(s + 7, [4, 8, 16, 32]),
      memoryMB: seededPick(s + 8, [4096, 8192, 16384, 32768]),
      region: regions[i],
    });
  }
  return items;
}

// ────────────────────────────────────────────────────────────
// GET /api/tee/explorer
// ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const blocked = runMiddleware(request);
  if (blocked) return blocked;

  const view = request.nextUrl.searchParams.get('view') ?? 'stats';

  switch (view) {
    case 'stats':
      return successResponse(generateStats(), HTTP.OK, {
        queriedAt: new Date().toISOString(),
      });

    case 'attestations':
      return successResponse(generateAttestations(), HTTP.OK, {
        queriedAt: new Date().toISOString(),
      });

    case 'jobs':
      return successResponse(generateJobs(), HTTP.OK, {
        queriedAt: new Date().toISOString(),
      });

    case 'enclaves':
      return successResponse(generateEnclaves(), HTTP.OK, {
        queriedAt: new Date().toISOString(),
      });

    default:
      return errorResponse(
        'INVALID_VIEW',
        `Unknown view '${view}'. Valid values: stats, attestations, jobs, enclaves`,
        HTTP.BAD_REQUEST,
      );
  }
}
