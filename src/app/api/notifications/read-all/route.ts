// ============================================================
// Shiora on Aethelred — Mark All Notifications Read API
// POST /api/notifications/read-all — mark every unread notification read
//   (all audiences; owner-scoped to the caller)
// ============================================================

import { NextRequest } from 'next/server';
import { runMiddleware, requireAuth } from '@/lib/api/middleware';
import { successResponse } from '@/lib/api/responses';
import { markAllRead } from '@/lib/api/notification-service';

export async function POST(request: NextRequest) {
  const blocked = await runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const auth = requireAuth(request);
  if ('status' in auth) return auth;

  const updated = await markAllRead(auth.walletAddress!);
  return successResponse({ markedRead: updated });
}
