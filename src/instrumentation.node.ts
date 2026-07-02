// ============================================================
// Shiora on Aethelred — Node-only startup work
//
// Split out from instrumentation.ts so the edge/instrumentation bundle never
// statically pulls in node:crypto (key custody) or the Vault/preflight node
// paths. instrumentation.ts imports this ONLY inside its
// `NEXT_RUNTIME === 'nodejs'` branch, so webpack excludes it from the edge graph.
// ============================================================

import { preloadKeyProvider } from '@/lib/crypto/key-provider';
import { assertProductionReadiness, hasDurableDatastore } from '@/lib/api/preflight';
import { startMaintenanceScheduler } from '@/lib/maintenance/store-maintenance';

export async function registerNode(): Promise<void> {
  // Warm key custody (fetch + cache the KEK from Vault) before any PHI is served.
  await preloadKeyProvider();
  // In production, hard-fail a misconfigured boot (durable DB, key custody,
  // session secret, TLS/HSTS).
  assertProductionReadiness();
  // Garbage-collect the durable auth stores (GAP-01). In-memory stores sweep
  // themselves inline, so the scheduler only matters under Postgres.
  if (hasDurableDatastore()) {
    startMaintenanceScheduler();
  }
}
