#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

import { Pool } from 'pg';

const composeFile = 'docker-compose.postgres.yml';
const databaseUrl =
  process.env.DATABASE_URL ??
  'postgresql://shiora:shiora_local_password@127.0.0.1:55432/shiora_local';
const keepAlive = process.env.SHIORA_KEEP_POSTGRES_DOCKER === 'true';

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    ...options,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} exited with code ${result.status}`);
  }
}

async function waitForPostgres() {
  const startedAt = Date.now();
  let lastError;

  while (Date.now() - startedAt < 30_000) {
    const pool = new Pool({ connectionString: databaseUrl });
    try {
      await pool.query('SELECT 1');
      await pool.end();
      return;
    } catch (error) {
      lastError = error;
      await pool.end().catch(() => undefined);
      await delay(500);
    }
  }

  throw new Error(`Postgres did not become ready: ${lastError?.message ?? 'unknown error'}`);
}

let exitCode = 1;

try {
  run('docker', ['compose', '-f', composeFile, 'up', '-d', 'postgres']);
  await waitForPostgres();

  const result = spawnSync(process.execPath, ['scripts/run-postgres-integration.mjs'], {
    stdio: 'inherit',
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      SHIORA_REQUIRE_POSTGRES_INTEGRATION: 'true',
    },
  });

  if (result.error) {
    throw result.error;
  }

  exitCode = result.status ?? 1;
} finally {
  if (!keepAlive) {
    spawnSync('docker', ['compose', '-f', composeFile, 'down', '-v'], {
      stdio: 'inherit',
    });
  }
}

process.exit(exitCode);
