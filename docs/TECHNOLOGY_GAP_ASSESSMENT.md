# Shiora — Technology Gap Assessment & Closure Roadmap

Date: 2026-07-02. Scope: everything between the current platform (post
Tier-1-audit remediation, 239 suites / 4,005 tests / 100% coverage) and what a
top-tier digital-health incumbent (Maven Clinic, Sword, Hinge Health) ships.
Each gap states what exists today, what is missing, and the closure. Items are
> **Progress (2026-07-02):** Phase 5 all but done — **27 of 28 gaps closed**,
> each an independent commit at 100% unit coverage with the production build green.
> Phase 1–2: GAP-01/02/03/04/07/08/10/11/23; Phase 3: GAP-13/14/17/18/20;
> Phase 4: GAP-05/09/19/22/24/27; Phase 5: GAP-12/15/16/21/25/26/28. Jest suite
> grew 4,005 → 4,459 tests, plus a new Playwright E2E suite (7 specs). Remaining:
> **GAP-06** (load/perf baseline).

Items are prioritized: **P0** (correctness/operability defects), **P1** (enterprise
capability gaps), **P2** (competitive differentiation), **EXT** (externally
gated — cannot be closed by code alone and will not be faked).

---

## A. Reliability & Operations

**GAP-01 (P0) — Durable-store garbage collection is never scheduled.** ✅ CLOSED (commit 6bad28d)
`PgNonceStore`, `PgRevocationStore`, and `PgRateLimiter` all expose `prune()`,
and their own comments say "production schedules out-of-band" — but nothing in
the platform does. Under Postgres, `used_nonces`, `revoked_tokens`, and
`rate_limits` grow without bound. Closure: a maintenance subsystem — periodic
in-process sweeper registered from instrumentation (unref'd interval, Postgres
only) plus an admin-triggerable `POST /api/system/maintenance` for
ops-scheduled runs, both auditable.

**GAP-02 (P0) — No structured logging.** ✅ CLOSED (commit eb66443) Raw `console.*` calls with unstructured
strings; no levels, no JSON output, no request correlation (an `x-request-id`
is minted in edge middleware but never reaches log lines). Closure: a
zero-dependency structured logger (JSON lines, levels, child-logger context
binding), wired through API middleware and services.

**GAP-03 (P0) — No metrics.** ✅ CLOSED (commit eb66443) No request counts, latencies, error rates, rate-limit
hits, or store health — operating the platform blind. Closure: an in-process
metrics registry (counters, histograms with labels), instrumented middleware,
and a Prometheus-exposition endpoint (`GET /api/system/metrics`) gated by a
scraper token or admin session. Honest scope: per-instance metrics (correct
model for the standalone deployment; multi-replica scrapes per instance).

**GAP-04 (P1) — Rate limiting is a blunt instrument.** ✅ CLOSED (commit b54c259) One global default; a 429
carries no `Retry-After` or `X-RateLimit-*` headers, so well-behaved clients
can't back off intelligently; auth endpoints share limits with reads. Closure:
standard rate-limit response headers + stricter per-class limits on auth
endpoints.

**GAP-05 (P1) — No graceful degradation contract.** ✅ CLOSED (commit 99ee532) Postgres outage mid-request
surfaces as an unhandled 500 with no typed error, no readiness flip. Closure:
typed `DATASTORE_UNAVAILABLE` error mapping + readiness probe reflecting store
connectivity.

**GAP-06 (P2) — No load/perf baseline.** No k6/autocannon scripts, no recorded
throughput/latency baseline to detect regressions. Closure: scripted load
profile + documented baseline.

## B. Security depth

**GAP-07 (P0) — MFA exists but protects nothing.** ✅ CLOSED (commit b1ce934) TOTP enrolment/verification
shipped weeks ago; no route demands it. An attacker with a stolen session
performs every sensitive operation without a second factor. Closure: step-up
enforcement — short-lived, HMAC-signed step-up assertions minted on TOTP
verification and required (when the account is enrolled) on high-impact routes:
role assignment, GDPR erasure, org membership changes.

**GAP-08 (P1) — Sessions are invisible to their owner.** ✅ CLOSED (commit ae3999b) M-03 added revocation and
sign-out-everywhere, but users cannot see *which* sessions exist or revoke one
device. Closure: session inventory — record issued sessions (jti, device,
issued/expiry) at login; `GET /api/me/sessions` lists them with revocation
status; `DELETE /api/me/sessions/{jti}` revokes a single device.

