// ============================================================
// Shiora on Aethelred — Startup instrumentation
//
// Next.js runs register() once per server process, in every runtime. The actual
// boot work (warm Vault key custody + production-readiness hard-fail) lives in
// instrumentation.node.ts and is imported ONLY on the nodejs runtime, so the
// edge build never bundles node:crypto / Vault paths (which 500s the app).
// ============================================================

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') {
    return;
  }

  const { registerNode } = await import('./instrumentation.node');
  await registerNode();
}
