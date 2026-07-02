// ============================================================
// Shiora on Aethelred — Webhook test delivery (GAP-21)
// POST /api/webhooks/{id}/test — send a signed ping to the subscription
//
// Lets a subscriber confirm their endpoint receives and verifies deliveries.
// ============================================================

import { NextRequest } from 'next/server';

import { successResponse, notFoundResponse } from '@/lib/api/responses';
import { runMiddleware, requireAuth } from '@/lib/api/middleware';
import { getSubscription, deliverWebhook } from '@/lib/api/webhook-service';
import { audit } from '@/lib/api/audit';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  const blocked = await runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const auth = requireAuth(request);
  if ('status' in auth) return auth;

  const { id } = await context.params;
  const subscription = await getSubscription(auth.walletAddress!, id);
  if (!subscription) {
    return notFoundResponse('Webhook subscription', id);
  }

  const result = await deliverWebhook(subscription, {
    type: 'webhook.test',
    data: { message: 'This is a test delivery from Shiora.' },
  });

  audit({
    action: 'WEBHOOK_TEST',
    actor: auth.walletAddress!,
    success: result.delivered,
    metadata: { id, delivered: result.delivered, attempts: result.attempts },
  });

  return successResponse(result);
}