**GAP-09 (P1) — No failed-authentication lockout.** ✅ CLOSED (commit 6b5b648) Signature verification can be
brute-forced at the per-IP rate limit forever; no per-address failure tracking,
no backoff, no audit alarm. Closure: per-address failure counter with
exponential backoff window + audit events.

**GAP-10 (P1) — CSP violations vanish.** ✅ CLOSED (commit 4a4c0de) M-01's nonce CSP blocks injected scripts
but nothing reports attempts. Closure: `report-to`/`report-uri` directive +
`POST /api/security/csp-report` collector (rate-limited, logged, metriced).

**GAP-11 (P1) — No vulnerability-disclosure channel.** ✅ CLOSED (commit 4a4c0de) No RFC 9116
`/.well-known/security.txt`. Closure: publish one (with expiry) + SECURITY.md
alignment.

**GAP-12 (P2) — No WebAuthn/passkeys.** ✅ CLOSED TOTP was the only second factor.
Closure: full FIDO2/WebAuthn passkey support as a phishing-resistant second factor,
built from first principles rather than pulling a heavyweight dependency — a minimal
RFC 8949 CBOR decoder (`crypto/cbor-lite.ts`), COSE ES256 → SPKI conversion, and node
`crypto` assertion verification (`api/webauthn.ts`). The ceremony service
(`api/webauthn-service.ts`) stores each credential in the owner-scoped encrypted
document repository (audited on enrol/enable/disable) and holds single-use, 5-minute
challenges. Six routes under `/api/webauthn/*` drive registration and assertion, with
challenge + origin + rpIdHash binding, signature verification, and a monotonic
signature counter to detect cloned authenticators (fail-closed throughout). Documented
in the OpenAPI manifest under a `Passkeys` tag. Honest scope: the challenge cache is
per-instance — a multi-replica deployment needs a shared challenge store (noted inline).

## C. Privacy engineering

**GAP-13 (P1) — Erasure is soft-delete, not crypto-shredding.** ✅ CLOSED (commit 5706b9e) GDPR Art. 17
erasure soft-deletes sealed documents; ciphertext + wrapped DEK remain
recoverable by the KEK holder. The envelope design (per-record DEKs) supports
true crypto-erasure: destroy the wrapped DEK and the ciphertext is permanently
unrecoverable. Closure: shred-on-erasure in the erasure path, audited.

**GAP-14 (P1) — KEK rotation only protects new writes.** ✅ CLOSED (commit 204ac9a) Versioned rotation
exists, but no tool re-seals historical envelopes under the current KEK; old
records stay under old keys forever, defeating rotation's purpose. Closure:
batched re-seal maintenance operation (admin, resumable, audited).

**GAP-15 (P2) — Sealed data is unsearchable.** ✅ CLOSED (commit eb88c81) Server-side
search over encrypted fields is impossible by design; there is no blind-index. Closure:
HMAC-based blind indexing (deterministic, key-derived tokens) for selected exact-match
fields — the standard searchable-encryption compromise.

**GAP-16 (P2) — No data-retention policy engine.** ✅ CLOSED (commit f034ac1) Nothing
enforces storage limitation (GDPR Art. 5(1)(e)); soft-deleted rows persist indefinitely.
Closure: retention config + purge job over soft-deleted documents past the window.

## D. API platform & integration

**GAP-17 (P1) — No idempotency keys.** ✅ CLOSED (commit ac8f946) A retried POST (client timeout, network
blip) double-creates records/grants/notes. Closure: `Idempotency-Key` header
support on mutating routes — response stored and replayed on key reuse.

**GAP-18 (P1) — Lost-update window on all documents.** ✅ CLOSED (commit 9783eea) Concurrent updates
last-write-wins silently (read-modify-write in every service). Closure:
document `version` + `If-Match`/`409 CONFLICT` optimistic concurrency.

**GAP-19 (P1) — No machine-readable API contract.** ✅ CLOSED (commit 914311b) `docs/API.md` is prose; no
OpenAPI 3.1 document, so integrators (MBZUAI IEC, pilot partners) hand-write
clients. Closure: OpenAPI spec served at `/api/openapi` generated from a
single typed route manifest, drift-tested against the route tree.

**GAP-20 (P1) — Inconsistent pagination.** ✅ CLOSED (commit eab6182) Some lists paginate, some return
everything. Closure: uniform cursor pagination on unbounded lists (audit log,
records, notifications).

**GAP-21 (P2) — No webhooks/event delivery.** ✅ CLOSED (commit c749b2d) Partners must
poll. Closure: signed webhook subscriptions with retry/backoff and an SSRF guard on the
outbound HTTP path.

