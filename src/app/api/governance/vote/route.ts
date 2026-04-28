// ============================================================
// Shiora on Aethelred — Governance Vote API
// GET  /api/governance/vote — List user votes
// POST /api/governance/vote — Cast a vote on a proposal
// ============================================================

import { NextRequest } from 'next/server';
import { successResponse, errorResponse, HTTP } from '@/lib/api/responses';
import { runMiddleware } from '@/lib/api/middleware';
import { seededHex, seededInt, generateTxHash } from '@/lib/utils';

// ────────────────────────────────────────────────────────────
// GET /api/governance/vote
// ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const blocked = runMiddleware(request);
  if (blocked) return blocked;

  const SEED = 1420;
  const votes = Array.from({ length: 8 }, (_, i) => ({
    id: `vote-${seededHex(SEED + i * 10, 8)}`,
    proposalId: `prop-${seededHex(1400 + (i % 3) * 100, 8)}`,
    voter: `aeth1demo${seededHex(SEED + i * 20, 30)}`,
    support: i % 3 === 0 ? 'for' : i % 3 === 1 ? 'against' : 'abstain',
    weight: seededInt(SEED + i * 30, 1000, 50000),
    timestamp: Date.now() - seededInt(SEED + i * 5, 1, 14) * 86400000,
    txHash: generateTxHash(SEED + i * 40),
  }));

  return successResponse(votes);
}

// ────────────────────────────────────────────────────────────
// POST /api/governance/vote
// ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const blocked = runMiddleware(request);
  if (blocked) return blocked;

  try {
    const body = await request.json();
    const { proposalId, support, reason } = body;

    if (!proposalId || !['for', 'against', 'abstain'].includes(support)) {
      return errorResponse(
        'VALIDATION_ERROR',
        'proposalId is required and support must be "for", "against", or "abstain"',
        HTTP.UNPROCESSABLE,
      );
    }

    const seed = Date.now();
    const vote = {
      id: `vote-${seededHex(seed, 8)}`,
      proposalId,
      voter:
        request.headers.get('x-wallet-address') ?? 'aeth1demo000000000000000000000000000000000',
      support,
      weight: 5000,
      timestamp: Date.now(),
      txHash: generateTxHash(seed),
      reason: reason || undefined,
    };

    return successResponse(vote, HTTP.CREATED, {
      message: 'Vote recorded on-chain.',
    });
  } catch {
    return errorResponse('INVALID_REQUEST', 'Invalid request body', HTTP.BAD_REQUEST);
  }
}
