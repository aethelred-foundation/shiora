#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];
const passes = [];

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function assertText(relativePath, checks) {
  const contents = readProjectFile(relativePath);

  for (const check of checks) {
    const passed =
      check.pattern instanceof RegExp
        ? check.pattern.test(contents)
        : contents.includes(check.pattern);

    if (!passed) {
      failures.push(`${relativePath}: ${check.message}`);
    }
  }
}

function assertFileExists(relativePath, message) {
  if (!fs.existsSync(path.join(root, relativePath))) {
    failures.push(`${relativePath}: ${message}`);
  }
}

function runGate(name, command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    failures.push(
      [
        `${name} failed with exit code ${result.status ?? 'unknown'}.`,
        result.stdout.trim(),
        result.stderr.trim(),
      ]
        .filter(Boolean)
        .join('\n'),
    );
    return;
  }

  passes.push(name);
}

assertText('src/app/api/fhir/export/route.ts', [
  {
    pattern: /runMiddleware\(request,\s*\{\s*requireAuth:\s*true\s*\}\)/s,
    message: 'FHIR export must require authenticated callers.',
  },
]);
passes.push('FHIR export authentication gate');

assertText('src/app/api/compliance/audit/route.ts', [
  {
    pattern: /runMiddleware\(request,\s*\{\s*requireAdmin:\s*true\s*\}\)/s,
    message: 'Compliance audit log must require admin authorization.',
  },
]);
passes.push('Compliance audit admin gate');

assertText('src/lib/api/store.ts', [
  {
    pattern: 'The Shiora demo file store is disabled in production',
    message: 'Demo store must fail closed in production by default.',
  },
  {
    pattern: 'SHIORA_DEMO_STORE_ENCRYPTION_KEY is required',
    message: 'Production demo-store override must require an encryption key.',
  },
  {
    pattern: 'aes-256-gcm',
    message: 'Demo store persistence must support authenticated encryption.',
  },
  {
    pattern: 'STATE_SCHEMA_VERSION',
    message: 'Persisted state must be schema-versioned.',
  },
  {
    pattern: 'STORE_AUDIT_FILE',
    message: 'Demo-store mutations must write an append-only audit journal.',
  },
  {
    pattern: 'previousHash',
    message: 'Demo-store audit journal must be hash-chained.',
  },
  {
    pattern: 'Failed to write Shiora demo-store audit journal',
    message: 'Production demo-store audit failures must fail closed.',
  },
]);
passes.push('Demo persistence safety and audit controls');

assertText('db/migrations/001_shiora_core_store.sql', [
  {
    pattern: 'CREATE TABLE IF NOT EXISTS shiora_health_records',
    message: 'Regulated persistence migration must define health records.',
  },
  {
    pattern: 'CREATE TABLE IF NOT EXISTS shiora_access_grants',
    message: 'Regulated persistence migration must define access grants.',
  },
  {
    pattern: 'CREATE TABLE IF NOT EXISTS shiora_consent_grants',
    message: 'Regulated persistence migration must define consent grants.',
  },
  {
    pattern: 'CREATE TABLE IF NOT EXISTS shiora_marketplace_listings',
    message: 'Regulated persistence migration must define marketplace listings.',
  },
  {
    pattern: 'CREATE TABLE IF NOT EXISTS shiora_store_audit_log',
    message: 'Regulated persistence migration must define an audit log table.',
  },
  {
    pattern: 'ENABLE ROW LEVEL SECURITY',
    message: 'Regulated persistence tables must enable row-level security.',
  },
  {
    pattern: 'FORCE ROW LEVEL SECURITY',
    message: 'Regulated persistence tables must force row-level security.',
  },
  {
    pattern: 'CREATE OR REPLACE FUNCTION shiora_current_wallet',
    message: 'RLS policies must bind rows to the authenticated wallet session.',
  },
  {
    pattern: 'CREATE OR REPLACE FUNCTION shiora_is_admin',
    message: 'RLS policies must support explicit admin session checks.',
  },
  {
    pattern: 'CREATE POLICY shiora_health_records_owner_select',
    message: 'Health records must have owner-scoped select policy.',
  },
  {
    pattern: 'CREATE POLICY shiora_store_audit_append_only_insert',
    message: 'Store audit log must have append-only insert policy.',
  },
  {
    pattern: 'shiora_store_audit_changed_fields_no_plaintext_phi',
    message: 'Audit migration must reject obvious plaintext PHI field names.',
  },
  {
    pattern: 'revoked_at BIGINT',
    message: 'Consent migration must persist consent revocation time.',
  },
  {
    pattern: "status IN ('Pending', 'Verified', 'Processing', 'Pinning', 'Pinned', 'Failed')",
    message: 'Health record status constraint must match API lifecycle states.',
  },
  {
    pattern: "status IN ('active', 'sold', 'expired', 'withdrawn')",
    message: 'Marketplace status constraint must support listing withdrawals.',
  },
  {
    pattern: 'CREATE OR REPLACE FUNCTION shiora_guard_marketplace_listing_update',
    message: 'Marketplace migration must guard non-seller purchase transitions at DB level.',
  },
  {
    pattern: 'CREATE POLICY shiora_marketplace_active_purchase_update',
    message: 'Marketplace RLS must permit constrained active-listing purchases.',
  },
  {
    pattern: 'b72c564ceaf14a98e22703119b01c724a13d5e1520c1f66ee8d933381f4bbfdc',
    message: 'Migration metadata must not ship with a placeholder checksum.',
  },
]);
passes.push('Regulated datastore migration baseline');

