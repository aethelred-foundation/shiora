// ============================================================
// Shiora on Aethelred — Single Governance Proposal API
// GET  /api/governance/proposals/[id] — Get a single proposal
// POST /api/governance/proposals/[id] — Vote on a proposal
// ============================================================

import { NextRequest } from 'next/server';
import { successResponse, errorResponse, notFoundResponse, HTTP } from '@/lib/api/responses';
import { runMiddleware } from '@/lib/api/middleware';
import { seededHex, generateTxHash } from '@/lib/utils';

// ────────────────────────────────────────────────────────────
// GET /api/governance/proposals/[id]
// ────────────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const blocked = runMiddleware(request);
  if (blocked) return blocked;

  const { id } = await params;

  // Mock: return a proposal-shaped object
  const proposal = {
    id,
    proposer: 'aeth1demo000000000000000000000000000000000',
    type: 'feature',
    title: `Proposal ${id}`,
    description: 'Mock proposal description.',
    forVotes: 120000,
    againstVotes: 45000,
    abstainVotes: 15000,
    quorum: 150000,
    status: 'active',
    createdAt: Date.now() - 5 * 86400000,
    txHash: generateTxHash(Date.now()),
  };

  return successResponse(proposal);
}

// ────────────────────────────────────────────────────────────
// POST /api/governance/proposals/[id] — Vote
// ────────────────────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const blocked = runMiddleware(request);
  if (blocked) return blocked;

  const { id } = await params;

  try {
    const body = await request.json();
    const { support, reason } = body;

    if (!['for', 'against', 'abstain'].includes(support)) {
      return errorResponse('VALIDATION_ERROR', 'support must be "for", "against", or "abstain"', HTTP.UNPROCESSABLE);
    }

    const seed = Date.now();
    const vote = {
      id: `vote-${seededHex(seed, 8)}`,
      proposalId: id,
      voter: request.headers.get('x-wallet-address') ?? 'aeth1demo000000000000000000000000000000000',
      support,
      weight: 5000,
      timestamp: Date.now(),
      txHash: generateTxHash(seed),
      reason: reason || undefined,
    };

    return successResponse(vote, HTTP.CREATED, {
      message: 'Vote recorded successfully.',
    });
  } catch {
    return errorResponse('INVALID_REQUEST', 'Invalid request body', HTTP.BAD_REQUEST);
  }
}
