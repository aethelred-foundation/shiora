// ============================================================
// Shiora on Aethelred — SANA Conversations List API
// GET /api/sana/conversations — the caller's SANA conversation summaries
//   (all audiences; owner-scoped)
// ============================================================

import { NextRequest } from 'next/server';

import { successResponse } from '@/lib/api/responses';
import { runMiddleware, requireAuth } from '@/lib/api/middleware';
import { listConversations } from '@/lib/api/sana/sana-service';

export async function GET(request: NextRequest) {
  const blocked = await runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const auth = requireAuth(request);
  if ('status' in auth) return auth;

  const conversations = await listConversations(auth.walletAddress!);
  const summaries = conversations
    .map((conversation) => ({
      id: conversation.id,
      title: conversation.title,
      messageCount: conversation.messages.length,
      updatedAt: conversation.updatedAt,
    }))
    .sort((a, b) => b.updatedAt - a.updatedAt);

  return successResponse({ total: summaries.length, conversations: summaries });
}
