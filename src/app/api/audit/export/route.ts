// ============================================================
// Shiora on Aethelred — Audit-log WORM export (GAP-28)
// GET /api/audit/export?from=&to= — download a signed chain segment
//
// Admin-only. Returns a self-verifiable JSON bundle (a contiguous slice of the
// audit chain + head + HMAC signature) suitable for storage in WORM object
// storage. Verify later with verifyAuditExport — no database access needed.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { z, ZodError } from 'zod';

import { successResponse, errorResponse, validationError, HTTP } from '@/lib/api/responses';
import { runMiddleware } from '@/lib/api/middleware';
import { requireAdmin } from '@/lib/api/rbac';
import { parseSearchParams } from '@/lib/api/validation';
import { getAuditLog } from '@/lib/api/audit-log';
import { audit } from '@/lib/api/audit';

const ExportQuerySchema = z.object({
  from: z.coerce.number().int().min(0).optional(),
  to: z.coerce.number().int().min(0).optional(),
});

export async function GET(request: NextRequest) {
  const blocked = await runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const query = parseSearchParams(ExportQuerySchema, request.nextUrl.searchParams);
    if (query.from !== undefined && query.to !== undefined && query.from > query.to) {
      return errorResponse('INVALID_RANGE', '`from` must not exceed `to`.', HTTP.BAD_REQUEST);
    }

    const bundle = await getAuditLog().exportSegment(query.from, query.to);

    audit({
      action: 'DATA_EXPORT',
      actor: auth.walletAddress!,
      success: true,
      metadata: { kind: 'audit-worm', fromSeq: bundle.fromSeq, toSeq: bundle.toSeq, count: bundle.count },
    });

    return successResponse(bundle, HTTP.OK, undefined, {
      'Content-Disposition': `attachment; filename="audit-export-${bundle.fromSeq}-${bundle.toSeq}.json"`,
    });
  } catch (err) {
    if (err instanceof ZodError) return validationError(err);
    throw err;
  }
}
