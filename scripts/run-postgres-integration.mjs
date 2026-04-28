#!/usr/bin/env node

import { spawnSync } from 'node:child_process';

const databaseUrl = process.env.DATABASE_URL?.trim();
const requireLivePostgres =
  process.env.CI === 'true' || process.env.SHIORA_REQUIRE_POSTGRES_INTEGRATION === 'true';

if (!databaseUrl) {
  const message =
    'Postgres integration smoke requires DATABASE_URL when CI=true or ' +
    'SHIORA_REQUIRE_POSTGRES_INTEGRATION=true.';

  if (requireLivePostgres) {
    console.error(message);
    process.exit(1);
  }

  console.log(
    'Skipping Postgres integration smoke: DATABASE_URL is not configured. ' +
      'Run `npm run test:postgres:docker` for a local live-database check.',
  );
  process.exit(0);
}

const result = spawnSync(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  [
    'jest',
    '--runTestsByPath',
    'src/__tests__/integration/postgres-store.integration.test.ts',
    '--runInBand',
  ],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      SHIORA_RUN_POSTGRES_INTEGRATION: 'true',
      SHIORA_STORE_BACKEND: 'postgres',
    },
  },
);

process.exit(result.status ?? 1);
