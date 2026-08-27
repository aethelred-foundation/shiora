// ============================================================
// Shiora on Aethelred — Webhook subscription (GAP-21)
// DELETE /api/webhooks/{id} — remove a subscription
// ============================================================

import { NextRequest } from 'next/server';

import { successResponse, notFoundResponse } from '@/lib/api/responses';
import { runMiddleware, requireAuth } from '@/lib/api/middleware';
import { deleteSubscription } from '@/lib/api/webhook-service';
import { audit } from '@/lib/api/audit';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const blocked = await runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const auth = requireAuth(request);
  if ('status' in auth) return auth;

  const { id } = await context.params;
  const removed = await deleteSubscription(auth.walletAddress!, id);
  if (!removed) {
    return notFoundResponse('Webhook subscription', id);
  }

  audit({ action: 'WEBHOOK_DELETE', actor: auth.walletAddress!, success: true, metadata: { id } });
  return successResponse({ deleted: true, id });
}
