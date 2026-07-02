// ============================================================
// Shiora on Aethelred — Personal Activity Feed API
// GET /api/me/activity — the caller's own tamper-evident activity trail
//   (all audiences; self-scoped transparency, GDPR Art. 15)
//
// Forces actor = the authenticated caller, so a user can only ever see the
// activity recorded against their own account/data. Returns a curated view —
// no chain hashes, IP, user-agent, or request ids.
// ============================================================

import { NextRequest } from 'next/server';
import { z, ZodError } from 'zod';

import { successResponse, validationError } from '@/lib/api/responses';
import { runMiddleware, requireAuth } from '@/lib/api/middleware';
import { parseSearchParams } from '@/lib/api/validation';
import { getAuditLog } from '@/lib/api/audit-log';
import type { AuditAction } from '@/lib/api/audit';

const ActivityQuerySchema = z.object({
  action: z.string().max(64).optional(),
  since: z.string().max(40).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  cursor: z.string().max(64).optional(),
});

export async function GET(request: NextRequest) {
  const blocked = await runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const auth = requireAuth(request);
  if ('status' in auth) return auth;

  try {
    const query = parseSearchParams(ActivityQuerySchema, request.nextUrl.searchParams);

    const { items: entries, nextCursor } = await getAuditLog().listPage(
      {
        actor: auth.walletAddress!, // self-scoped — never user-supplied
        action: query.action as AuditAction | undefined,
        since: query.since,
      },
      query.cursor,
      query.limit,
    );

    const activity = entries.map((entry) => ({
      seq: entry.seq,
      timestamp: entry.timestamp,
      action: entry.action,
      resource: entry.resource,
      resourceId: entry.resourceId,
      success: entry.success,
    }));

    return successResponse({ total: activity.length, activity, nextCursor });
  } catch (err) {
    if (err instanceof ZodError) return validationError(err);
    throw err;
  }
}
