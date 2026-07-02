// ============================================================
// Shiora on Aethelred — Datastore availability errors (GAP-05)
//
// When Postgres is briefly unreachable (restart, failover, connection storm),
// a query throws a low-level driver/socket error. Left unhandled it surfaces as
// an opaque 500. We instead recognize connectivity failures and raise a typed
// DatastoreUnavailableError, which the API layer maps to a 503 with a
// Retry-After — an honest "try again shortly", distinct from a real bug.
// ============================================================

/** Raised when the datastore is unreachable (as opposed to a query error). */
export class DatastoreUnavailableError extends Error {
  constructor(readonly cause?: unknown) {
    super('The datastore is temporarily unavailable.');
    this.name = 'DatastoreUnavailableError';
  }
}

export function isDatastoreUnavailableError(value: unknown): value is DatastoreUnavailableError {
  return value instanceof DatastoreUnavailableError;
}

// Node socket-level failures that mean "could not reach the server".
const SOCKET_CODES = new Set([
  'ECONNREFUSED', 'ECONNRESET', 'ENOTFOUND', 'ETIMEDOUT', 'EPIPE', 'EHOSTUNREACH', 'ENETUNREACH',
]);

// Postgres SQLSTATEs that mean the connection/server is unavailable rather than
// the query being wrong: class 08 (connection_exception) plus specific
// operational states.
const PG_UNAVAILABLE_STATES = new Set([
  '57P01', // admin_shutdown
  '57P02', // crash_shutdown
  '57P03', // cannot_connect_now
  '53300', // too_many_connections
]);

const MESSAGE_SIGNALS = [
  /connection terminated/i,
  /timeout exceeded when trying to connect/i,
  /connect(ion)? (refused|timeout|error)/i,
  /the database system is (starting up|shutting down)/i,
  /cannot use a pool after calling end/i,
  /pool is (draining|ending|destroyed)/i,
  /client has encountered a connection error/i,
];

/**
 * Whether a thrown value indicates the datastore was unreachable (a transient
 * availability failure), as opposed to a bug or a bad query.
 */
export function looksLikeConnectivityFailure(err: unknown): boolean {
  if (isDatastoreUnavailableError(err)) {
    return true;
  }
  if (typeof err !== 'object' || err === null) {
    return false;
  }
  const e = err as { code?: unknown; message?: unknown };
  const code = typeof e.code === 'string' ? e.code : '';
  if (SOCKET_CODES.has(code) || code.startsWith('08') || PG_UNAVAILABLE_STATES.has(code)) {
    return true;
  }
  const message = typeof e.message === 'string' ? e.message : '';
  return MESSAGE_SIGNALS.some((rx) => rx.test(message));
}
