// ============================================================
// Shiora on Aethelred — Webhook subscriptions (GAP-21)
// GET  /api/webhooks — list the caller's subscriptions (secrets redacted)
// POST /api/webhooks — create a subscription (returns the signing secret once)
// ============================================================

import { NextRequest } from 'next/server';
import { z, ZodError } from 'zod';

import { successResponse, errorResponse, validationError, HTTP } from '@/lib/api/responses';
import { runMiddleware, requireAuth } from '@/lib/api/middleware';
import { createSubscription, listSubscriptions } from '@/lib/api/webhook-service';

const CreateSchema = z.object({
  url: z.string().url().max(2000),
  events: z.array(z.string().max(64)).max(20).optional(),
});

export async function GET(request: NextRequest) {
  const blocked = await runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const auth = requireAuth(request);
  if ('status' in auth) return auth;

  const subscriptions = await listSubscriptions(auth.walletAddress!);
  return successResponse({ subscriptions, total: subscriptions.length });
}

export async function POST(request: NextRequest) {
  const blocked = await runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const auth = requireAuth(request);
  if ('status' in auth) return auth;

  try {
    const { url, events } = CreateSchema.parse(await request.json());
    const subscription = await createSubscription(auth.walletAddress!, { url, events });
    // The full secret is returned exactly once — the caller must store it now.
    return successResponse(subscription, HTTP.CREATED, {
      message: 'Store the signing secret now — it will not be shown again.',
    });
  } catch (err) {
    if (err instanceof ZodError) return validationError(err);
    if (err instanceof Error && /https|private|not permitted|valid URL/i.test(err.message)) {
      return errorResponse('INVALID_WEBHOOK_URL', err.message, HTTP.BAD_REQUEST);
    }
    throw err;
  }
}
