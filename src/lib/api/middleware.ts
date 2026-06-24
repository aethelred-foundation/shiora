// ============================================================
// Shiora on Aethelred — API Middleware Helpers
// Rate limiting, logging, CORS, and auth extraction
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { errorResponse, HTTP } from './responses';
import { getCorsHeaders, hasDisallowedOrigin, isMutatingMethod } from './origin';
import { extractSessionToken, verifySessionToken } from './session';
import { getRateLimiter } from './rate-limiter';
import { serverEnv } from './env';

// ────────────────────────────────────────────────────────────
// Rate Limiting
// ────────────────────────────────────────────────────────────

const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100;  // per window

/**
 * Fixed-window rate limit keyed by client fingerprint, enforced via the
 * configured {@link getRateLimiter} (in-memory by default; Postgres-backed and
 * cross-instance when DATABASE_URL is set). Returns null if the request is
 * allowed, or a 429 NextResponse if the limit is exceeded.
 */
export async function checkRateLimit(
  request: NextRequest,
  maxRequests: number = RATE_LIMIT_MAX_REQUESTS,
  windowMs: number = RATE_LIMIT_WINDOW_MS,
): Promise<NextResponse | null> {
  const decision = await getRateLimiter().consume(
    getClientFingerprint(request),
    maxRequests,
    windowMs,
  );

  if (!decision.allowed) {
    return errorResponse(
      'RATE_LIMITED',
      `Too many requests. Limit: ${maxRequests} per ${windowMs / 1000}s`,
      HTTP.TOO_MANY_REQUESTS,
    );
  }

  return null;
}

// ────────────────────────────────────────────────────────────
// Request Logging
// ────────────────────────────────────────────────────────────

function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0]?.trim() || 'unknown';
  }

  return request.headers.get('x-real-ip') ?? 'unknown';
}

function getClientFingerprint(request: NextRequest): string {
  const ip = getClientIp(request);
  const userAgent = request.headers.get('user-agent') ?? 'unknown';
  return `${ip}:${userAgent.slice(0, 80)}`;
}

/**
 * Log incoming API request metadata.
 */
export function logRequest(request: NextRequest): void {
  if (serverEnv.isTest) {
    return;
  }

  const method = request.method;
  const url = request.nextUrl.pathname;
  const ip = getClientIp(request);
  const requestId = request.headers.get('x-request-id') ?? 'unknown';
  const userAgent = request.headers.get('user-agent')?.slice(0, 80) ?? 'unknown';

  // eslint-disable-next-line no-console
  console.log(
    `[API] ${requestId} ${method} ${url} — IP: ${ip} — UA: ${userAgent}`,
  );
}

// ────────────────────────────────────────────────────────────
// CORS Headers
// ────────────────────────────────────────────────────────────

/**
 * Handle preflight OPTIONS request.
 */
export function handleOptions(request: NextRequest): NextResponse {
  if (hasDisallowedOrigin(request)) {
    return errorResponse(
      'ORIGIN_NOT_ALLOWED',
      'Origin is not allowed to access this API.',
      HTTP.FORBIDDEN,
      undefined,
      getCorsHeaders(request),
    );
  }

  return new NextResponse(null, {
    status: 204,
    headers: getCorsHeaders(request),
  });
}

// ────────────────────────────────────────────────────────────
// Auth Header Extraction
// ────────────────────────────────────────────────────────────

export interface AuthContext {
  walletAddress: string | null;
  sessionToken: string | null;
  authSource: 'session' | 'wallet-header' | null;
  isAuthenticated: boolean;
  invalidReason?: string;
}

/**
 * Extract authentication context from request headers.
 */
export function extractAuth(request: NextRequest): AuthContext {
  const sessionToken = extractSessionToken(request);
  const session = verifySessionToken(sessionToken);

  if (session) {
    return {
      walletAddress: session.sub,
      sessionToken,
      authSource: 'session',
      isAuthenticated: true,
    };
  }

  const walletAddressHeader = request.headers.get('x-wallet-address');
  if (walletAddressHeader && serverEnv.allowInsecureWalletHeader) {
    return {
      walletAddress: walletAddressHeader,
      sessionToken: null,
      authSource: 'wallet-header',
      isAuthenticated: true,
    };
  }

  return {
    walletAddress: null,
    sessionToken,
    authSource: null,
    isAuthenticated: false,
    ...(sessionToken ? { invalidReason: 'Session is missing, expired, or invalid.' } : {}),
  };
}

/**
 * Require authentication — returns error response if not authenticated.
 */
export function requireAuth(request: NextRequest): NextResponse | AuthContext {
  const auth = extractAuth(request);
  if (!auth.isAuthenticated) {
    return errorResponse(
      'UNAUTHORIZED',
      auth.invalidReason
        ?? 'Authentication required. Connect a wallet and present a valid signed session.',
      HTTP.UNAUTHORIZED,
    );
  }
  return auth;
}

interface MiddlewareOptions {
  maxRequests?: number;
  windowMs?: number;
  requireAuth?: boolean;
}

// ────────────────────────────────────────────────────────────
// Combined Middleware Runner
// ────────────────────────────────────────────────────────────

/**
 * Run standard middleware stack: logging, rate limiting.
 * Returns null if all passed, or an error NextResponse.
 */
export async function runMiddleware(
  request: NextRequest,
  options: MiddlewareOptions = {},
): Promise<NextResponse | null> {
  return runMiddlewareWithOptions(request, options);
}

export async function runMiddlewareWithOptions(
  request: NextRequest,
  options: MiddlewareOptions = {},
): Promise<NextResponse | null> {
  logRequest(request);

  if (isMutatingMethod(request.method) && hasDisallowedOrigin(request)) {
    return errorResponse(
      'ORIGIN_NOT_ALLOWED',
      'Cross-origin mutation requests are not allowed.',
      HTTP.FORBIDDEN,
      undefined,
      getCorsHeaders(request),
    );
  }

  const rateLimited = await checkRateLimit(
    request,
    options.maxRequests,
    options.windowMs,
  );
  if (rateLimited) return rateLimited;

  if (options.requireAuth) {
    const auth = requireAuth(request);
    if (auth instanceof NextResponse) {
      return auth;
    }
  }

  return null;
}
