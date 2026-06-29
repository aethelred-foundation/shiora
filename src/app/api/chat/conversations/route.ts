// ============================================================
// Shiora on Aethelred — Chat Conversations API (backed by SANA)
// GET  /api/chat/conversations — list the caller's conversations
// POST /api/chat/conversations — start a new (empty) conversation
// ============================================================

import { NextRequest } from 'next/server';

import { successResponse, HTTP } from '@/lib/api/responses';
import { runMiddleware, extractAuth } from '@/lib/api/middleware';
import { listConversations, createEmptyConversation } from '@/lib/api/sana/sana-service';
import { toChatConversation } from '@/lib/api/chat/chat-adapter';

export async function GET(request: NextRequest) {
  const blocked = await runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const owner = extractAuth(request).walletAddress as string;
  const conversations = await listConversations(owner);
  const list = conversations.map(toChatConversation).sort((a, b) => b.updatedAt - a.updatedAt);
  return successResponse(list);
}

export async function POST(request: NextRequest) {
  const blocked = await runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const owner = extractAuth(request).walletAddress as string;
  const conversation = await createEmptyConversation(owner);
  return successResponse(toChatConversation(conversation), HTTP.CREATED);
}
