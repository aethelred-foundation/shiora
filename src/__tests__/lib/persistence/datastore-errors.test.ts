/** @jest-environment node */

import {
  DatastoreUnavailableError,
  isDatastoreUnavailableError,
  looksLikeConnectivityFailure,
} from '@/lib/persistence/datastore-errors';

describe('DatastoreUnavailableError', () => {
  it('carries its cause and is recognized by the type guard', () => {
    const cause = new Error('ECONNREFUSED');
    const err = new DatastoreUnavailableError(cause);
    expect(err.cause).toBe(cause);
    expect(err.name).toBe('DatastoreUnavailableError');
    expect(isDatastoreUnavailableError(err)).toBe(true);
    expect(isDatastoreUnavailableError(new Error('other'))).toBe(false);
  });
});

describe('looksLikeConnectivityFailure', () => {
  it('recognizes an already-typed DatastoreUnavailableError', () => {
    expect(looksLikeConnectivityFailure(new DatastoreUnavailableError())).toBe(true);
  });

  it.each(['ECONNREFUSED', 'ECONNRESET', 'ENOTFOUND', 'ETIMEDOUT', 'EPIPE', 'EHOSTUNREACH', 'ENETUNREACH'])(
    'recognizes socket error code %s',
    (code) => {
      expect(looksLikeConnectivityFailure(Object.assign(new Error('x'), { code }))).toBe(true);
    },
  );

  it.each(['08000', '08003', '08006', '08001', '08004', '08P01'])(
    'recognizes Postgres connection_exception SQLSTATE %s',
    (code) => {
      expect(looksLikeConnectivityFailure({ code })).toBe(true);
    },
  );

  it.each(['57P01', '57P02', '57P03', '53300'])(
    'recognizes operational unavailable SQLSTATE %s',
    (code) => {
      expect(looksLikeConnectivityFailure({ code })).toBe(true);
    },
  );

  it.each([
    'Connection terminated unexpectedly',
    'timeout exceeded when trying to connect',
    'connection refused',
    'the database system is starting up',
    'Cannot use a pool after calling end on the pool', // pool draining
    'Client has encountered a connection error and is not queryable',
  ])('recognizes connectivity message: %s', (message) => {
    expect(looksLikeConnectivityFailure(new Error(message))).toBe(true);
  });

  it('does NOT flag a query/constraint error or non-errors', () => {
    expect(looksLikeConnectivityFailure({ code: '23505', message: 'duplicate key' })).toBe(false); // unique violation
    expect(looksLikeConnectivityFailure(new Error('syntax error at or near'))).toBe(false);
    expect(looksLikeConnectivityFailure(null)).toBe(false);
    expect(looksLikeConnectivityFailure('a string')).toBe(false);
    expect(looksLikeConnectivityFailure({})).toBe(false);
  });
});
