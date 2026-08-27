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

const { classifyConfigProblems } = await import('../src/lib/api/config-lint.ts');

const { blocking, acknowledged } = classifyConfigProblems(process.env);

for (const problem of acknowledged) {
  console.warn(`  [ACKNOWLEDGED:${problem.code}] ${problem.message}`);
}

if (blocking.length === 0) {
  const suffix =
    acknowledged.length === 0
      ? 'no findings'
      : `${acknowledged.length} evaluation-only transport finding(s) acknowledged`;
  console.log(`✓ Configuration lint passed (${suffix}).`);
  process.exit(0);
}

console.error(`✖ Configuration lint FAILED — ${blocking.length} blocking finding(s):\n`);
for (const problem of blocking) {
  console.error(`  [${problem.code}] ${problem.message}`);
}
process.exit(1);
