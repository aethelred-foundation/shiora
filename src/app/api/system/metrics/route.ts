// ============================================================
// Shiora on Aethelred — Metrics exposition (GAP-03)
// GET /api/system/metrics — Prometheus text format
//
// Two ways in, both machine-checkable:
//   1. `Authorization: Bearer <SHIORA_METRICS_TOKEN>` — for scrapers, which
//      cannot perform a wallet handshake. Timing-safe comparison.
//   2. An admin wallet session — for humans.
// With no token configured, only admins can read metrics.
// ============================================================

import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

import { HTTP } from '@/lib/api/responses';
import { runMiddleware } from '@/lib/api/middleware';
import { requireAdmin } from '@/lib/api/rbac';
import { serverEnv } from '@/lib/api/env';
import { renderMetrics } from '@/lib/observability/metrics';

function hasValidScraperToken(request: NextRequest): boolean {
  const configured = serverEnv.metricsToken;
  if (!configured) {
    return false;
  }
  const header = request.headers.get('authorization');
  if (!header?.startsWith('Bearer ')) {
    return false;
  }
  const presented = Buffer.from(header.slice(7));
  const expected = Buffer.from(configured);
  return presented.length === expected.length && crypto.timingSafeEqual(presented, expected);
}

export async function GET(request: NextRequest) {
  const blocked = await runMiddleware(request);
  if (blocked) return blocked;

  if (!hasValidScraperToken(request)) {
    // Fall back to an admin wallet session; its own 401/403 semantics apply.
    const admin = await requireAdmin(request);
    if (admin instanceof NextResponse) {
      return admin;
    }
  }

  return new NextResponse(renderMetrics(), {
    status: HTTP.OK,
    headers: {
      'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
