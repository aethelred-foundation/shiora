// ============================================================
// Shiora on Aethelred — CSP violation collector (GAP-10)
// POST /api/security/csp-report
//
// Browsers post here when the nonce CSP blocks something (report-uri /
// Reporting API). Without this endpoint an injection ATTEMPT is silently
// swallowed: the attack fails but nobody learns it happened. Reports are
// unauthenticated by design — the browser's CSP machinery sends them, not
// our client code — so the endpoint accepts no user data, stores nothing,
// and only logs + counts bounded fields.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';

import { errorResponse, HTTP } from '@/lib/api/responses';
import { runMiddleware } from '@/lib/api/middleware';
import { createLogger } from '@/lib/observability/logger';
import { counter } from '@/lib/observability/metrics';

const log = createLogger({ subsystem: 'csp-report' });

const violationsTotal = counter(
  'shiora_csp_violations_total',
  'CSP violation reports received, by violated directive',
);

/** Reports get a modest budget: a broken page can emit bursts. */
const REPORT_RATE_LIMIT = { maxRequests: 30, windowMs: 60_000 };

const FIELD_MAX = 512;

function bounded(value: unknown): string {
  return typeof value === 'string' ? value.slice(0, FIELD_MAX) : 'unknown';
}

export async function POST(request: NextRequest) {
  const blocked = await runMiddleware(request, REPORT_RATE_LIMIT);
  if (blocked) return blocked;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse('INVALID_REPORT', 'Report body must be JSON.', HTTP.BAD_REQUEST);
  }

  // report-uri wraps the payload in {"csp-report": {...}}; the Reporting API
  // and hand-rolled posts may send the fields at the top level.
  const wrapper = (body ?? {}) as Record<string, unknown>;
  const report = (
    typeof wrapper['csp-report'] === 'object' && wrapper['csp-report'] !== null
      ? wrapper['csp-report']
      : wrapper
  ) as Record<string, unknown>;

  const directive = bounded(report['violated-directive'] ?? report['effective-directive']);
  violationsTotal.inc({ directive });

  log.warn('csp violation reported', {
    directive,
    blockedUri: bounded(report['blocked-uri']),
    documentUri: bounded(report['document-uri']),
    sourceFile: bounded(report['source-file']),
    lineNumber: typeof report['line-number'] === 'number' ? report['line-number'] : undefined,
  });

  return new NextResponse(null, { status: HTTP.NO_CONTENT });
}
