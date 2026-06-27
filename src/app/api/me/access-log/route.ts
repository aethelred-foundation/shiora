// ============================================================
// Shiora on Aethelred — Personal Data-Access Log API
// GET /api/me/access-log — who has accessed the caller's records, and when
//   (all audiences; subject-scoped transparency, GDPR Art. 15 right of access)
//
// The subject's view of the audit chain: the activity feed answers "what did I
// do", this answers "who accessed my data". It surfaces RECORD_READ events on
// the caller's records made by someone other than the caller (i.e. providers
// reading records the caller granted them access to). Forces the subject to the
// authenticated caller, so a user can only ever see accesses to their own data.
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
});

export async function GET(request: NextRequest) {
  const blocked = await runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const auth = requireAuth(request);
  if ('status' in auth) return auth;

  try {
    const query = parseSearchParams(AccessLogQuerySchema, request.nextUrl.searchParams);
    const self = auth.walletAddress!;

    const entries = await getAuditLog().list({
      action: 'RECORD_READ',
      resource: 'health_records',
      resourceId: self, // subject-scoped — never user-supplied
      since: query.since,
      limit: query.limit,
    });

    // Defensive: only third-party accesses (the caller's own reads are not it).
    const accesses = entries
      .filter((entry) => entry.actor !== self)
      .map((entry) => ({
        by: entry.actor,
        timestamp: entry.timestamp,
        action: entry.action,
        success: entry.success,
      }));

    return successResponse({ total: accesses.length, accesses });
  } catch (err) {
    if (err instanceof ZodError) return validationError(err);
    throw err;
  }
}
