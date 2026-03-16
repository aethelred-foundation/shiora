// ============================================================
// Shiora on Aethelred — Governance Proposals API
// GET  /api/governance/proposals — List proposals
// POST /api/governance/proposals — Create a new proposal
// ============================================================

import { NextRequest } from 'next/server';
import { successResponse, errorResponse, HTTP } from '@/lib/api/responses';
import { runMiddleware } from '@/lib/api/middleware';
import {
  seededRandom, seededInt, seededHex, seededPick, seededAddress,
  generateTxHash,
} from '@/lib/utils';

// ────────────────────────────────────────────────────────────
// GET /api/governance/proposals
// ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const blocked = runMiddleware(request);
  if (blocked) return blocked;

  const view = request.nextUrl.searchParams.get('view');
  const status = request.nextUrl.searchParams.get('status');

  const SEED = 1400;

  // Return aggregated stats when requested
  if (view === 'stats') {
    return successResponse({
      totalProposals: 12,
      activeProposals: 3,
      totalVoters: seededInt(SEED + 300, 800, 2500),
      totalVotingPower: seededInt(SEED + 301, 500000, 2000000),
      quorumThreshold: 10,
      treasuryBalance: seededInt(SEED + 302, 100000, 500000),
    });
  }

  // Return delegations
  if (view === 'delegations') {
    const delegations = Array.from({ length: 4 }, (_, i) => ({
      id: `deleg-${seededHex(SEED + 400 + i * 10, 8)}`,
      delegator: seededAddress(SEED + 400 + i * 20),
      delegatee: seededAddress(SEED + 400 + i * 30),
      amount: seededInt(SEED + 400 + i * 15, 5000, 50000),
      delegatedAt: Date.now() - seededInt(SEED + 400 + i * 7, 1, 60) * 86400000,
      txHash: generateTxHash(SEED + 400 + i * 25),
    }));
    return successResponse(delegations);
  }

  const types = ['parameter', 'feature', 'treasury', 'emergency'] as const;
  const statuses = ['active', 'passed', 'defeated', 'queued', 'executed', 'cancelled'] as const;

  const proposals = Array.from({ length: 12 }, (_, i) => {
    const pStatus = i < 3 ? 'active' : seededPick(SEED + i * 11, statuses.slice(1));
    const totalVotes = seededInt(SEED + i * 20, 50000, 500000);
    return {
      id: `prop-${seededHex(SEED + i * 100, 8)}`,
      proposer: seededAddress(SEED + i * 50),
      type: types[i % types.length],
      title: `Governance Proposal #${i + 1}`,
      forVotes: Math.round(totalVotes * 0.55),
      againstVotes: Math.round(totalVotes * 0.3),
      abstainVotes: Math.round(totalVotes * 0.15),
      quorum: seededInt(SEED + i * 15, 100000, 250000),
      status: pStatus,
      createdAt: Date.now() - seededInt(SEED + i * 7, 1, 30) * 86400000,
      txHash: generateTxHash(SEED + i * 30),
    };
  });

  const filtered = status
    ? proposals.filter((p) => p.status === status)
    : proposals;

  return successResponse(filtered);
}

// ────────────────────────────────────────────────────────────
// POST /api/governance/proposals
// ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const blocked = runMiddleware(request);
  if (blocked) return blocked;

  try {
    const body = await request.json();
    const { type, title, description, votingPeriodDays } = body;

    if (!type || !title || !description) {
      return errorResponse('VALIDATION_ERROR', 'type, title, and description are required', HTTP.UNPROCESSABLE);
    }

    const seed = Date.now();
    const proposal = {
      id: `prop-${seededHex(seed, 8)}`,
      proposer: request.headers.get('x-wallet-address') ?? 'aeth1demo000000000000000000000000000000000',
      type,
      title,
      description,
      forVotes: 0,
      againstVotes: 0,
      abstainVotes: 0,
      quorum: 150000,
      status: 'active',
      createdAt: Date.now(),
      txHash: generateTxHash(seed),
    };

    return successResponse(proposal, HTTP.CREATED, {
      message: 'Proposal created successfully. Voting period has begun.',
    });
  } catch {
    return errorResponse('INVALID_REQUEST', 'Invalid request body', HTTP.BAD_REQUEST);
  }
}
