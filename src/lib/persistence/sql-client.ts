// ============================================================
// Shiora on Aethelred — SQL Client Port
//
// A minimal, driver-agnostic SQL surface. Production uses a `pg.Pool`; tests
// and the standalone datastore verification use an in-process Postgres engine.
// Both satisfy this one method, so the persistence adapters never depend on a
// concrete driver.
// ============================================================

export interface SqlClient {
  query<T = Record<string, unknown>>(
    text: string,
    params?: unknown[],
  ): Promise<{ rows: T[] }>;
}
