// ============================================================
// Shiora on Aethelred — Startup instrumentation
//
// Next.js runs register() once per server process. We use it as the boot guard
// the consultant asked for: warm up key custody (fetch the KEK from Vault before
// any PHI is served) and, in production, hard-fail if the platform is not
// configured safely (durable DB, key custody, session secret, TLS/HSTS).
//
// Node-only work is guarded by NEXT_RUNTIME and loaded via dynamic import so the
// edge runtime never bundles the node crypto/Vault paths.
// ============================================================

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') {
    return;
  }

  const { preloadKeyProvider } = await import('@/lib/crypto/key-provider');
  await preloadKeyProvider();

  const { assertProductionReadiness } = await import('@/lib/api/preflight');
  assertProductionReadiness();
}
