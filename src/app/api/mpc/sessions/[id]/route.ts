// ============================================================
// Shiora on Aethelred — Single MPC Session Detail API
// GET /api/mpc/sessions/[id] — Full session with convergence data
// ============================================================

import { NextRequest } from 'next/server';
import { successResponse, notFoundResponse } from '@/lib/api/responses';
import { runMiddleware } from '@/lib/api/middleware';
import {
  seededRandom,
  seededInt,
  seededHex,
  seededPick,
  seededAddress,
  generateTxHash,
  generateAttestation,
} from '@/lib/utils';
import type {
  MPCSession,
  MPCSessionStatus,
  MPCProtocolType,
  MPCParticipant,
  MPCConvergencePoint,
} from '@/types';

// ────────────────────────────────────────────────────────────
// Deterministic seed (must match list endpoint)
// ────────────────────────────────────────────────────────────

const SEED = 2300;

const SESSION_NAMES = [
  'Federated Cancer Biomarker Study',
  'Multi-Hospital Vital Signs Aggregation',
  'Private Fertility Pattern Analysis',
  'Secure Medication Interaction Check',
  'Cross-Institutional Lab Result Pooling',
  'Anonymous Wearable Data Correlation',
] as const;

const SESSION_DESCRIPTIONS = [
  'Collaborative cancer biomarker discovery across three hospital networks without revealing individual patient data.',
  'Aggregate vital signs data from 12 hospitals to improve early warning system accuracy.',
  'Analyze fertility patterns across diverse populations while maintaining complete data privacy.',
  'Securely check drug interactions across pharmacy databases without exposing prescriptions.',
  'Pool laboratory results from multiple institutions for rare disease research.',
  'Correlate wearable health data across populations for pattern discovery.',
] as const;

const PROTOCOLS: MPCProtocolType[] = [
  'secure_sum',
  'federated_averaging',
  'private_intersection',
  'garbled_circuits',
  'secret_sharing',
];

const STATUSES: MPCSessionStatus[] = [
  'setup',
  'enrolling',
  'computing',
  'converging',
  'completed',
  'failed',
];

function generateParticipants(s: number, count: number): MPCParticipant[] {
  const participants: MPCParticipant[] = [];
  const statuses: MPCParticipant['status'][] = ['enrolled', 'active', 'completed', 'dropped'];

  for (let j = 0; j < count; j++) {
    const ps = s + j * 17;
    participants.push({
      id: `part-${seededHex(ps, 8)}`,
      anonymousId: `anon-${seededHex(ps + 1, 6)}`,
      joinedAt: Date.now() - seededInt(ps + 2, 3_600_000, 86_400_000 * 14),
      dataPointsContributed: seededInt(ps + 3, 100, 5000),
      roundsCompleted: seededInt(ps + 4, 0, 20),
      status: seededPick(ps + 5, statuses),
    });
  }

  return participants;
}

function generateSessions(): MPCSession[] {
  const sessions: MPCSession[] = [];

  for (let i = 0; i < 6; i++) {
    const s = SEED + i * 43;
    const protocol = PROTOCOLS[i % PROTOCOLS.length];
    const status = STATUSES[i];
    const minPart = seededInt(s + 1, 3, 6);
    const maxPart = seededInt(s + 2, 8, 20);
    const currentParticipants = seededInt(s + 3, minPart, maxPart);
    const totalRounds = seededInt(s + 4, 10, 50);
    const currentRound =
      status === 'completed'
        ? totalRounds
        : status === 'failed'
          ? seededInt(s + 5, 1, totalRounds - 1)
          : seededInt(s + 5, 0, totalRounds - 1);
    const budgetTotal = parseFloat((seededRandom(s + 6) * 8 + 2).toFixed(2));
    const budgetRemaining =
      status === 'completed'
        ? 0
        : parseFloat((budgetTotal * seededRandom(s + 7) * 0.6 + budgetTotal * 0.2).toFixed(2));
    const createdAt = Date.now() - seededInt(s + 8, 86_400_000, 86_400_000 * 30);

    sessions.push({
      id: `mpc-${seededHex(s, 12)}`,
      name: SESSION_NAMES[i],
      description: SESSION_DESCRIPTIONS[i],
      protocol,
      status,
      creatorAddress: seededAddress(s + 9),
      participants: generateParticipants(s + 100, currentParticipants),
      minParticipants: minPart,
      maxParticipants: maxPart,
      currentRound,
      totalRounds,
      privacyBudgetTotal: budgetTotal,
      privacyBudgetRemaining: budgetRemaining,
      createdAt,
      startedAt:
        status !== 'setup' ? createdAt + seededInt(s + 10, 3600_000, 86_400_000) : undefined,
      completedAt:
        status === 'completed'
          ? createdAt + seededInt(s + 11, 86_400_000 * 3, 86_400_000 * 14)
          : undefined,
      attestation: generateAttestation(s + 12),
      txHash: generateTxHash(s + 13),
    });
  }

  return sessions;
}

function generateConvergenceData(session: MPCSession): MPCConvergencePoint[] {
  const points: MPCConvergencePoint[] = [];
  const rounds = session.currentRound || session.totalRounds;

  for (let r = 0; r < rounds; r++) {
    const s = SEED + 3000 + r * 19;
    // Loss decreases over rounds (convergence pattern)
    const baseLoss = 2.5 * Math.exp(-0.08 * r);
    const noise = (seededRandom(s) - 0.5) * 0.2;
    // Accuracy increases over rounds
    const baseAccuracy = 50 + 45 * (1 - Math.exp(-0.1 * r));
    const accNoise = (seededRandom(s + 1) - 0.5) * 3;

    points.push({
      round: r + 1,
      loss: parseFloat(Math.max(0.01, baseLoss + noise).toFixed(4)),
      accuracy: parseFloat(Math.min(99, Math.max(50, baseAccuracy + accNoise)).toFixed(2)),
      participantsActive: Math.max(
        session.minParticipants,
        session.participants.length - seededInt(s + 2, 0, 2),
      ),
    });
  }

  return points;
}

// ────────────────────────────────────────────────────────────
// Route context
// ────────────────────────────────────────────────────────────

interface RouteContext {
  params: Promise<{ id: string }>;
}

// ────────────────────────────────────────────────────────────
// GET /api/mpc/sessions/[id]
// ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest, context: RouteContext) {
  const blocked = runMiddleware(request);
  if (blocked) return blocked;

  const { id } = await context.params;

  const sessions = generateSessions();
  const session = sessions.find((s) => s.id === id);

  if (!session) {
    return notFoundResponse('MPC Session', id);
  }

  const convergence = generateConvergenceData(session);

  return successResponse({
    ...session,
    convergence,
  });
}
