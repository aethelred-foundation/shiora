// ============================================================
// Shiora on Aethelred — Single Conversation API
// GET    /api/chat/[id] — Get messages for a conversation
// DELETE /api/chat/[id] — Delete a conversation
// ============================================================

import { NextRequest } from 'next/server';
import { runMiddleware } from '@/lib/api/middleware';
import { successResponse, notFoundResponse, HTTP } from '@/lib/api/responses';
import { seededHex, seededInt, seededPick, generateAttestation } from '@/lib/utils';
import { AI_MODELS, TEE_PLATFORMS } from '@/lib/constants';
import type { TEEPlatform } from '@/types';

// ────────────────────────────────────────────────────────────
// Mock Data
// ────────────────────────────────────────────────────────────

const SEED = 600;

const MODEL_NAMES = AI_MODELS.map((m) => m.name);

const USER_MESSAGES = [
  'Can you analyze my recent cycle data and let me know if anything looks unusual?',
  'I got my lab results back. Can you help me understand my thyroid levels?',
  'When is my next predicted fertile window based on my data?',
  'Are there any interactions between my current medications?',
  'My sleep scores have been low lately. What does my data show?',
];

const ASSISTANT_RESPONSES = [
  'Based on your cycle data from the last 6 months, I can see a consistent pattern with an average cycle length of 28.3 days.',
  'Your recent lab results show improvement in thyroid function. Your TSH has moved from 4.2 to 3.1 mIU/L.',
  'Looking at your temperature readings, the BBT shift occurred on day 14 this cycle.',
  'The anomaly detector flagged a slight irregularity in your cycle length variation.',
  'Your sleep data shows an average sleep score of 72 over the past 14 days, down from your baseline of 81.',
];

const VALID_CONV_IDS = Array.from({ length: 8 }, (_, i) => `conv-${seededHex(SEED + i * 100, 12)}`);

function generateMockMessages(convId: string) {
  const convIndex = VALID_CONV_IDS.indexOf(convId);
  if (convIndex === -1) return null;

  const count = seededInt(SEED + convIndex * 17, 10, 15);
  return Array.from({ length: count }, (_, j) => {
    const isUser = j % 2 === 0;
    const msgSeed = SEED + convIndex * 1000 + j * 50;
    return {
      id: `msg-${seededHex(msgSeed, 12)}`,
      conversationId: convId,
      role: isUser ? ('user' as const) : ('assistant' as const),
      content: isUser
        ? seededPick(msgSeed, USER_MESSAGES)
        : seededPick(msgSeed, ASSISTANT_RESPONSES),
      timestamp: Date.now() - (count - j) * 60000 * seededInt(msgSeed + 1, 2, 10),
      tokens: seededInt(msgSeed + 5, 50, 500),
      ...(isUser
        ? {}
        : {
            attestation: generateAttestation(msgSeed + 10),
            model: seededPick(msgSeed + 20, MODEL_NAMES),
            confidence: seededInt(msgSeed + 30, 85, 99),
            teePlatform: seededPick(msgSeed + 40, TEE_PLATFORMS) as TEEPlatform,
          }),
    };
  });
}

// ────────────────────────────────────────────────────────────
// Route context type
// ────────────────────────────────────────────────────────────

interface RouteContext {
  params: Promise<{ id: string }>;
}

// ────────────────────────────────────────────────────────────
// GET /api/chat/[id] — Get messages
// ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest, context: RouteContext) {
  const blocked = runMiddleware(request);
  if (blocked) return blocked;

  const { id } = await context.params;
  const messages = generateMockMessages(id);

  if (!messages) {
    return notFoundResponse('Conversation', id);
  }

  return successResponse(messages);
}

// ────────────────────────────────────────────────────────────
// DELETE /api/chat/[id] — Delete conversation
// ────────────────────────────────────────────────────────────

export async function DELETE(request: NextRequest, context: RouteContext) {
  const blocked = runMiddleware(request);
  if (blocked) return blocked;

  const { id } = await context.params;

  if (!VALID_CONV_IDS.includes(id)) {
    return notFoundResponse('Conversation', id);
  }

  return successResponse(
    {
      id,
      deleted: true,
      deletedAt: Date.now(),
      message: 'Conversation deleted. Associated attestations remain on-chain.',
    },
    HTTP.OK,
  );
}
