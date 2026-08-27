// ============================================================
// Shiora on Aethelred — Notification Read API
// PATCH /api/notifications/[id] — mark one notification read
//   (all audiences; owner-scoped to the caller)
// ============================================================

import { NextRequest } from 'next/server';
import { runMiddleware, requireAuth } from '@/lib/api/middleware';
import { successResponse, notFoundResponse } from '@/lib/api/responses';
import { markRead } from '@/lib/api/notification-service';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const blocked = await runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const auth = requireAuth(request);
  if ('status' in auth) return auth;

  const { id } = await context.params;
  const updated = await markRead(auth.walletAddress!, id);
  if (!updated) {
    return notFoundResponse('Notification', id);
  }
  return successResponse(updated);
}
