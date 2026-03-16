// ============================================================
// Shiora on Aethelred — Chat Conversations API
// GET  /api/chat/conversations — List all conversations
// POST /api/chat/conversations — Create a new conversation
// ============================================================

import { NextRequest } from 'next/server';
import { runMiddleware } from '@/lib/api/middleware';
import {
  successResponse,
  HTTP,
} from '@/lib/api/responses';
import {
  seededHex,
  seededInt,
  seededPick,
} from '@/lib/utils';
import { AI_MODELS } from '@/lib/constants';

// ────────────────────────────────────────────────────────────
// Mock Data
// ────────────────────────────────────────────────────────────

const SEED = 600;

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
    lastMessage: 'Based on your cycle data from the last 6 months...',
    model: seededPick(SEED + i * 11, MODEL_NAMES),
    totalTokens: seededInt(SEED + i * 23, 2000, 8000),
    attestationCount: seededInt(SEED + i * 17, 5, 8),
  }));
}

// ────────────────────────────────────────────────────────────
// GET /api/chat/conversations
// ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const blocked = runMiddleware(request);
  if (blocked) return blocked;

  const conversations = generateMockConversations();
  return successResponse(conversations);
}

// ────────────────────────────────────────────────────────────
// POST /api/chat/conversations — Create new conversation
// ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const blocked = runMiddleware(request);
  if (blocked) return blocked;

  const seed = Date.now();
  const conversation = {
    id: `conv-${seededHex(seed, 12)}`,
    title: 'New Conversation',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messageCount: 0,
    lastMessage: '',
    model: seededPick(seed, MODEL_NAMES),
    totalTokens: 0,
    attestationCount: 0,
  };

  return successResponse(conversation, HTTP.CREATED, {
    message: 'Conversation created.',
  });
}
