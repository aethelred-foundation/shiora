// ============================================================
// Shiora on Aethelred — Production configuration linter (consultant P0)
//
// Pure, dependency-free checks over an environment map, shared by three
// consumers: the boot preflight (hard-fails a production start), the release
// gate CLI (scripts/prod-config-lint.mjs), and the test suite. It catches the
// classes of misconfiguration that turn a correct build into an unsafe
// deployment: wildcard or plaintext origins, debug modes, placeholder
// secrets, non-TLS backends, and — until the Aethelred mainnet gate clears —
// any mainnet anchoring dependency.
//
// Deliberately standalone (no '@/' imports, erasable-types-only) so Node can
// run it directly via type stripping without a build step.
// ============================================================

export interface ConfigLintProblem {
  code: string;
  message: string;
}

export interface ConfigLintClassification {
  blocking: ConfigLintProblem[];
  acknowledged: ConfigLintProblem[];
}

const EVALUATION_ACKNOWLEDGEABLE_CONFIG_CODES = new Set(['INSECURE_ORIGIN', 'NON_TLS_BACKEND']);

/**
 * Anchoring targets Shiora may point at before the Aethelred mainnet gate
 * (external audit) clears: the Aethelred EVM testnets only. Anything else —
 * including any URL that names mainnet — is a release blocker by policy.
 */
export const ALLOWED_ANCHOR_CHAIN_IDS: readonly string[] = ['7331', '7332'];

function isLocalhost(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host === 'localhost' || host === '127.0.0.1' || host === '::1';
  } catch {
    return false;
  }
}

function databaseTransportIsEncrypted(databaseUrl: string): boolean {
  try {
    const url = new URL(databaseUrl);
    if (isLocalhost(databaseUrl)) return true;
    const sslMode = url.searchParams.get('sslmode')?.toLowerCase();
    return sslMode === 'require' || sslMode === 'verify-ca' || sslMode === 'verify-full';
  } catch {
    return false;
  }
}

/**
 * Lint a production environment map. Returns an empty array when the
 * configuration is releasable. Callers decide enforcement (the preflight
 * enforces only when NODE_ENV=production; the CLI always enforces).
 */