assertText('src/lib/api/postgres-store.ts', [
  {
    pattern: "from 'pg'",
    message: 'Durable production store must use the PostgreSQL driver.',
  },
  {
    pattern: 'SELECT set_config($1, $2, true)',
    message: 'Durable store must set wallet-scoped RLS session variables.',
  },
  {
    pattern: "pg_advisory_xact_lock(hashtext('shiora_store_audit_log'))",
    message: 'Durable store audit writes must serialize hash-chain updates.',
  },
  {
    pattern: 'INSERT INTO shiora_health_records',
    message: 'Durable store must persist health records to PostgreSQL.',
  },
  {
    pattern: 'INSERT INTO shiora_store_audit_log',
    message: 'Durable store must append mutation audit entries to PostgreSQL.',
  },
  {
    pattern: 'sanitizeChangedFields',
    message: 'Durable store audit entries must sanitize changed-field metadata.',
  },
  {
    pattern: 'Encrypted record metadata is retained client-side',
    message: 'Durable store must not return plaintext record labels/descriptions from DB rows.',
  },
]);
passes.push('Durable PostgreSQL store adapter');

assertText('src/lib/api/store-service.ts', [
  {
    pattern: "serverEnv.storeBackend === 'postgres'",
    message: 'API store facade must route regulated production traffic to PostgreSQL.',
  },
  {
    pattern: 'postgresStore.createRecord',
    message: 'API store facade must support durable health record writes.',
  },
  {
    pattern: 'postgresStore.createAccessGrant',
    message: 'API store facade must support durable access grant writes.',
  },
  {
    pattern: 'postgresStore.createConsent',
    message: 'API store facade must support durable consent writes.',
  },
  {
    pattern: 'postgresStore.createMarketplaceListing',
    message: 'API store facade must support durable marketplace writes.',
  },
]);
passes.push('Durable store routing facade');

for (const route of [
  'src/app/api/records/route.ts',
  'src/app/api/records/[id]/route.ts',
  'src/app/api/access/route.ts',
  'src/app/api/access/[id]/route.ts',
  'src/app/api/consent/route.ts',
  'src/app/api/consent/[id]/route.ts',
  'src/app/api/marketplace/route.ts',
  'src/app/api/marketplace/[id]/route.ts',
]) {
  assertText(route, [
    {
      pattern: '@/lib/api/store-service',
      message: 'Regulated API route must use the durable store facade.',
    },
  ]);
}
passes.push('Regulated API route durable-store wiring');

