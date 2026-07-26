// ============================================================
// Shiora on Aethelred — Production Configuration Preflight
//
// A single place that answers "is this process safe to serve PHI in
// production?". It checks the configuration invariants that must hold before
// the platform handles real patient data:
//
//   - a durable datastore is configured (no in-memory PHI fallback),
//   - the PHI data-encryption key is set to a real (non-default) value,
//   - the session-signing secret is set,
//   - transport is hardened (HSTS enabled behind TLS),
//   - the insecure wallet-address header bypass is disabled,
//   - plus the configuration-linter classes (config-lint.ts): wildcard or
//     plaintext origins, debug modes, placeholder secrets, non-TLS backends,
//     and any mainnet anchoring dependency before the Aethelred gate clears.
//
// `checkProductionReadiness()` is pure and side-effect free, so it backs the
// GET /api/health/ready probe; `assertProductionReadiness()` throws and is for
// startup/boot guards. Outside production the checks are advisory only.
// ============================================================

import { serverEnv } from './env';
import { lintProductionConfig } from './config-lint';
import { hasConfiguredDataKey } from '@/lib/crypto/key-provider';
import { isTransitConfigured } from '@/lib/crypto/dek-wrapper';

export interface ReadinessProblem {
  /** Stable identifier for the failing check. */
  code: string;
  /** Human-readable explanation and remediation. */
  message: string;
}

/**
 * How the preflight is being enforced for this process:
 *  - development: NODE_ENV != production — checks are advisory only.
 *  - production:  the full PHI-grade invariant set is fatal.
 *  - evaluation:  NODE_ENV=production with SHIORA_PREFLIGHT_MODE=evaluation —
 *    an explicit operator acknowledgment that this deployment is a
 *    testnet/pilot evaluation that does NOT custody real PHI. A conservative
 *    allowlist of infrastructure gates (Vault Transit, HSTS, TLS-to-backend,
 *    durable datastore, https origins) is downgraded to acknowledged
 *    warnings; everything else — dev crypto keys, placeholder secrets, auth
 *    bypasses, wildcard origins, any mainnet target — remains fatal.
 */
export type PreflightMode = 'development' | 'evaluation' | 'production';

/** Gates an evaluation deployment may acknowledge instead of satisfying. */
const EVALUATION_ACKNOWLEDGEABLE = new Set([
  'KEY_CUSTODY_NOT_TRANSIT',
  'TRANSPORT_NOT_HARDENED',
  'NON_TLS_BACKEND',
  'DATASTORE_NOT_DURABLE',
  'INSECURE_ORIGIN',
]);

export function preflightMode(): PreflightMode {
  if (!serverEnv.isProduction) return 'development';
  return process.env.SHIORA_PREFLIGHT_MODE === 'evaluation' ? 'evaluation' : 'production';
}

export interface ReadinessReport {
  ok: boolean;
  /** True only when running with NODE_ENV=production. */
  enforced: boolean;
  /** Enforcement tier this report was evaluated under. */
  mode: PreflightMode;
  /** Blocking problems (fatal under the current mode). */
  problems: ReadinessProblem[];
  /**
   * Problems explicitly acknowledged by the evaluation profile — still real
   * gaps against production-PHI readiness, surfaced so no deployment can
   * quietly pass itself off as production-grade.
   */
  acknowledged: ReadinessProblem[];
}

/** Whether a durable (Postgres) datastore is configured. */
export function hasDurableDatastore(): boolean {
  return !!process.env.DATABASE_URL;
}

/**
 * Evaluate the production configuration invariants. In production a failing
 * check is a hard problem; outside production the same checks are reported but
 * `ok` stays true so local/dev/test runs are never blocked.
 */
