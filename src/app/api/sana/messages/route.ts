// ============================================================
// Shiora on Aethelred — SANA Message API
// POST /api/sana/messages — send a message to SANA, get a guarded reply
//   (all audiences; owner-scoped; non-diagnostic assistant)
// ============================================================

import { NextRequest } from 'next/server';
import { z, ZodError } from 'zod';

import { errorResponse, HTTP, successResponse, validationError } from '@/lib/api/responses';
import { runMiddleware, requireAuth } from '@/lib/api/middleware';
import { sendMessage } from '@/lib/api/sana/sana-service';
import { InferenceConfigurationError } from '@/lib/api/sana/inference-provider';

const MessageSchema = z.object({
  conversationId: z.string().max(80).optional(),
  message: z.string().trim().min(1).max(4000),
});

export async function POST(request: NextRequest) {
  const blocked = await runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const auth = requireAuth(request);
  if ('status' in auth) return auth;

  try {
    const { conversationId, message } = MessageSchema.parse(await request.json());
    const { conversation, reply } = await sendMessage(
      auth.walletAddress!,
      conversationId ?? null,
      message,
    );
    return successResponse({ conversationId: conversation.id, reply });
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
