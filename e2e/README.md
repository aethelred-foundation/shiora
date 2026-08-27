# End-to-end tests (Playwright) — GAP-26

Browser-driven tests that exercise the running app, complementing the Jest
unit/component suite (which is isolated and mocked). These live outside `src/`
so Jest never collects them and the 100% unit-coverage gate is unaffected.

## What is covered

| Spec | Flow |
|------|------|
| `home.spec.ts` | Dashboard loads; title, accessible skip link, `#main-content` landmark, default `lang`/`dir`. |
| `i18n.spec.ts` | Switching to Arabic flips the whole document to RTL, shows translated copy, and persists across reload (GAP-25). |
| `health.spec.ts` | Liveness/readiness probes and the OpenAPI document respond with their documented shapes. |
| `accessibility.spec.ts` | Page-level axe scan of the dashboard and settings (LTR + RTL); fails on serious/critical structural WCAG 2 A/AA violations. |

## Running locally

```bash
npm run test:e2e          # headless, boots the dev server automatically
npm run test:e2e:ui       # interactive UI mode
npm run test:e2e:report   # open the last HTML report
```

The first run downloads the Chromium build Playwright pins:

```bash
npx playwright install chromium
```

The config (`playwright.config.ts`) starts `npm run dev` on port 3001 and reuses
an already-running server locally. In CI it always starts a fresh server and
retries flaky specs twice.

## Notes

- The suite runs against the **dev server** (in-memory datastore, no wallet
  required), so it is hermetic — no external services or seeded database.
- `color-contrast` is excluded from the axe gate: contrast is a palette/design
  concern handled in design review, not a structural regression. Accessible
  names, roles, labels, landmarks, and heading order **are** enforced, in both
  reading directions.
