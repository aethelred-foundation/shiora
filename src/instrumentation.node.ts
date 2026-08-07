// ============================================================
// Shiora on Aethelred — Node-only startup work
//
// Split out from instrumentation.ts so the edge/instrumentation bundle never
// statically pulls in node:crypto (key custody) or the Vault/preflight node
// paths. instrumentation.ts imports this ONLY inside its
// `NEXT_RUNTIME === 'nodejs'` branch, so webpack excludes it from the edge graph.
// ============================================================

import { preloadKeyProvider } from '@/lib/crypto/key-provider';
import { isVaultConfigured } from '@/lib/crypto/vault-key-provider';
import { isTransitConfigured, probeManagedDekCustody } from '@/lib/crypto/dek-wrapper';
import {
  assertProductionReadiness,
  checkProductionReadiness,
  hasDurableDatastore,
} from '@/lib/api/preflight';
import { startMaintenanceScheduler } from '@/lib/maintenance/store-maintenance';
import { createLogger } from '@/lib/observability/logger';

const startupLog = createLogger({ subsystem: 'startup' });

export async function registerNode(): Promise<void> {
  // Validate static production invariants before making dependency calls.
  assertProductionReadiness();
  // A fresh Transit-only deployment has no in-process KEK to preload: every
  // DEK is wrapped by the managed Transit key. Warm the legacy key provider
  // only when it is the active backend, or when a Vault KV compatibility key
  // is explicitly configured for historical local-kek envelopes.
  if (!isTransitConfigured() || isVaultConfigured()) {
    await preloadKeyProvider();
  }
  // Do not report a configured custody service as ready until the process has
  // proved that its scoped token can wrap a DEK with the production key.
  if (isTransitConfigured()) {
    await probeManagedDekCustody();
  }
  // An evaluation deployment boots, but never quietly: every acknowledged
  // production gap is printed at startup and stays visible on
  // GET /api/health/ready.
  const report = checkProductionReadiness();
  if (report.mode === 'evaluation' && report.acknowledged.length > 0) {
    const lines = report.acknowledged.map((p) => `  - ${p.code}: ${p.message}`).join('\n');
    console.warn(
      '\n============================================================\n' +
        'SHIORA EVALUATION DEPLOYMENT — NOT PRODUCTION-PHI READY\n' +
        'SHIORA_PREFLIGHT_MODE=evaluation acknowledged these gaps:\n' +
        `${lines}\n` +
        'This process must not custody real patient data.\n' +
        '============================================================\n',
    );
  }
  // Garbage-collect the durable auth stores (GAP-01). In-memory stores sweep
  // themselves inline, so the scheduler only matters under Postgres.
  if (hasDurableDatastore()) {
    // Apply pending schema migrations before serving. The migrator is
    // forward-only, version-tracked and idempotent, so running it at every
    // boot is safe; without it a fresh Postgres has no tables and every
    // request dies (field report: `relation "rate_limits" does not exist`
    // from the per-request Pg rate limiter). Opt out with
    // SHIORA_AUTO_MIGRATE=false when a deploy pipeline owns migrations.
    if (process.env.SHIORA_AUTO_MIGRATE !== 'false') {
      const { migrate } = await import('@/lib/persistence/migrator');
      const { getPgClient } = await import('@/lib/persistence/sql-client');
      const result = await migrate(getPgClient());
      if (result.applied.length > 0) {
        startupLog.info('database migrations applied', {
          applied: result.applied,
          alreadyApplied: result.alreadyApplied,
        });
      }
    }
    startMaintenanceScheduler();
  }
}