assertText('src/lib/api/env.ts', [
  {
    pattern: 'assertProductionReady',
    message: 'Regulated production readiness must be assertable from runtime configuration.',
  },
  {
    pattern: 'DATABASE_URL must point to a durable audited datastore.',
    message: 'Production readiness must require a durable datastore.',
  },
  {
    pattern: 'SHIORA_ALLOWED_ORIGINS must contain only HTTPS non-local origins.',
    message: 'Production readiness must reject local or insecure browser origins.',
  },
  {
    pattern: 'SHIORA_ALLOW_DEMO_STORE_IN_PRODUCTION must be false for regulated production.',
    message: 'Regulated production readiness must reject the demo-store escape hatch.',
  },
  {
    pattern: 'SHIORA_STORE_BACKEND must be postgres for regulated production.',
    message: 'Regulated production readiness must require the durable store backend.',
  },
]);
passes.push('Regulated production readiness assertion');

assertText('src/app/api/health/route.ts', [
  {
    pattern: 'PRODUCTION_READINESS_FAILED',
    message: 'Health endpoint must fail closed when regulated production readiness fails.',
  },
  {
    pattern: 'HTTP.SERVICE_UNAVAILABLE',
    message: 'Health endpoint must return 503 for unready regulated production deployments.',
  },
  {
    pattern: 'failureCount',
    message: 'Health endpoint must expose bounded readiness metadata for operators.',
  },
]);
passes.push('Runtime production readiness health gate');

assertText('next.config.js', [
  {
    pattern: 'poweredByHeader: false',
    message: 'Next.js framework fingerprinting header must be disabled.',
  },
  {
    pattern: "'X-Permitted-Cross-Domain-Policies'",
    message: 'Security headers must block legacy cross-domain policy files.',
  },
  {
    pattern: '`frame-ancestors',
    message: 'CSP must prevent clickjacking via frame-ancestors.',
  },
  {
    pattern: '`script-src-attr',
    message: 'CSP must block inline event handler attributes.',
  },
  {
    pattern: '`upgrade-insecure-requests`',
    message: 'Production CSP must upgrade insecure subresource requests.',
  },
]);
assertFileExists(
  'src/__tests__/config/next-security-headers.test.ts',
  'Security header policy must have regression tests.',
);
passes.push('Next.js browser security header baseline');

assertText('package.json', [
  {
    pattern: '"next": "^16.2.4"',
    message: 'Next.js must stay on the remediated current release line.',
  },
  {
    pattern: '"@openzeppelin/contracts": "^5.0.2"',
    message: 'OpenZeppelin contracts dependency must be declared.',
  },
  {
    pattern: '"pg": "^8.20.0"',
    message: 'PostgreSQL production store dependency must be declared.',
  },
  {
    pattern: '"@types/pg": "^8.20.0"',
    message: 'PostgreSQL TypeScript definitions must be declared.',
  },
  {
    pattern: '"audit:prod": "npm audit --omit=dev"',
    message: 'Production audit gate must fail on all production advisories.',
  },
  {
    pattern: '"postcss": "^8.5.12"',
    message: 'PostCSS override must keep Next.js on the patched transitive dependency line.',
  },
  {
    pattern: '"test:postgres": "node scripts/run-postgres-integration.mjs"',
    message: 'PostgreSQL integration smoke must be available as a release script.',
  },
  {
    pattern: '"test:postgres:docker": "node scripts/run-postgres-docker-integration.mjs"',
    message: 'PostgreSQL integration smoke must have a reproducible local Docker harness.',
  },
  {
    pattern: 'npm run test:postgres',
    message: 'Release check must include the PostgreSQL integration smoke.',
  },
]);
passes.push('Dependency and audit gate metadata');

assertText('scripts/run-postgres-integration.mjs', [
  {
    pattern: 'SHIORA_RUN_POSTGRES_INTEGRATION',
    message: 'PostgreSQL integration runner must explicitly enable live DB tests.',
  },
  {
    pattern: 'SHIORA_STORE_BACKEND',
    message: 'PostgreSQL integration runner must force the durable store backend.',
  },
  {
    pattern: 'postgres-store.integration.test.ts',
    message: 'PostgreSQL integration runner must execute the live store smoke test.',
  },
  {
    pattern: "process.env.CI === 'true'",
    message: 'PostgreSQL integration runner must fail closed instead of skipping in CI.',
  },
  {
    pattern: 'SHIORA_REQUIRE_POSTGRES_INTEGRATION',
    message: 'PostgreSQL integration runner must expose an explicit fail-closed mode.',
  },
]);
passes.push('PostgreSQL integration smoke runner');

