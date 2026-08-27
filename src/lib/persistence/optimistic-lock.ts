// ============================================================
// Shiora on Aethelred — Optimistic concurrency control (GAP-18)
//
// Every mutable row carries a monotonic `version`. An update may pass the
// version it read; if the stored version has moved on, another writer got
// there first and the update is rejected rather than silently clobbering their
// change. Routes surface this as HTTP 412 Precondition Failed on If-Match.
// ============================================================

/** Thrown when an update's expected version no longer matches the stored one. */
export class OptimisticLockError extends Error {
  constructor(
    readonly expected: number,
    readonly actual: number,
  ) {
    super(`Version conflict: expected version ${expected} but found ${actual}`);
    this.name = 'OptimisticLockError';
  }
}

export function isOptimisticLockError(value: unknown): value is OptimisticLockError {
  return value instanceof OptimisticLockError;
}

/** A row's effective version — absent (legacy rows) counts as version 1. */
export function versionOf(row: { version?: number }): number {
  return row.version ?? 1;
}
