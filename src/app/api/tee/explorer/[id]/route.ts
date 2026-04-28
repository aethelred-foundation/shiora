// ============================================================
// Shiora on Aethelred — Single Attestation Detail API
// GET /api/tee/explorer/[id] — Full attestation verification detail
// ============================================================

import { NextRequest } from 'next/server';
import { successResponse, notFoundResponse } from '@/lib/api/responses';
import { runMiddleware } from '@/lib/api/middleware';
import {
  seededRandom,
  seededInt,
  seededHex,
  seededPick,
  generateTxHash,
  generateAttestation,
} from '@/lib/utils';
import { TEE_PLATFORMS, AI_MODELS } from '@/lib/constants';
import type { TEEVerificationChain, TEEPlatform } from '@/types';

// ────────────────────────────────────────────────────────────
// Deterministic seed (must match list endpoint)
// ────────────────────────────────────────────────────────────

const SEED = 2000;

interface RouteContext {
  params: Promise<{ id: string }>;
}

// ────────────────────────────────────────────────────────────
// GET /api/tee/explorer/[id]
// ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest, context: RouteContext) {
  const blocked = runMiddleware(request);
  if (blocked) return blocked;

  const { id } = await context.params;

  // Regenerate the attestations to find the one matching the requested id
  const attestations: TEEVerificationChain[] = [];
  for (let i = 0; i < 12; i++) {
    const s = SEED + i * 31;
    const platform = seededPick(s, TEE_PLATFORMS) as TEEPlatform;
    const model = seededPick(s + 1, AI_MODELS);
    const pcrValues: string[] = [];
    for (let p = 0; p < 3; p++) {
      pcrValues.push(`0x${seededHex(s + p * 13, 64)}`);
    }

    attestations.push({
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

  const attestation = attestations.find((a) => a.id === id);

  if (!attestation) {
    return notFoundResponse('Attestation', id);
  }

  // Return enriched detail
  return successResponse({
    ...attestation,
    verification: {
      chainAnchored: attestation.verifiedOnChain,
      anchorTxHash: attestation.txHash,
      blockHeight: attestation.blockHeight,
      blockTimestamp: attestation.timestamp,
      confirmations: seededInt(SEED + attestation.blockHeight, 6, 128),
    },
    enclave: {
      id: attestation.enclaveId,
      platform: attestation.platform,
      firmwareVersion:
        attestation.platform === 'Intel SGX'
          ? '2.18.100.4'
          : attestation.platform === 'AWS Nitro'
            ? '3.1.0'
            : '1.51.0',
      trustScore: parseFloat(
        (seededRandom(SEED + attestation.blockHeight + 1) * 10 + 90).toFixed(1),
      ),
    },
    model: {
      id: attestation.modelId,
      name:
        AI_MODELS.find((m) => m.id === attestation.modelId)?.name /* istanbul ignore next */ ??
        attestation.modelId,
      version:
        AI_MODELS.find((m) => m.id === attestation.modelId)?.version /* istanbul ignore next */ ??
        'v1.0',
    },
  });
}
