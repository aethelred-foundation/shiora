// ============================================================
// Shiora on Aethelred — Audit Log API
// GET /api/access/audit — List audit entries with filtering
// ============================================================

import { NextRequest } from 'next/server';
import { ZodError } from 'zod';
import { AuditListQuerySchema, parseSearchParams } from '@/lib/api/validation';
import { paginatedResponse, validationError } from '@/lib/api/responses';
import { runMiddleware } from '@/lib/api/middleware';
import { generateMockAuditLog } from '@/lib/api/mock-data';

// ────────────────────────────────────────────────────────────
// GET /api/access/audit
// ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const blocked = runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  try {
    const query = parseSearchParams(
      AuditListQuerySchema,
      request.nextUrl.searchParams,
    );

    let entries = generateMockAuditLog();

    // Filter by type
    if (query.type) {
      entries = entries.filter((e) => e.type === query.type);
    }

    // Filter by date range
    if (query.startDate) {
      const start = new Date(query.startDate).getTime();
      entries = entries.filter((e) => e.timestamp >= start);
    }
    if (query.endDate) {
      const end = new Date(query.endDate).getTime() + 86400000; // include the end day
      entries = entries.filter((e) => e.timestamp <= end);
    }

    // Sort by timestamp descending (most recent first)
    entries = [...entries].sort((a, b) => b.timestamp - a.timestamp);

    const total = entries.length;
    const start = (query.page - 1) * query.limit;
    const paged = entries.slice(start, start + query.limit);

    return paginatedResponse(paged, total, query.page, query.limit, {
      typeCounts: {
        access: generateMockAuditLog().filter((e) => e.type === 'access').length,
        grant: generateMockAuditLog().filter((e) => e.type === 'grant').length,
        revoke: generateMockAuditLog().filter((e) => e.type === 'revoke').length,
        modify: generateMockAuditLog().filter((e) => e.type === 'modify').length,
        download: generateMockAuditLog().filter((e) => e.type === 'download').length,
      },
    });
  } catch (err) {
    if (err instanceof ZodError) return validationError(err);
    throw err;
  }
}
