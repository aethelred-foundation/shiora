// ============================================================
// Shiora on Aethelred — Datastore Mode Selection
//
// Every encrypted store factory (records, access, consent, marketplace, roles,
// employer, MFA, audit, rate limiter) asks this one helper whether to use the
// durable Postgres adapter. Centralising the decision lets production enforce a
// single invariant: PHI is never served from the non-durable in-memory store.
// ============================================================

import { serverEnv } from '@/lib/api/env';
import { preflightMode } from '@/lib/api/preflight';

/**
 * Whether to use the Postgres datastore. True when DATABASE_URL is configured.
 *
 * In production a missing DATABASE_URL is fatal — the in-memory store is not
 * durable and must never hold PHI — so this throws rather than silently falling
 * back. Outside production it returns false and callers use the in-memory
 * store. An acknowledged evaluation deployment (SHIORA_PREFLIGHT_MODE=
 * evaluation, which surfaces DATASTORE_NOT_DURABLE at boot and on the ready
 * probe) may run without a durable store because it custodies no real PHI.
 */
export function shouldUsePostgres(): boolean {
  if (process.env.DATABASE_URL) {
    return true;
  }
  if (serverEnv.isProduction && preflightMode() !== 'evaluation') {
    throw new Error(
      'DATABASE_URL must be set in production. The in-memory datastore is not '
      + 'durable and must not hold PHI. (Testnet/pilot evaluations that do not '
      + 'custody PHI may acknowledge this with SHIORA_PREFLIGHT_MODE=evaluation.)',
    );
  }
  return false;
}
