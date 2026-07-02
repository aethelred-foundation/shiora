// ============================================================
// Shiora on Aethelred — Notification SSE endpoint (GAP-22)
// GET /api/notifications/stream — real-time notifications over SSE
//
// The browser's EventSource holds this connection open and reconnects
// automatically. Per-request rendering; the response never buffers.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';

import { runMiddleware, requireAuth } from '@/lib/api/middleware';
import { buildNotificationStream } from '@/lib/api/notification-stream';
import { SSE_HEADERS } from '@/lib/api/sse';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const blocked = await runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const auth = requireAuth(request);
  if ('status' in auth) return auth;

  return new NextResponse(buildNotificationStream(auth.walletAddress!), {
    status: 200,
    headers: SSE_HEADERS,
  });
}
