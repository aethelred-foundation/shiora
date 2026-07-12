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

  if (!isTransitConfigured()) {
    problems.push({
      code: 'KEY_CUSTODY_NOT_TRANSIT',
      message:
        'Vault Transit DEK custody is not configured (SHIORA_TRANSIT_KEY_NAME + '
        + 'SHIORA_VAULT_ADDR/TOKEN). Production must wrap every DEK through a KMS/Vault '
        + 'so the master key never enters application memory; the in-process local KEK '
        + 'is a development backend only and must not custody production PHI keys.',
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

  if (!serverEnv.enableHsts) {
    problems.push({
      code: 'TRANSPORT_NOT_HARDENED',
      message:
        'SHIORA_ENABLE_HSTS is not enabled. Production must serve PHI only behind '
        + 'TLS with HTTP Strict Transport Security (HSTS + preload), terminated at '
        + 'the edge/reverse proxy, so clients never negotiate plaintext.',
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

  problems.push(...lintProductionConfig(process.env));

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
