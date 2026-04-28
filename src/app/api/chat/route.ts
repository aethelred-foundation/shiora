// ============================================================
// Shiora on Aethelred — Chat API
// GET  /api/chat — List conversations
// POST /api/chat — Send a message to a conversation
// ============================================================

import { NextRequest } from 'next/server';
import { runMiddleware } from '@/lib/api/middleware';
import { successResponse, errorResponse, HTTP } from '@/lib/api/responses';
import { seededHex, seededInt, seededPick, generateAttestation } from '@/lib/utils';
import { AI_MODELS, TEE_PLATFORMS } from '@/lib/constants';

// ────────────────────────────────────────────────────────────
// Mock Data
// ────────────────────────────────────────────────────────────

const SEED = 600;

const MOCK_RESPONSES = [
  'Based on your cycle data from the last 6 months, I can see a consistent pattern with an average cycle length of 28.3 days.',
  'Your recent lab results show improvement in thyroid function. Your TSH has moved from 4.2 to 3.1 mIU/L.',
  'Looking at your temperature readings, the BBT shift occurred on day 14 this cycle, consistent with your typical ovulation window.',
  'Your comprehensive wellness summary shows blood markers within range and cycle regularity at 94%.',
  'The anomaly detector flagged a slight irregularity in your cycle length variation this month.',
];

const CONVERSATION_TITLES = [
  'Cycle Analysis Discussion',
  'Lab Results Review',
  'Fertility Planning',
  'Medication Questions',
  'Sleep Pattern Analysis',
  'Wellness Check-in',
  'Hormone Level Discussion',
  'Nutrition Guidance',
];

const MODEL_NAMES = AI_MODELS.map((m) => m.name);

function generateMockConversations() {
  return CONVERSATION_TITLES.map((title, i) => ({
    id: `conv-${seededHex(SEED + i * 100, 12)}`,
    title,
    createdAt: Date.now() - (CONVERSATION_TITLES.length - i) * 86400000 * 2,
    updatedAt: Date.now() - i * 3600000 * seededInt(SEED + i * 3, 1, 12),
    messageCount: seededInt(SEED + i * 17, 10, 15),
    lastMessage: MOCK_RESPONSES[i % MOCK_RESPONSES.length].slice(0, 80) + '...',
    model: seededPick(SEED + i * 11, MODEL_NAMES),
    totalTokens: seededInt(SEED + i * 23, 2000, 8000),
    attestationCount: seededInt(SEED + i * 17, 5, 8),
  }));
}

// ────────────────────────────────────────────────────────────
// GET /api/chat — List conversations
// ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const blocked = runMiddleware(request);
  if (blocked) return blocked;

  const conversations = generateMockConversations();
  return successResponse(conversations);
}

// ────────────────────────────────────────────────────────────
// POST /api/chat — Send message to a conversation
// ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const blocked = runMiddleware(request);
  if (blocked) return blocked;

  try {
    const body = await request.json();
    const { conversationId, content } = body as {
      conversationId?: string;
      content?: string;
    };

    if (!conversationId || !content) {
      return errorResponse(
        'VALIDATION_ERROR',
        'Both conversationId and content are required.',
        HTTP.BAD_REQUEST,
      );
    }

    const seed = Date.now();
    const response = {
      id: `msg-${seededHex(seed, 12)}`,
      conversationId,
      role: 'assistant' as const,
      content: seededPick(seed, MOCK_RESPONSES),
      timestamp: Date.now(),
      attestation: generateAttestation(seed),
      model: seededPick(seed + 100, MODEL_NAMES),
      confidence: seededInt(seed + 200, 85, 99),
      teePlatform: seededPick(seed + 300, TEE_PLATFORMS),
      tokens: seededInt(seed + 400, 150, 450),
    };

    return successResponse(response, HTTP.CREATED, {
      message: 'Message processed. TEE attestation generated.',
    });
  } catch {
    return errorResponse('INVALID_BODY', 'Request body must be valid JSON.', HTTP.BAD_REQUEST);
  }
}
