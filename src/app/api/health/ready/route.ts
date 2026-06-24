// ============================================================
// Shiora on Aethelred — Readiness Probe
// GET /api/health/ready — safe to receive production traffic?
//
// Reports the production configuration preflight and (when a durable datastore
// is configured) a live datastore round-trip. Returns 503 when not ready so an
// orchestrator holds traffic until the instance is correctly provisioned.
// Unauthenticated/unthrottled, like the liveness probe.
// ============================================================

import { successResponse, errorResponse, HTTP } from '@/lib/api/responses';
import { checkProductionReadiness, hasDurableDatastore } from '@/lib/api/preflight';
import { getPgClient } from '@/lib/persistence/sql-client';

export async function GET() {
  const config = checkProductionReadiness();
  const checks: Record<string, unknown> = {
    config: { ok: config.ok, enforced: config.enforced, problems: config.problems },
  };

  if (hasDurableDatastore()) {
    try {
      await getPgClient().query('SELECT 1');
      checks.datastore = { ok: true, driver: 'postgres' };
    } catch {
      checks.datastore = { ok: false, driver: 'postgres', error: 'unreachable' };
      return errorResponse(
        'NOT_READY',
        'Datastore is unreachable.',
        HTTP.SERVICE_UNAVAILABLE,
        checks,
      );
    }
  } else {
    checks.datastore = { ok: true, driver: 'in-memory' };
  }

  if (!config.ok) {
    return errorResponse(
      'NOT_READY',
      'Production configuration is incomplete.',
      HTTP.SERVICE_UNAVAILABLE,
      checks,
    );
  }

  return successResponse({ status: 'ready', checks });
}
