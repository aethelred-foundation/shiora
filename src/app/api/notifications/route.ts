// ============================================================
// Shiora on Aethelred — Notifications Inbox API
// GET /api/notifications — the caller's notifications (optional ?unread=true)
//   (all audiences; owner-scoped to the caller)
// ============================================================

import { NextRequest } from 'next/server';
import { runMiddleware, requireAuth } from '@/lib/api/middleware';
import { successResponse } from '@/lib/api/responses';
import { listNotifications, unreadCount } from '@/lib/api/notification-service';

export async function GET(request: NextRequest) {
  const blocked = await runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const auth = requireAuth(request);
  if ('status' in auth) return auth;

  const owner = auth.walletAddress!;
  const unreadOnly = request.nextUrl.searchParams.get('unread') === 'true';
  const [notifications, unread] = await Promise.all([
    listNotifications(owner, { unreadOnly }),
    unreadCount(owner),
  ]);

  return successResponse({ total: notifications.length, unreadCount: unread, notifications });
}
