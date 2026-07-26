#!/usr/bin/env node
// ============================================================
// Shiora — production configuration lint (release gate step 6)
//
// Runs the same checks the boot preflight enforces, but standalone so CI and
// operators can lint a release configuration without booting the app:
//
//   npm run config:lint            # lints the current process environment
//   env $(cat prod.env) npm run config:lint
//
// Exits non-zero on any finding. The package script runs this through `tsx`
// so the shared TypeScript module works on the project's supported Node 20
// runtime without requiring a production build first.
// ============================================================

const { lintProductionConfig } = await import('../src/lib/api/config-lint.ts');

const problems = lintProductionConfig(process.env);

if (problems.length === 0) {
  console.log('✓ Production configuration lint passed (no findings).');
  process.exit(0);
}

console.error(`✖ Production configuration lint FAILED — ${problems.length} finding(s):\n`);
for (const problem of problems) {
  console.error(`  [${problem.code}] ${problem.message}`);
}
process.exit(1);
