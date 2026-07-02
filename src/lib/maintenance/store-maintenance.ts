// ============================================================
// Shiora on Aethelred — Durable-store maintenance (GAP-01)
//
// The Postgres-backed auth stores (used_nonces, revoked_tokens, rate_limits)
// each expose prune(), but nothing scheduled it — under DATABASE_URL those
// tables grew without bound. This module is the single place that garbage-
// collects them: a periodic in-process sweeper started from instrumentation
// on durable deployments, plus POST /api/system/maintenance for ops-triggered
// runs. In-memory stores sweep themselves inline and need no maintenance.
// ============================================================

import { getNonceStore } from '@/lib/persistence/nonce-store';
import { getRevocationStore } from '@/lib/persistence/revocation-store';
import { getRateLimiter } from '@/lib/api/rate-limiter';
import { getSessionIndexStore } from '@/lib/persistence/session-index-store';
import { hasDurableDatastore } from '@/lib/api/preflight';
import { createLogger } from '@/lib/observability/logger';
import { counter } from '@/lib/observability/metrics';

const log = createLogger({ subsystem: 'maintenance' });

const prunedTotal = counter(
  'shiora_maintenance_pruned_total',
  'Expired rows removed from durable stores, by store',
);

const runsTotal = counter(
  'shiora_maintenance_runs_total',
  'Maintenance runs, by outcome',
);

/** Keep completed rate-limit windows this long for incident forensics. */
export const RATE_LIMIT_RETENTION_MS = 60 * 60 * 1000;

/** Default cadence for the in-process sweeper. */
export const DEFAULT_MAINTENANCE_INTERVAL_MS = 15 * 60 * 1000;

interface Prunable {
  prune?(arg: number): Promise<number>;
}

export interface MaintenanceReport {
  /** Whether a durable (Postgres) datastore is configured. */
  durable: boolean;
  prunedNonces: number;
  prunedRevocations: number;
  prunedRateLimitWindows: number;
  prunedSessions: number;
  ranAt: number;
}

/**
 * Prune expired rows from every durable store. Safe to call on in-memory
 * deployments: stores without a prune() are skipped and counts stay zero.
 */
export async function runStoreMaintenance(now: number = Date.now()): Promise<MaintenanceReport> {
  const report: MaintenanceReport = {
    durable: hasDurableDatastore(),
    prunedNonces: 0,
    prunedRevocations: 0,
    prunedRateLimitWindows: 0,
    prunedSessions: 0,
    ranAt: now,
  };

  const nonces = getNonceStore() as Prunable;
  if (typeof nonces.prune === 'function') {
    report.prunedNonces = await nonces.prune(now);
    prunedTotal.inc({ store: 'nonces' }, report.prunedNonces);
  }

  const revocations = getRevocationStore() as Prunable;
  if (typeof revocations.prune === 'function') {
    report.prunedRevocations = await revocations.prune(now);
    prunedTotal.inc({ store: 'revocations' }, report.prunedRevocations);
  }

  const rateLimiter = getRateLimiter() as Prunable;
  if (typeof rateLimiter.prune === 'function') {
    report.prunedRateLimitWindows = await rateLimiter.prune(RATE_LIMIT_RETENTION_MS);
    prunedTotal.inc({ store: 'rate_limits' }, report.prunedRateLimitWindows);
  }

  const sessions = getSessionIndexStore() as Prunable;
  if (typeof sessions.prune === 'function') {
    report.prunedSessions = await sessions.prune(now);
    prunedTotal.inc({ store: 'sessions' }, report.prunedSessions);
  }

  runsTotal.inc({ outcome: 'ok' });
  log.info('store maintenance completed', { ...report });
  return report;
}

// ────────────────────────────────────────────────────────────
// In-process scheduler
// ────────────────────────────────────────────────────────────

let handle: ReturnType<typeof setInterval> | null = null;

/**
 * Start the periodic sweeper. Idempotent: returns false when already running.
 * The interval is unref'd so it never keeps the process alive on shutdown.
 */
export function startMaintenanceScheduler(
  intervalMs: number = DEFAULT_MAINTENANCE_INTERVAL_MS,
): boolean {
  if (handle !== null) {
    return false;
  }
  handle = setInterval(() => {
    // A failing sweep must never take the process down; report and retry
    // on the next tick.
    runStoreMaintenance().catch((err: unknown) => {
      runsTotal.inc({ outcome: 'error' });
      log.error('store maintenance failed', { err });
    });
  }, intervalMs);
  handle.unref();
  log.info('maintenance scheduler started', { intervalMs });
  return true;
}

/** Stop the periodic sweeper (no-op when not running). */
export function stopMaintenanceScheduler(): void {
  if (handle !== null) {
    clearInterval(handle);
    handle = null;
  }
}
