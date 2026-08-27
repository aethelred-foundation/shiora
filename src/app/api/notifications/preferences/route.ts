// ============================================================
// Shiora on Aethelred — Notification Preferences API
// GET /api/notifications/preferences — the caller's muted notification types
// PUT /api/notifications/preferences — set the caller's muted types
//   (all audiences; owner-scoped to the caller)
// ============================================================

import { NextRequest } from 'next/server';
import { z, ZodError } from 'zod';

import { successResponse, validationError } from '@/lib/api/responses';
import { runMiddleware, requireAuth } from '@/lib/api/middleware';
import {
  getNotificationPreferences,
  setMutedNotificationTypes,
} from '@/lib/api/notification-service';

const NOTIFICATION_TYPES = [
  'data_request_decision', 'care_gap', 'consent', 'clinical_note', 'wellness', 'system',
] as const;

const PreferencesSchema = z.object({
  mutedTypes: z.array(z.enum(NOTIFICATION_TYPES)).max(NOTIFICATION_TYPES.length),
});

export async function GET(request: NextRequest) {
  const blocked = await runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const auth = requireAuth(request);
  if ('status' in auth) return auth;

  return successResponse(await getNotificationPreferences(auth.walletAddress!));
}

export async function PUT(request: NextRequest) {
  const blocked = await runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const auth = requireAuth(request);
  if ('status' in auth) return auth;

  try {
    const { mutedTypes } = PreferencesSchema.parse(await request.json());
    return successResponse(await setMutedNotificationTypes(auth.walletAddress!, mutedTypes));
  } catch (err) {
    if (err instanceof ZodError) return validationError(err);
    throw err;
  }
}
