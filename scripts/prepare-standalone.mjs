#!/usr/bin/env node
/**
 * Assemble a runnable Next.js standalone bundle.
 *
 * `output: "standalone"` emits a minimal server at .next/standalone/server.js
 * but DELIBERATELY excludes the client assets (.next/static) and the public/
 * folder — and `next start` refuses standalone builds outright. Serving the
 * standalone server without the assets returns HTML whose /_next/static/*
 * chunks all 404, so nothing hydrates. This copies the assets into the
 * standalone tree so `node .next/standalone/server.js` is fully working.
 *
 * Runs automatically after `next build` (postbuild); safe to re-run.
 */
import { cpSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const standalone = join(root, '.next', 'standalone');

if (!existsSync(join(standalone, 'server.js'))) {
  console.log('[standalone] no standalone server (output != "standalone"); nothing to prepare.');
  process.exit(0);
}

const staticSrc = join(root, '.next', 'static');
const staticDst = join(standalone, '.next', 'static');
if (existsSync(staticSrc)) {
  rmSync(staticDst, { recursive: true, force: true });
  cpSync(staticSrc, staticDst, { recursive: true });
  console.log('[standalone] copied .next/static');
}

const publicSrc = join(root, 'public');
const publicDst = join(standalone, 'public');
if (existsSync(publicSrc)) {
  rmSync(publicDst, { recursive: true, force: true });
  cpSync(publicSrc, publicDst, { recursive: true });
  console.log('[standalone] copied public/');
}

// The standalone server chdir()s into .next/standalone and loads env files
// from THERE — a repo-root .env.local is silently ignored (verified: the
// preflight then fails on SESSION_SECRET_DEFAULT/DATA_KEY_DEFAULT even with a
// valid root .env.local). Copy the runtime env files so the standalone server
// sees the same configuration `next dev`/`next start` would.
for (const envFile of ['.env', '.env.production', '.env.local', '.env.production.local']) {
  const src = join(root, envFile);
  if (existsSync(src)) {
    cpSync(src, join(standalone, envFile));
    console.log(`[standalone] copied ${envFile}`);
  }
}

console.log('[standalone] ready — run: PORT=3001 npm run start:standalone');
