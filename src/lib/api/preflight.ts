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
//   - the insecure wallet-address header bypass is disabled.
//
// `checkProductionReadiness()` is pure and side-effect free, so it backs the
// GET /api/health/ready probe; `assertProductionReadiness()` throws and is for
// startup/boot guards. Outside production the checks are advisory only.
// ============================================================

import { serverEnv } from './env';
import { hasConfiguredDataKey } from '@/lib/crypto/key-provider';

export interface ReadinessProblem {
  /** Stable identifier for the failing check. */
  code: string;
  /** Human-readable explanation and remediation. */
  message: string;
}

export interface ReadinessReport {
  ok: boolean;
  /** True only when running with NODE_ENV=production. */
  enforced: boolean;
  problems: ReadinessProblem[];
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
        'DATABASE_URL is not set. Production must use the Postgres datastore; '
        + 'the in-memory store is not durable and must not hold PHI.',
    });
  }

  if (!hasConfiguredDataKey()) {
    problems.push({
      code: 'DATA_KEY_DEFAULT',
      message:
        'SHIORA_DATA_ENCRYPTION_KEY is not set to a real value. PHI would be '
        + 'sealed with the insecure development key. Configure a KMS-managed key.',
    });
  }

  if (!serverEnv.hasConfiguredSessionSecret) {
    problems.push({
      code: 'SESSION_SECRET_DEFAULT',
      message:
        'SHIORA_SESSION_SECRET is not set. Sessions would be signed with the '
        + 'insecure development secret. Generate one with: openssl rand -base64 48',
    });
  }

  if (serverEnv.allowInsecureWalletHeader) {
    problems.push({
      code: 'INSECURE_WALLET_HEADER_ENABLED',
      message:
        'The x-wallet-address header bypass is enabled. It must be disabled in '
        + 'production so identity is established only by a signed session.',
    });
  }

  return {
    ok: serverEnv.isProduction ? problems.length === 0 : true,
    enforced: serverEnv.isProduction,
    problems,
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
    throw new Error(`Shiora production preflight failed:\n${detail}`);
  }
}
