// ============================================================
// Shiora on Aethelred — Chat API (backed by the real SANA engine)
// GET  /api/chat — list the caller's conversations
// POST /api/chat — send a message (creates a conversation when none is given)
//
// Owner-scoped, non-diagnostic. This is the chat UI's surface over the SANA
// service (guardrails + LLM seam); it is NOT TEE-attested and fabricates no
// attestation/token data. See the sana_assistant maturity entry.
// ============================================================

import { NextRequest } from 'next/server';
import { z, ZodError } from 'zod';

import { successResponse, validationError, HTTP } from '@/lib/api/responses';
import { runMiddleware, extractAuth } from '@/lib/api/middleware';
import { listConversations, sendMessage } from '@/lib/api/sana/sana-service';
import { toChatConversation, toChatMessage } from '@/lib/api/chat/chat-adapter';

const SendSchema = z.object({
  conversationId: z.string().max(80).optional(),
  content: z.string().trim().min(1).max(4000),
});

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
  try {
    const { conversationId, content } = SendSchema.parse(await request.json());
    const { conversation, reply } = await sendMessage(owner, conversationId ?? null, content);
    return successResponse(
      toChatMessage(conversation.id, reply, conversation.messages.length - 1),
      HTTP.CREATED,
    );
  } catch (err) {
    if (err instanceof ZodError) return validationError(err);
    throw err;
  }
}
