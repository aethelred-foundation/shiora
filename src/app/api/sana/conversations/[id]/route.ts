// ============================================================
// Shiora on Aethelred — SANA Single Conversation API
// GET /api/sana/conversations/[id] — full transcript of one conversation
//   (all audiences; owner-scoped)
// ============================================================

import { NextRequest } from 'next/server';

import { successResponse, notFoundResponse } from '@/lib/api/responses';
import { runMiddleware, requireAuth } from '@/lib/api/middleware';
import { getConversation } from '@/lib/api/sana/sana-service';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const blocked = await runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const auth = requireAuth(request);
  if ('status' in auth) return auth;

  const { id } = await context.params;
  const conversation = await getConversation(auth.walletAddress!, id);
  if (!conversation) {
    return notFoundResponse('Conversation', id);
  }

  return successResponse(conversation);
}
