// ============================================================
// Shiora on Aethelred — Personal Data-Access Log API
// GET /api/me/access-log — who has accessed or changed the caller's data, when
//   (all audiences; subject-scoped transparency, GDPR Art. 15 right of access)
//
// The subject's view of the audit chain: the activity feed answers "what did I
// do", this answers "what has anyone else done to my data". It surfaces every
// audited action whose data subject is the caller but whose actor is someone
// else — e.g. a provider reading records the caller granted them, or writing a
// clinical note about the caller. The subject is forced to the authenticated
// caller, so a user can only ever see actions concerning their own data.
// ============================================================

import { NextRequest } from 'next/server';
import { z, ZodError } from 'zod';

import { successResponse, validationError } from '@/lib/api/responses';
import { runMiddleware, requireAuth } from '@/lib/api/middleware';
import { parseSearchParams } from '@/lib/api/validation';
import { getAuditLog } from '@/lib/api/audit-log';

const AccessLogQuerySchema = z.object({
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
    const query = parseSearchParams(AccessLogQuerySchema, request.nextUrl.searchParams);
    const self = auth.walletAddress!;

    // excludeActor is applied IN the query so pages stay stable (a caller's own
    // actions are not disclosures and are dropped before pagination).
    const { items: entries, nextCursor } = await getAuditLog().listPage(
      {
        subject: self, // subject-scoped — never user-supplied
        excludeActor: self,
        since: query.since,
      },
      query.cursor,
      query.limit,
    );

    const accesses = entries.map((entry) => ({
      by: entry.actor,
      timestamp: entry.timestamp,
      action: entry.action,
      resource: entry.resource,
      success: entry.success,
    }));

    return successResponse({ total: accesses.length, accesses, nextCursor });
  } catch (err) {
    if (err instanceof ZodError) return validationError(err);
    throw err;
  }
}
