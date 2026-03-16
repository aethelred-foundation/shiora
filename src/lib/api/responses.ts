// ============================================================
// Shiora on Aethelred — Standardized API Response Helpers
// Consistent JSON envelope for all API endpoints
// ============================================================

import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

// ────────────────────────────────────────────────────────────
// HTTP Status Constants
// ────────────────────────────────────────────────────────────

export const HTTP = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL: 500,
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

function buildHeaders(headers?: HeadersInit): Headers {
  const merged = new Headers({
    'Cache-Control': 'no-store, max-age=0',
    Pragma: 'no-cache',
    'X-Content-Type-Options': 'nosniff',
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

/**
 * Return a success JSON response.
 */
export function successResponse<T>(
  data: T,
  status: number = HTTP.OK,
  meta?: Record<string, unknown>,
  headers?: HeadersInit,
): NextResponse<APISuccessResponse<T>> {
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
