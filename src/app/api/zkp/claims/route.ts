// ============================================================
// Shiora on Aethelred — ZKP Claims API
// GET  /api/zkp/claims — List all ZK claims
// POST /api/zkp/claims — Submit a new ZK claim
// ============================================================

import { NextRequest } from 'next/server';
import { successResponse, errorResponse, HTTP } from '@/lib/api/responses';
import { runMiddleware } from '@/lib/api/middleware';
import { seededInt, seededHex, seededPick, seededRandom, generateTxHash } from '@/lib/utils';
import type { ZKClaim, ZKClaimType, ZKProof } from '@/types';

// ────────────────────────────────────────────────────────────
// Mock Data
// ────────────────────────────────────────────────────────────

const SEED = 1300;

const CLAIM_TYPES: ZKClaimType[] = [
  'age_range',
  'condition_present',
  'medication_active',
  'data_quality',
  'provider_verified',
  'fertility_window',
];

const DESCRIPTIONS: Record<ZKClaimType, string> = {
  age_range:
    'Proves you are within a specific age range without revealing your exact date of birth',
  condition_present:
    'Proves a medical condition is present in your records without revealing which condition',
  medication_active:
    'Proves you are on an active medication without revealing the specific medication',
  data_quality:
    'Proves your health data meets a minimum quality score without revealing the data itself',
  provider_verified:
    'Proves you have been verified by a licensed healthcare provider without revealing provider details',
  fertility_window:
    'Proves you are within a predicted fertile window without revealing cycle details',
};

function generateMockClaims(): ZKClaim[] {
  return Array.from({ length: 10 }, (_, i) => {
    const s = SEED + i * 17;
    const claimType = CLAIM_TYPES[i % CLAIM_TYPES.length];
    const status: ZKClaim['status'] =
      i < 6 ? 'verified' : i < 8 ? 'proving' : seededPick(s + 3, ['unproven', 'expired'] as const);

    let proof: ZKProof | undefined;
    if (status === 'verified') {
      proof = {
        id: `proof-${seededHex(s + 10, 12)}`,
        claimType,
        proofHash: `0x${seededHex(s + 20, 64)}`,
        publicInputs: `claimType: ${claimType}, verified: true`,
        verified: true,
        verifiedAt: Date.now() - seededInt(s + 30, 1, 30) * 86400000,
        createdAt: Date.now() - seededInt(s + 32, 30, 60) * 86400000,
        expiresAt: Date.now() + seededInt(s + 34, 30, 180) * 86400000,
        txHash: generateTxHash(s + 40),
      };
    }

    return {
      id: `claim-${seededHex(s, 12)}`,
      claimType,
      description: DESCRIPTIONS[claimType],
      proof,
      status,
      createdAt: Date.now() - seededInt(s + 5, 1, 90) * 86400000,
    };
  });
}

// ────────────────────────────────────────────────────────────
// GET /api/zkp/claims
// ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const blocked = runMiddleware(request);
  if (blocked) return blocked;

  const claims = generateMockClaims();
  return successResponse(claims, HTTP.OK, { total: claims.length });
}

// ────────────────────────────────────────────────────────────
// POST /api/zkp/claims — Submit new claim
// ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const blocked = runMiddleware(request);
  if (blocked) return blocked;

  try {
    const body = await request.json();
    const { claimType, description } = body;

    if (!claimType) {
      return errorResponse('VALIDATION_ERROR', 'claimType is required', HTTP.BAD_REQUEST);
    }

    if (!CLAIM_TYPES.includes(claimType)) {
      return errorResponse(
        'VALIDATION_ERROR',
        `Invalid claimType. Must be one of: ${CLAIM_TYPES.join(', ')}`,
        HTTP.BAD_REQUEST,
      );
    }

    const seed = Date.now();
    const newClaim: ZKClaim = {
      id: `claim-${seededHex(seed, 12)}`,
      claimType,
      description: description ?? DESCRIPTIONS[claimType as ZKClaimType],
      status: 'unproven',
      createdAt: Date.now(),
    };

    return successResponse(newClaim, HTTP.CREATED, {
      message: 'ZK claim submitted successfully. Generate a proof to verify this claim.',
    });
  } catch {
    return errorResponse('INVALID_BODY', 'Invalid JSON body', HTTP.BAD_REQUEST);
  }
}