assertFileExists(
  'docker-compose.postgres.yml',
  'A disposable local Postgres compose file is required for live integration verification.',
);
assertText('scripts/run-postgres-docker-integration.mjs', [
  {
    pattern: 'docker',
    message: 'Local Postgres integration harness must start Docker Compose.',
  },
  {
    pattern: 'postgresql://shiora:shiora_local_password@127.0.0.1:55432/shiora_local',
    message: 'Local Postgres integration harness must use the documented disposable database.',
  },
  {
    pattern: 'SHIORA_REQUIRE_POSTGRES_INTEGRATION',
    message: 'Local Postgres integration harness must force live DB execution.',
  },
]);
passes.push('Local PostgreSQL integration harness');

assertText('src/__tests__/integration/postgres-store.integration.test.ts', [
  {
    pattern: 'db/migrations/001_shiora_core_store.sql',
    message: 'PostgreSQL integration test must apply the regulated migration.',
  },
  {
    pattern: 'NOBYPASSRLS',
    message: 'PostgreSQL integration test must run adapter calls as an RLS-enforced app role.',
  },
  {
    pattern: 'rolbypassrls: false',
    message: 'PostgreSQL integration test must assert the app role cannot bypass RLS.',
  },
  {
    pattern: 'rec-rls-control',
    message: 'PostgreSQL integration test must include a control row proving RLS visibility.',
  },
  {
    pattern: 'createRecord(owner, record)',
    message: 'PostgreSQL integration test must write health records through the adapter.',
  },
  {
    pattern: 'updateMarketplaceListing',
    message: 'PostgreSQL integration test must cover marketplace purchase RLS.',
  },
  {
    pattern: 'not.toContain(record.label)',
    message: 'PostgreSQL integration test must prove labels are not stored in plaintext payloads.',
  },
]);
passes.push('PostgreSQL live-store integration coverage');

assertText('scripts/e2e-smoke.mjs', [
  {
    pattern: 'smokeProductionEnv',
    message: 'E2E smoke must provide synthetic production readiness settings.',
  },
  {
    pattern: "SHIORA_STORE_BACKEND: 'postgres'",
    message: 'E2E smoke must exercise the production-ready durable-store configuration.',
  },
  {
    pattern: "SHIORA_ENABLE_HSTS: 'true'",
    message: 'E2E smoke must satisfy the production HSTS readiness control.',
  },
  {
    pattern: "SHIORA_ALLOWED_ORIGINS: 'https://app.shiora.health'",
    message: 'E2E smoke must avoid local origins in production readiness mode.',
  },
]);
passes.push('Production-mode E2E readiness smoke');

assertText('.github/workflows/ci.yml', [
  {
    pattern: 'postgres:16',
    message: 'CI must provide a live PostgreSQL service for integration tests.',
  },
  {
    pattern: 'DATABASE_URL: postgresql://shiora:shiora_ci_password@localhost:5432/shiora_ci',
    message: 'CI must wire DATABASE_URL to the live PostgreSQL service.',
  },
  {
    pattern: 'foundry-rs/foundry-toolchain@v1',
    message: 'CI must install Foundry before running contract build/test gates.',
  },
  {
    pattern: 'npm ci',
    message: 'CI must perform a reproducible lockfile install.',
  },
  {
    pattern: 'npm run release:check',
    message: 'CI must enforce the full release readiness gate.',
  },
]);
passes.push('GitHub release gate enforcement');

assertFileExists('foundry.toml', 'Foundry configuration is required for reproducible builds.');
assertFileExists('contracts/test', 'Foundry regression tests must be present.');
passes.push('Foundry configuration and tests');

runGate('production dependency audit no-advisory gate', 'npm', ['audit', '--omit=dev']);

runGate('reproducible contract build', 'npm', ['run', 'contracts:build']);

if (failures.length > 0) {
  console.error('\nReview findings gate failed:\n');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('Review findings gate passed:');
for (const pass of passes) {
  console.log(`- ${pass}`);
}
