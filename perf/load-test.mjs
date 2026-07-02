// ============================================================
// Shiora on Aethelred — Load / performance baseline (GAP-06)
//
// Drives a running server with autocannon across a few representative,
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
//   CONNECTIONS=20                concurrent connections
// ============================================================

import autocannon from 'autocannon';

const TARGET = process.env.TARGET ?? 'http://localhost:3001';
const DURATION = Number(process.env.DURATION ?? 10);
const CONNECTIONS = Number(process.env.CONNECTIONS ?? 20);

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

function runScenario(scenario) {
  return autocannon({
    url: `${TARGET}${scenario.path}`,
    connections: CONNECTIONS,
    duration: DURATION,
    pipelining: 1,
  });
}

function errorCount(result) {
  return (result.errors ?? 0) + (result.timeouts ?? 0) + (result.non2xx ?? 0);
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
    const errors = errorCount(result);
    if (errors > 0) {
      failed = true;
    }
    rows.push({
      scenario: scenario.name,
      'req/s (mean)': Math.round(result.requests.mean),
      'p50 (ms)': result.latency.p50,
      'p99 (ms)': result.latency.p99,
      'max (ms)': result.latency.max,
      errors,
    });
  }

  console.table(rows);

  if (failed) {
    console.error('\n✖ Perf smoke gate FAILED: at least one scenario returned errors/non-2xx under load.\n');
    process.exit(1);
  }
  console.log('\n✓ Perf smoke gate passed: no errors under load.\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
