// ============================================================
// Shiora on Aethelred — Audit Trail API
// GET /api/audit — query the durable, tamper-evident audit log (admin only)
// ============================================================

import { NextRequest } from 'next/server';
import { z, ZodError } from 'zod';

import { successResponse, validationError } from '@/lib/api/responses';
import { runMiddleware } from '@/lib/api/middleware';
import { requireAdmin } from '@/lib/api/rbac';
import { parseSearchParams } from '@/lib/api/validation';
import { getAuditLog } from '@/lib/api/audit-log';
import type { AuditAction } from '@/lib/api/audit';

const AuditQuerySchema = z.object({
  actor: z.string().max(200).optional(),
  action: z.string().max(64).optional(),
  resource: z.string().max(64).optional(),
  since: z.string().max(40).optional(),
  limit: z.coerce.number().int().min(1).max(1000).default(100),
  cursor: z.string().max(64).optional(),
});

export async function GET(request: NextRequest) {
  const blocked = await runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const auth = await requireAdmin(request);
  if ('status' in auth) return auth;

  try {
    const query = parseSearchParams(AuditQuerySchema, request.nextUrl.searchParams);
    const log = getAuditLog();

    const { items: entries, nextCursor } = await log.listPage(
      {
        actor: query.actor,
        action: query.action as AuditAction | undefined,
        resource: query.resource,
        since: query.since,
      },
      query.cursor,
      query.limit,
    );
    const verification = await log.verify();

    return successResponse({ entries, nextCursor, verification });
  } catch (err) {
    if (err instanceof ZodError) return validationError(err);
    throw err;
  }
}
