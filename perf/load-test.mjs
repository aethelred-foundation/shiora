// ============================================================
// Shiora on Aethelred — Load / performance baseline (GAP-06)
//
// Drives a running server with Node's native fetch across a few representative,
// dependency-light endpoints and prints a latency/throughput table. Doubles as
// a smoke gate: it exits non-zero if any scenario returns errors, timeouts, or
// non-2xx responses under load (a cheap way to catch a regression that only
// appears under concurrency). Latency numbers are recorded, not gated, because
// absolute thresholds are hardware-dependent — the committed BASELINE.md is the
// reference point.
//
// Usage:  node perf/load-test.mjs
//   TARGET=http://localhost:3001  (default)
//   DURATION=10                   seconds per scenario
//   CONNECTIONS=20                concurrent request workers
//   REQUEST_TIMEOUT_MS=10000      timeout for each request
// ============================================================

import { performance } from 'node:perf_hooks';

const TARGET = process.env.TARGET ?? 'http://localhost:3001';
const DURATION = Number(process.env.DURATION ?? 10);
const CONNECTIONS = Number(process.env.CONNECTIONS ?? 20);
const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS ?? 10_000);

function positiveNumber(name, value) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive number`);
  }
  return value;
}

positiveNumber('DURATION', DURATION);
positiveNumber('CONNECTIONS', CONNECTIONS);
positiveNumber('REQUEST_TIMEOUT_MS', REQUEST_TIMEOUT_MS);

if (!Number.isInteger(CONNECTIONS)) {
  throw new Error('CONNECTIONS must be an integer');
}

/** Endpoints chosen to be deterministic and dependency-light (no wallet/DB). */
const SCENARIOS = [
  { name: 'liveness  GET /api/health/live', path: '/api/health/live' },
  { name: 'openapi   GET /api/openapi', path: '/api/openapi' },
  { name: 'dashboard GET /', path: '/' },
];

async function ensureServerUp() {
  try {
    const res = await fetch(`${TARGET}/api/health/live`);
    if (!res.ok) throw new Error(`health returned ${res.status}`);
  } catch (err) {
    console.error(`\n✖ No server reachable at ${TARGET} (${err.message}).`);
    console.error('  Start one first, e.g.  npm run build && npm run start\n');
    process.exit(2);
  }
}

function percentile(sorted, ratio) {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1);
  return sorted[index];
}

async function runScenario(scenario) {
  const startedAt = performance.now();
  const deadline = startedAt + DURATION * 1_000;
  const latencies = [];
  let requests = 0;
  let errors = 0;

  async function worker() {
    while (performance.now() < deadline) {
      const requestStartedAt = performance.now();
      try {
        const response = await fetch(`${TARGET}${scenario.path}`, {
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
        await response.arrayBuffer();
        if (!response.ok) errors += 1;
      } catch {
        errors += 1;
      } finally {
        requests += 1;
        latencies.push(performance.now() - requestStartedAt);
      }
    }
  }

  await Promise.all(Array.from({ length: CONNECTIONS }, worker));
  const elapsedSeconds = (performance.now() - startedAt) / 1_000;
  const sorted = latencies.sort((a, b) => a - b);

  return {
    requestsPerSecond: requests / elapsedSeconds,
    p50: percentile(sorted, 0.5),
    p99: percentile(sorted, 0.99),
    max: sorted.at(-1) ?? 0,
    errors,
  };
}

async function warmUp() {
  // Prime each route once so compile-on-demand (dev) or cold caches don't skew
  // the measured window.
  await Promise.all(SCENARIOS.map((s) => fetch(`${TARGET}${s.path}`).catch(() => {})));
}

async function main() {
  await ensureServerUp();
  await warmUp();
  console.log(`\nLoad baseline → ${TARGET}  (${CONNECTIONS} connections × ${DURATION}s each)\n`);

  const rows = [];
  let failed = false;

  for (const scenario of SCENARIOS) {
    const result = await runScenario(scenario);
    if (result.errors > 0) {
      failed = true;
    }
    rows.push({
      scenario: scenario.name,
      'req/s (mean)': Math.round(result.requestsPerSecond),
      'p50 (ms)': Math.round(result.p50 * 100) / 100,
      'p99 (ms)': Math.round(result.p99 * 100) / 100,
      'max (ms)': Math.round(result.max * 100) / 100,
      errors: result.errors,
    });
  }

  console.table(rows);

  if (failed) {
    console.error(
      '\n✖ Perf smoke gate FAILED: at least one scenario returned errors/non-2xx under load.\n',
    );
    process.exit(1);
  }
  console.log('\n✓ Perf smoke gate passed: no errors under load.\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