export function lintProductionConfig(env: Record<string, string | undefined>): ConfigLintProblem[] {
  const problems: ConfigLintProblem[] = [];

  // -- Origins ---------------------------------------------------------------
  const origins = (env.SHIORA_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (origins.some((origin) => origin === '*' || origin === 'null' || origin.includes('*'))) {
    problems.push({
      code: 'WILDCARD_ORIGIN',
      message:
        'SHIORA_ALLOWED_ORIGINS must list exact origins; wildcard or null origins are prohibited.',
    });
  }
  if (origins.some((origin) => origin.startsWith('http://') && !isLocalhost(origin))) {
    problems.push({
      code: 'INSECURE_ORIGIN',
      message:
        'SHIORA_ALLOWED_ORIGINS contains a plaintext http:// origin. Production origins must be https.',
    });
  }

  // -- Durable datastore transport ------------------------------------------
  const databaseUrl = env.DATABASE_URL;
  if (databaseUrl && !databaseTransportIsEncrypted(databaseUrl)) {
    problems.push({
      code: 'NON_TLS_DATABASE',
      message:
        'DATABASE_URL must require certificate-protected TLS for a non-local Postgres service ' +
        '(sslmode=require, verify-ca, or verify-full).',
    });
  }

  // -- Debug modes -----------------------------------------------------------
  if ((env.NODE_OPTIONS ?? '').includes('--inspect')) {
    problems.push({
      code: 'DEBUG_INSPECTOR_ENABLED',
      message: 'NODE_OPTIONS enables the inspector. Remote debugging must be off in production.',
    });
  }
  if (env.SHIORA_LOG_LEVEL === 'debug') {
    problems.push({
      code: 'DEBUG_LOGGING_ENABLED',
      message:
        'SHIORA_LOG_LEVEL=debug can write sensitive detail to logs. Use info or above in production.',
    });
  }
  if (env.NODE_ENV === 'production' && env.SHIORA_PROFILE && env.SHIORA_PROFILE !== 'pilot') {
    problems.push({
      code: 'UNSAFE_PRODUCTION_PROFILE',
      message:
        'Production serves only the fail-closed pilot profile. ' +
        'Remove SHIORA_PROFILE or set it to pilot.',
    });
  }

  // -- Placeholder secrets ---------------------------------------------------
  const placeholderPattern = /replace-with|changeme|example|dummy/i;
  for (const key of [
    'SHIORA_SESSION_SECRET',
    'SHIORA_DATA_ENCRYPTION_KEY',
    'SHIORA_METRICS_TOKEN',
    'SHIORA_INFERENCE_API_KEY',
  ] as const) {
    const value = env[key];
    if (value && placeholderPattern.test(value)) {
      problems.push({
        code: 'PLACEHOLDER_SECRET',
        message: `${key} looks like a placeholder value. Generate a real secret.`,
      });
    }
  }

  // -- Backend transport -----------------------------------------------------
  for (const key of [
    'SHIORA_VAULT_ADDR',
    'SHIORA_L1_RPC_URL',
    'SHIORA_INFERENCE_API_URL',
  ] as const) {
    const value = env[key];
    if (value && value.startsWith('http://') && !isLocalhost(value)) {
      problems.push({
        code: 'NON_TLS_BACKEND',
        message: `${key} uses plaintext http:// to a non-local host. Backends must be reached over TLS.`,
      });
    }
  }

  // -- Managed inference integration -----------------------------------------
  const inferenceValues = [
    env.SHIORA_INFERENCE_API_URL,
    env.SHIORA_INFERENCE_API_KEY,
    env.SHIORA_INFERENCE_DEPLOYMENT_ID,
  ];
  const configuredInferenceValues = inferenceValues.filter(Boolean).length;
  if (configuredInferenceValues > 0 && configuredInferenceValues < inferenceValues.length) {
    problems.push({
      code: 'INFERENCE_CONFIG_INCOMPLETE',
      message:
        'Managed inference configuration is incomplete. Set the API URL, API key, ' +
        'and deployment ID together, or leave all three unset so SANA fails closed.',
    });
  }

  // -- Aethelred mainnet gate ------------------------------------------------
  if (/mainnet/i.test(env.SHIORA_L1_RPC_URL ?? '')) {
    problems.push({
      code: 'MAINNET_TARGET_PROHIBITED',
      message:
        'SHIORA_L1_RPC_URL names a mainnet endpoint. Shiora must not carry a mainnet ' +
        'dependency until the Aethelred mainnet gate (external audit) has cleared.',
    });
  }
  if (env.SHIORA_L1_CHAIN_ID && !ALLOWED_ANCHOR_CHAIN_IDS.includes(env.SHIORA_L1_CHAIN_ID)) {
    problems.push({
      code: 'CHAIN_ID_NOT_ALLOWED',
      message:
        `SHIORA_L1_CHAIN_ID=${env.SHIORA_L1_CHAIN_ID} is not an approved anchoring target ` +
        `(allowed: ${ALLOWED_ANCHOR_CHAIN_IDS.join(', ')}).`,
    });
  }

  return problems;
}

/**
 * Apply the runtime preflight's narrow evaluation exception to the
 * standalone operator lint. Only transport findings may be acknowledged;
 * wildcard origins, placeholder secrets, debug modes, unsafe profiles, and
 * foreign/mainnet targets remain blocking.
 */
export function classifyConfigProblems(
  env: Record<string, string | undefined>,
  problems: ConfigLintProblem[] = lintProductionConfig(env),
): ConfigLintClassification {
  if (env.SHIORA_PREFLIGHT_MODE !== 'evaluation') {
    return { blocking: problems, acknowledged: [] };
  }

  return {
    blocking: problems.filter(
      (problem) => !EVALUATION_ACKNOWLEDGEABLE_CONFIG_CODES.has(problem.code),
    ),
    acknowledged: problems.filter((problem) =>
      EVALUATION_ACKNOWLEDGEABLE_CONFIG_CODES.has(problem.code),
    ),
  };
}