export function checkProductionReadiness(): ReadinessReport {
  const problems: ReadinessProblem[] = [];

  if (!hasDurableDatastore()) {
    problems.push({
      code: 'DATASTORE_NOT_DURABLE',
      message:
        'DATABASE_URL is not set. Production must use the Postgres datastore; ' +
        'the in-memory store is not durable and must not hold PHI.',
    });
  }

  if (!(process.env.SHIORA_ALLOWED_ORIGINS ?? '').trim()) {
    problems.push({
      code: 'ORIGIN_ALLOWLIST_EMPTY',
      message:
        'SHIORA_ALLOWED_ORIGINS is empty. Production must list every approved browser origin ' +
        'exactly so wallet-backed requests cannot originate from an unapproved site.',
    });
  }

  if (!(process.env.SHIORA_ADMIN_ADDRESSES ?? '').trim()) {
    problems.push({
      code: 'ADMIN_BOOTSTRAP_EMPTY',
      message:
        'SHIORA_ADMIN_ADDRESSES is empty. Configure at least one production administrative ' +
        'wallet address so role administration and emergency operations remain recoverable.',
    });
  }

  if (!isTransitConfigured()) {
    problems.push({
      code: 'KEY_CUSTODY_NOT_TRANSIT',
      message:
        'Vault Transit DEK custody is not configured (SHIORA_TRANSIT_KEY_NAME + ' +
        'SHIORA_VAULT_ADDR/TOKEN). Production must wrap every DEK through a KMS/Vault ' +
        'so the master key never enters application memory; the in-process local KEK ' +
        'is a development backend only and must not custody production PHI keys.',
    });
  }

  // Transit custody is the production key path: the master key never enters
  // application memory, so it must not also require a local/KV KEK merely to
  // boot a fresh deployment. A local/KV KEK is required only when Transit is
  // absent (development or legacy-envelope compatibility).
  if (!isTransitConfigured() && !hasConfiguredDataKey()) {
    problems.push({
      code: 'DATA_KEY_DEFAULT',
      message:
        'Neither Vault Transit nor a managed legacy KEK is configured. PHI would be ' +
        'sealed with the insecure development key. Configure Vault Transit for ' +
        'production, or a managed KEK only for legacy-envelope compatibility.',
    });
  }

  if (!serverEnv.hasConfiguredSessionSecret) {
    problems.push({
      code: 'SESSION_SECRET_DEFAULT',
      message:
        'SHIORA_SESSION_SECRET is not set. Sessions would be signed with the ' +
        'insecure development secret. Generate one with: openssl rand -base64 48',
    });
  }

  if (!serverEnv.enableHsts) {
    problems.push({
      code: 'TRANSPORT_NOT_HARDENED',
      message:
        'SHIORA_ENABLE_HSTS is not enabled. Production must serve PHI only behind ' +
        'TLS with HTTP Strict Transport Security (HSTS + preload), terminated at ' +
        'the edge/reverse proxy, so clients never negotiate plaintext.',
    });
  }

  if (serverEnv.allowInsecureWalletHeader) {
    problems.push({
      code: 'INSECURE_WALLET_HEADER_ENABLED',
      message:
        'The x-wallet-address header bypass is enabled. It must be disabled in ' +
        'production so identity is established only by a signed session.',
    });
  }

  problems.push(...lintProductionConfig(process.env));

  const mode = preflightMode();

  if (mode === 'evaluation') {
    const acknowledged = problems.filter((p) => EVALUATION_ACKNOWLEDGEABLE.has(p.code));
    const fatal = problems.filter((p) => !EVALUATION_ACKNOWLEDGEABLE.has(p.code));
    return {
      ok: fatal.length === 0,
      enforced: true,
      mode,
      problems: fatal,
      acknowledged,
    };
  }

  return {
    ok: serverEnv.isProduction ? problems.length === 0 : true,
    enforced: serverEnv.isProduction,
    mode,
    problems,
    acknowledged: [],
  };
}

/**
 * Throw if the production configuration is not safe. Intended for a boot guard
 * so a misconfigured production deployment fails loudly rather than serving PHI
 * with insecure defaults.
 */
export function assertProductionReadiness(): void {
  const report = checkProductionReadiness();
  if (report.enforced && !report.ok) {
    const detail = report.problems.map((p) => `- ${p.code}: ${p.message}`).join('\n');
    const hint =
      report.mode === 'production'
        ? '\n\nFor a testnet/pilot deployment that does not custody real PHI, the ' +
          'infrastructure gates (Vault Transit, HSTS, TLS backends, durable ' +
          'datastore) can be explicitly acknowledged with ' +
          'SHIORA_PREFLIGHT_MODE=evaluation. Dev crypto keys, placeholder ' +
          'secrets, auth bypasses and mainnet targets are never acknowledgeable.'
        : '';
    throw new Error(`Shiora ${report.mode} preflight failed:\n${detail}${hint}`);
  }
}
