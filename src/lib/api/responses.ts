// ============================================================
// Shiora on Aethelred — Standardized API Response Helpers
// Consistent JSON envelope for all API endpoints
// ============================================================

import { NextResponse } from 'next/server';

import { counter } from '@/lib/observability/metrics';
import { ZodError } from 'zod';
import { serverEnv } from './env';
import { isDatastoreUnavailableError } from '@/lib/persistence/datastore-errors';

// ────────────────────────────────────────────────────────────
// HTTP Status Constants
// ────────────────────────────────────────────────────────────

export const HTTP = {
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  PRECONDITION_FAILED: 412,
  UNPROCESSABLE: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

// ────────────────────────────────────────────────────────────
// Response Envelope Types
// ────────────────────────────────────────────────────────────

export interface APISuccessResponse<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

export interface APIPaginatedResponse<T> {
  success: true;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  meta?: Record<string, unknown>;
}

export interface APIErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/**
 * Hardened security headers applied to every API response.
 *
 * These are the application-layer half of transport hardening (the TLS floor,
 * WAF, and edge DDoS protection are enforced at the reverse proxy / API gateway).
 * `Strict-Transport-Security` is only emitted when SHIORA_ENABLE_HSTS=true — i.e.
 * when the deployment actually sits behind TLS — so development and test traffic
 * over http never advertises an unenforceable (and browser-pinned) policy.
 */
export function securityHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'X-Permitted-Cross-Domain-Policies': 'none',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
  };

  if (serverEnv.enableHsts) {
    headers['Strict-Transport-Security'] = 'max-age=63072000; includeSubDomains; preload';
  }

  return headers;
}

function buildHeaders(headers?: HeadersInit): Headers {
  const merged = new Headers({
    'Cache-Control': 'no-store, max-age=0',
    Pragma: 'no-cache',
    ...securityHeaders(),
  });

  if (!headers) {
    return merged;
  }

  new Headers(headers).forEach((value, key) => {
    merged.set(key, value);
  });

  return merged;
}

// ────────────────────────────────────────────────────────────
// Response Builders
// ────────────────────────────────────────────────────────────

// Every API response is built here, so this single counter gives app-wide
// status visibility without instrumenting 145 routes (GAP-03).
const responsesTotal = counter(
  'shiora_http_responses_total',
  'API responses by HTTP status and outcome',
);

/**
 * Return a success JSON response.
 */
export function successResponse<T>(
  data: T,
  status: number = HTTP.OK,
  meta?: Record<string, unknown>,
  headers?: HeadersInit,
): NextResponse<APISuccessResponse<T>> {
  responsesTotal.inc({ status: String(status), outcome: 'success' });
  return NextResponse.json(
    { success: true as const, data, ...(meta ? { meta } : {}) },
    { status, headers: buildHeaders(headers) },
  );
}

/**
 * Return a paginated JSON response.
 */
export function paginatedResponse<T>(
  items: T[],
  total: number,
  page: number,
  limit: number,
  meta?: Record<string, unknown>,
  headers?: HeadersInit,
): NextResponse<APIPaginatedResponse<T>> {
  const totalPages = Math.ceil(total / limit);
  responsesTotal.inc({ status: String(HTTP.OK), outcome: 'success' });
  return NextResponse.json(
    {
      success: true as const,
      data: items,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
      ...(meta ? { meta } : {}),
    },
    { status: HTTP.OK, headers: buildHeaders(headers) },
  );
}

/**
 * Return an error JSON response.
 */
export function errorResponse(
  code: string,
  message: string,
  status: number = HTTP.BAD_REQUEST,
  details?: unknown,
  headers?: HeadersInit,
): NextResponse<APIErrorResponse> {
  responsesTotal.inc({ status: String(status), outcome: 'error', code });
  return NextResponse.json(
    {
      success: false as const,
      error: { code, message, ...(details !== undefined ? { details } : {}) },
    },
    { status, headers: buildHeaders(headers) },
  );
}

/**
 * Handle Zod validation errors uniformly.
 */
export function validationError(
  err: ZodError,
  headers?: HeadersInit,
): NextResponse<APIErrorResponse> {
  return errorResponse(
    'VALIDATION_ERROR',
    'Request validation failed',
    HTTP.UNPROCESSABLE,
    err.flatten().fieldErrors,
    headers,
  );
}

/**
 * Map a thrown error to a response for the common cases, or return null so the
 * caller rethrows (a genuine 500). Handles Zod validation (422) and datastore
 * connectivity failures (503 + Retry-After) — the graceful-degradation contract
 * (GAP-05). Use as the first line of a route's catch block.
 */
export function errorFromThrow(err: unknown): NextResponse<APIErrorResponse> | null {
  if (err instanceof ZodError) {
    return validationError(err);
  }
  if (isDatastoreUnavailableError(err)) {
    return errorResponse(
      'DATASTORE_UNAVAILABLE',
      'The service is temporarily unable to reach its datastore. Please retry shortly.',
      HTTP.SERVICE_UNAVAILABLE,
      undefined,
      { 'Retry-After': '5' },
    );
  }
  return null;
}

/**
 * Return a 404 Not Found response.
 */
export function notFoundResponse(
  resource: string,
  id: string,
  headers?: HeadersInit,
): NextResponse<APIErrorResponse> {
  return errorResponse(
    'NOT_FOUND',
    `${resource} with id '${id}' not found`,
    HTTP.NOT_FOUND,
    undefined,
    headers,
  );
}
