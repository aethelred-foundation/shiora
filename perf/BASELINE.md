# Load / performance baseline — GAP-06

A committed reference point for HTTP throughput and latency, plus a smoke gate
(`npm run perf`) that fails if any scenario errors under concurrency. Re-run it
before/after a change to catch regressions that only surface under load.

## How to run

```bash
# 1. Start a server (either works; see the note on dev vs prod below)
npm run dev                      # in-memory datastore, no external deps
#   …or a production server (requires a provisioned datastore):
#   DATABASE_URL=... SHIORA_SESSION_SECRET=... npm run build && npm run start

# 2. Drive it
npm run perf
#   TARGET=http://localhost:3001  DURATION=10  CONNECTIONS=20   (defaults)
```

The script (`perf/load-test.mjs`) warms each route, then uses Node's native
`fetch` with concurrent request workers for `DURATION` seconds per scenario at
`CONNECTIONS` concurrency. It exits non-zero
if any scenario returns errors, timeouts, or non-2xx responses.

## Reference numbers

Recorded 2026-07-02 on the **development server** (`next dev`), so these are a
lower bound — production builds serve pre-compiled, minified output and would be
materially faster for the SSR page. The endpoints are chosen to be
deterministic and dependency-light (no wallet, no database).

- Environment: Apple M3 Pro (12 cores), macOS 27.0, Node v24.8.0, in-memory datastore.
- Config: 20 concurrent request workers × 10 s per scenario.

| Scenario | req/s (mean) | p50 (ms) | p99 (ms) | max (ms) | errors |
|----------|-------------:|---------:|---------:|---------:|-------:|
| `GET /api/health/live` (no middleware) | 223 | 79 | 176 | 288 | 0 |
| `GET /api/openapi` (spec build) | 173 | 99 | 1279 | 1361 | 0 |
| `GET /` (dashboard SSR) | 13 | 1477 | 2361 | 2364 | 0 |

## Interpreting the numbers

- **Zero errors under 20-way concurrency** is the durable, portable signal — it
  proves the request path (middleware, rate limiter, nonce CSP, SSR) has no
  crashes or unhandled rejections under load. That is what the CI-friendly gate
  asserts; absolute latency is not gated because it is hardware-dependent.
- The **liveness** probe is the fast path (it bypasses middleware by design), so
  it sets the ceiling for this machine.
- The **dashboard** row is dominated by `next dev` overhead (on-demand
  compilation, unminified bundles, no route cache). Do **not** read it as a
  production figure; a production baseline requires a provisioned Postgres
  (`DATABASE_URL`) because the app refuses the in-memory datastore in production
  to avoid holding PHI in memory. Capture and record those numbers in the target
  deployment environment.

## Next steps (not yet done — honest scope)

- Capture a production baseline in a staging environment with a real datastore.
- Add authenticated scenarios (record read/write, access-grant) behind a seeded
  session once a load-test fixture user is available.