**GAP-22 (P2) — No real-time channel.** ✅ CLOSED (commit ee9ddc2) Notifications are poll-based. Closure:
SSE stream (`/api/notifications/stream`) with heartbeat + reconnect.

## E. Frontend excellence

**GAP-23 (P1) — No root error containment.** ✅ CLOSED (commit d4f5911) `app/error.tsx` exists but there is
no `global-error.tsx`; a root-layout render error white-screens the app.
Closure: branded global error boundary with reset affordance.

**GAP-24 (P1) — Accessibility is untested.** ✅ CLOSED (commit a156f07) No automated a11y gate (jest-axe or
equivalent); WCAG 2.2 AA / Section 508 matter in healthcare procurement.
Closure: axe-based tests over key pages + fixes.

**GAP-25 (P2) — No i18n.** ✅ CLOSED English-only, LTR-only — a direct gap for the
UAE/MBZUAI market (Arabic, RTL). Closure: a dependency-free locale framework
(`lib/i18n/*`) with a typed message catalog (English is the source of truth; the
`Messages` type forces Arabic to supply every key), dot-path lookup with
default-locale fallback, `{param}` interpolation, and `Intl.PluralRules`-correct
pluralization (Arabic's six categories, not naive `n===1`). An `I18nProvider`
holds the active locale, exposes a translator plus `Intl`-based number/date
formatters, persists the choice (cookie + localStorage), and reflects it onto
`<html lang/dir>` so selecting Arabic mirrors the ENTIRE interface right-to-left —
app-wide RTL, not a per-page fix. A `LocaleSwitcher` (English / العربية) is wired
into Settings → Profile. English catalog values match current copy, so adopting
`t(...)` is behavior-preserving. Honest scope: the engine + shell/common strings
are translated and RTL is global; per-page body-copy extraction is incremental
against the same catalog.

**GAP-26 (P2) — No E2E suite in-repo.** ✅ CLOSED Playwright was used ad hoc during
development but no committed E2E tests existed. Closure: a committed Playwright
suite under `e2e/` (isolated from Jest's `src` roots, so the unit-coverage gate is
untouched) with its own tsconfig and a `playwright.config.ts` that boots the dev
server (in-memory datastore, no wallet needed → hermetic). Specs cover the
dashboard shell, the Arabic/RTL locale switch with reload-persistence (GAP-25), the
liveness/readiness/OpenAPI operational endpoints, and a page-level axe scan of the
dashboard and settings in both reading directions — which caught and fixed a real
`button-name` violation (an icon-only avatar button). Runnable via `npm run test:e2e`
locally and gated in CI (dedicated `e2e` job installing the pinned browser).

## F. Data layer

**GAP-27 (P1) — Pool/statement hardening.** ✅ CLOSED (commit 1ab4493) `getPgClient()` uses driver defaults:
no statement timeout, no pool bounds tuning, no connection-error strategy.
Closure: explicit pool config + `statement_timeout` + typed failure handling.

**GAP-28 (P2) — No archival/WORM export for the audit chain.** ✅ CLOSED (commit f86e083)
The chain is verifiable in-place; there is no periodic sealed export for off-platform
retention. Closure: signed, self-verifiable chain-segment export with head attestation.

## G. Externally gated (tracked, not fakeable)

- **EXT-1 CI/CD**: GitHub Actions blocked on billing. Workflow files can land
  now; runs need billing.
- **EXT-2 External security/crypto audit** (I-04) — engagement, not code.
- **EXT-3 TEE hardware, live L1 chain target** — the honesty boundary stands;
  simulated surfaces stay labeled.
- **EXT-4 Email/SMS delivery** — needs a provider contract; notification
  channels remain in-app until then.

---

## Execution order

| Phase | Items | Rationale |
|---|---|---|
| 1 (now) | GAP-01, 02, 03, 04 | Operability first: stop the leak, see the system |
| 2 (now) | GAP-07, 08, 10, 11, 23 | Security depth + containment, all self-contained |
| 3 (next) | GAP-13, 14, 17, 18, 20 | Privacy engineering + API correctness |
| 4 | GAP-05, 09, 19, 22, 24, 27 | Platform maturity |
| 5 | GAP-06, 12, 15, 16, 21, 25, 26, 28 | Differentiation |

Every closure lands as an independent commit at the standing quality bar:
100% coverage, strict TypeScript, ESLint clean, full suite + production build
green, live verification for edge/runtime-sensitive changes.
