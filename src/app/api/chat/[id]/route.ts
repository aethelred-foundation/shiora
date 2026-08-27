// ============================================================
// Shiora on Aethelred — Single Conversation API (backed by SANA)
// GET    /api/chat/[id] — messages in the conversation
// POST   /api/chat/[id] — send a message to the conversation
// DELETE /api/chat/[id] — delete the conversation
// ============================================================

import { NextRequest } from 'next/server';
import { z, ZodError } from 'zod';

import {
  errorResponse,
  successResponse,
  notFoundResponse,
  validationError,
  HTTP,
} from '@/lib/api/responses';
import { runMiddleware, extractAuth } from '@/lib/api/middleware';
import { getConversation, sendMessage, deleteConversation } from '@/lib/api/sana/sana-service';
import { toChatMessage } from '@/lib/api/chat/chat-adapter';
import { InferenceConfigurationError } from '@/lib/api/sana/inference-provider';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const SendSchema = z.object({
  content: z.string().trim().min(1).max(4000),
});

export async function GET(request: NextRequest, context: RouteContext) {
  const blocked = await runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const owner = extractAuth(request).walletAddress as string;
  const { id } = await context.params;
  const conversation = await getConversation(owner, id);
  if (!conversation) return notFoundResponse('Conversation', id);

  return successResponse(conversation.messages.map((message, i) => toChatMessage(id, message, i)));
}

export async function POST(request: NextRequest, context: RouteContext) {
  const blocked = await runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const owner = extractAuth(request).walletAddress as string;
  const { id } = await context.params;
  const conversation = await getConversation(owner, id);
  if (!conversation) return notFoundResponse('Conversation', id);

  try {
    const { content } = SendSchema.parse(await request.json());
    const { conversation: saved, reply } = await sendMessage(owner, id, content);
    return successResponse(toChatMessage(id, reply, saved.messages.length - 1), HTTP.CREATED);
  } catch (err) {
    if (err instanceof ZodError) return validationError(err);
    if (err instanceof InferenceConfigurationError) {
      return errorResponse(
        'INFERENCE_SERVICE_NOT_CONFIGURED',
        'The health assistant is unavailable because its managed inference service is not configured.',
        HTTP.SERVICE_UNAVAILABLE,
      );
    }
    throw err;
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const blocked = await runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const owner = extractAuth(request).walletAddress as string;
  const { id } = await context.params;
  const deleted = await deleteConversation(owner, id);
  if (!deleted) return notFoundResponse('Conversation', id);

  return successResponse({ id, deleted: true });
}
