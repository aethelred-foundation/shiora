// ============================================================
// Shiora on Aethelred — Liveness Probe
// GET /api/health/live — process is up and serving (orchestrator liveness)
//
// Deliberately dependency-free and unauthenticated/unthrottled so an
// orchestrator can restart an unhealthy pod without being rate limited.
// ============================================================

// NOTE: liveness probes intentionally bypass runMiddleware — infrastructure
// health checks must stay cheap and must not depend on the rate limiter or
// its datastore. They serve no user data.

import { successResponse } from '@/lib/api/responses';

export async function GET() {
  return successResponse({ status: 'alive', timestamp: new Date().toISOString() });
}
