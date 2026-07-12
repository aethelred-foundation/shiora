// ============================================================
// Shiora on Aethelred — Break-glass restricted read (consultant P0)
// GET /api/break-glass/{id}/records — the declaring provider reads the
// patient's records while the grant is active. Read-only, records-scoped,
// and every call (allowed or denied) is audited with actor + subject.
// ============================================================

import { NextRequest } from 'next/server';

import { successResponse, errorResponse, notFoundResponse, HTTP } from '@/lib/api/responses';
import { runMiddleware } from '@/lib/api/middleware';
import { requireRole } from '@/lib/api/rbac';
import { readRecordsUnderBreakGlass } from '@/lib/api/break-glass-service';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const DENIALS = {
  forbidden: {
    code: 'FORBIDDEN',
    message: 'Only the provider who declared this emergency may read under it.',
  },
  expired: {
    code: 'BREAK_GLASS_EXPIRED',
    message: 'This emergency grant has expired. Declare a new one if the emergency persists.',
  },
  closed: {
    code: 'BREAK_GLASS_CLOSED',
    message: 'This emergency grant was closed by retrospective review.',
  },
} as const;

export async function GET(request: NextRequest, context: RouteContext) {
  const blocked = await runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const auth = await requireRole(request, 'provider');
  if ('status' in auth) return auth;

  const { id } = await context.params;
  const result = await readRecordsUnderBreakGlass(auth.walletAddress!, id);

  if (!result.ok) {
    if (result.reason === 'not_found') {
      return notFoundResponse('Break-glass grant', id);
    }
    const denial = DENIALS[result.reason];
    return errorResponse(denial.code, denial.message, HTTP.FORBIDDEN);
  }

  return successResponse({ grant: result.grant, records: result.records });
}
