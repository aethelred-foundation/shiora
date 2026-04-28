#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';

const port = Number(process.env.SHIORA_E2E_PORT ?? 3101);
const baseUrl = `http://127.0.0.1:${port}`;
const nextBin = 'node_modules/.bin/next';
const defaultSmokeSessionSecret = 'shiora-e2e-smoke-session-secret-at-least-32-chars';
const configuredSessionSecret = process.env.SHIORA_SESSION_SECRET?.trim();
const smokeProductionEnv = {
  SHIORA_ALLOWED_ORIGINS: 'https://app.shiora.health',
  SHIORA_SESSION_SECRET:
    configuredSessionSecret && configuredSessionSecret.length >= 32
      ? configuredSessionSecret
      : defaultSmokeSessionSecret,
  SHIORA_ENABLE_HSTS: 'true',
  SHIORA_ALLOW_INSECURE_WALLET_HEADER: 'false',
  SHIORA_ADMIN_WALLETS:
    process.env.SHIORA_ADMIN_WALLETS?.trim() || '0x0000000000000000000000000000000000000001',
  SHIORA_ALLOW_DEMO_STORE_IN_PRODUCTION: 'false',
  SHIORA_STORE_BACKEND: 'postgres',
  DATABASE_URL:
    process.env.DATABASE_URL ?? 'postgresql://shiora:shiora@127.0.0.1:5432/shiora_smoke',
};

if (!existsSync('.next/BUILD_ID')) {
  throw new Error('Missing production build. Run `npm run build` before the E2E smoke test.');
}

if (!existsSync(nextBin)) {
  throw new Error('Missing local Next.js binary. Run `npm install` first.');
}

const server = spawn(nextBin, ['start', '-p', String(port), '-H', '127.0.0.1'], {
  env: {
    ...process.env,
    NODE_ENV: 'production',
    ...smokeProductionEnv,
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let serverOutput = '';
server.stdout.on('data', (chunk) => {
  serverOutput += chunk.toString();
});
server.stderr.on('data', (chunk) => {
  serverOutput += chunk.toString();
});

async function request(path, init) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      'user-agent': 'shiora-e2e-smoke/1.0',
      ...(init?.headers ?? {}),
    },
  });

  const contentType = response.headers.get('content-type') ?? '';
  const body = contentType.includes('application/json')
    ? await response.json()
    : await response.text();

  return { response, body };
}

async function waitForServer() {
  const startedAt = Date.now();
  let lastError;

  while (Date.now() - startedAt < 30_000) {
    if (server.exitCode !== null) {
      throw new Error(`Next server exited early with code ${server.exitCode}\n${serverOutput}`);
    }

    try {
      const { response } = await request('/api/health');
      if (response.status === 200) {
        return;
      }
    } catch (error) {
      lastError = error;
    }

    await delay(500);
  }

  throw new Error(
    `Next server did not become ready: ${lastError?.message ?? 'unknown error'}\n${serverOutput}`,
  );
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function expectPage(path) {
  const { response, body } = await request(path);
  assert(response.status === 200, `${path} expected 200, got ${response.status}`);
  assert(
    typeof body === 'string' && body.includes('Shiora'),
    `${path} did not render Shiora shell`,
  );
}

async function expectJson(path, expectedStatus, predicate) {
  const { response, body } = await request(path);
  assert(
    response.status === expectedStatus,
    `${path} expected ${expectedStatus}, got ${response.status}`,
  );
  assert(
    response.headers.get('x-content-type-options') === 'nosniff',
    `${path} missing nosniff header`,
  );
  predicate(body);
}

async function expectProtectedMutation(path, payload, expectedCode) {
  const { response, body } = await request(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  assert(response.status === 401, `${path} expected 401, got ${response.status}`);
  assert(body?.success === false, `${path} expected error envelope`);
  assert(
    body?.error?.code === expectedCode,
    `${path} expected ${expectedCode}, got ${body?.error?.code}`,
  );
}

try {
  await waitForServer();

  for (const path of ['/', '/records', '/fhir', '/compliance', '/marketplace']) {
    await expectPage(path);
  }

  await expectJson('/api/health', 200, (body) => {
    assert(body?.success === true, '/api/health expected success envelope');
    assert(body?.data?.status === 'healthy', '/api/health expected healthy status');
  });

  await expectJson('/api/network/status', 200, (body) => {
    assert(body?.success === true, '/api/network/status expected success envelope');
    assert(typeof body?.data?.blockHeight === 'number', '/api/network/status expected blockHeight');
  });

  await expectJson('/api/compliance/audit', 401, (body) => {
    assert(body?.success === false, '/api/compliance/audit expected error envelope');
    assert(body?.error?.code === 'UNAUTHORIZED', '/api/compliance/audit expected UNAUTHORIZED');
  });

  await expectProtectedMutation(
    '/api/fhir/export',
    { format: 'json', resourceTypes: ['Patient'], destination: 's3://regulated-export' },
    'UNAUTHORIZED',
  );

  console.log(`E2E smoke passed against ${baseUrl}`);
} finally {
  server.kill('SIGTERM');
}
