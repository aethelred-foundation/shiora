// ============================================================
// Shiora on Aethelred — API Middleware Helpers
// Rate limiting, logging, CORS, and auth extraction
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { errorResponse, HTTP } from './responses';
import { getCorsHeaders, hasDisallowedOrigin, isMutatingMethod } from './origin';
import { extractSessionToken, verifySessionToken } from './session';
import { isSessionRevoked } from './session-revocation';
import { createLogger } from '@/lib/observability/logger';
import { counter, normalizeRoute } from '@/lib/observability/metrics';
import { getRateLimiter } from './rate-limiter';
import { serverEnv } from './env';

// ────────────────────────────────────────────────────────────
// Rate Limiting
// ────────────────────────────────────────────────────────────

const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100;  // per window

// Stricter class for credential-bearing endpoints (challenge issuance and
// signature verification): brute-force surfaces get a fraction of the
// default budget (GAP-04).
export const AUTH_RATE_LIMIT = { maxRequests: 20, windowMs: RATE_LIMIT_WINDOW_MS };

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
    // Standard backoff headers (GAP-04): both fixed-window limiters reset at
    // the next window boundary, so the reset instant is derivable from the
    // clock without widening the RateLimiter port.
    const now = Date.now();
    const resetMs = (Math.floor(now / windowMs) + 1) * windowMs;
    const retryAfterSeconds = Math.max(1, Math.ceil((resetMs - now) / 1000));
    return errorResponse(
      'RATE_LIMITED',
      `Too many requests. Limit: ${maxRequests} per ${windowMs / 1000}s`,
      HTTP.TOO_MANY_REQUESTS,
      undefined,
      {
        'Retry-After': String(retryAfterSeconds),
        'X-RateLimit-Limit': String(maxRequests),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(Math.floor(resetMs / 1000)),
      },
    );
  }

  return null;
}

// ────────────────────────────────────────────────────────────
// Request Logging
// ────────────────────────────────────────────────────────────

/**
 * Resolve the client IP from X-Forwarded-For using the configured trusted-proxy
 * count. Only the last N entries of XFF are appended by our own infrastructure
 * and therefore trustworthy; the real client IP is the (N+1)-th from the right.
 * The leftmost entries are attacker-controllable and MUST NOT be used, or an
 * attacker could rotate them to mint a fresh rate-limit bucket per request
 * (audit H-01). With no trusted proxy (count 0) or a malformed/short header we
 * fail closed to `unknown` rather than trusting client-supplied values.
 */
export function getClientIp(request: NextRequest): string {
  const trustedProxies = serverEnv.trustedProxyCount;
  const forwardedFor = request.headers.get('x-forwarded-for');

  if (trustedProxies > 0 && forwardedFor) {
    const hops = forwardedFor.split(',').map((h) => h.trim()).filter(Boolean);
    const clientIndex = hops.length - trustedProxies;
    // filter(Boolean) guarantees a non-empty value at any in-range index.
    if (clientIndex >= 0) {
      return hops[clientIndex];
    }
  }

  // A trusted proxy sets X-Real-IP authoritatively (and strips any client copy);
  // fall back to it only when a proxy is configured. Never trust it otherwise.
  if (trustedProxies > 0) {
    return request.headers.get('x-real-ip')?.trim() || 'unknown';
  }

  return 'unknown';
}

/**
 * The rate-limit bucket key. Authenticated requests are keyed by the verified
 * wallet address — stable and non-spoofable — so a single account cannot evade
 * its limit by rotating network identifiers. Unauthenticated requests are keyed
 * by the trusted client IP + user agent.
 */
function getClientFingerprint(request: NextRequest): string {
  const auth = extractAuth(request);
  if (auth.isAuthenticated && auth.walletAddress) {
    return `acct:${auth.walletAddress}`;
  }
  const ip = getClientIp(request);
  const userAgent = request.headers.get('user-agent') ?? 'unknown';
  return `ip:${ip}:${userAgent.slice(0, 80)}`;
}

/**
 * Log incoming API request metadata.
 */
const apiLogger = createLogger({ subsystem: 'api' });

const requestsTotal = counter(
  'shiora_http_requests_total',
  'API requests entering the middleware, by method and normalized route',
);

const blockedTotal = counter(
  'shiora_http_blocked_total',
  'Requests rejected by the middleware perimeter, by reason',
);

export function logRequest(request: NextRequest): void {
  const method = request.method;
  const route = normalizeRoute(request.nextUrl.pathname);
  requestsTotal.inc({ method, route });

  if (serverEnv.isTest) {
    return;
  }

  apiLogger.info('request', {
    requestId: request.headers.get('x-request-id') ?? 'unknown',
    method,
    path: request.nextUrl.pathname,
    ip: getClientIp(request),
    userAgent: request.headers.get('user-agent')?.slice(0, 80) ?? 'unknown',
  });
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
    blockedTotal.inc({ reason: 'origin' });
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
  if (rateLimited) {
    blockedTotal.inc({ reason: 'rate_limit' });
    return rateLimited;
  }

  // Honor server-side revocation for any presented session, on every route —
  // a logged-out or "signed-out-everywhere" token must never be accepted
  // anywhere, even before its stateless expiry (audit M-03).
  const claims = verifySessionToken(extractSessionToken(request));
  if (claims && (await isSessionRevoked(claims))) {
    blockedTotal.inc({ reason: 'session_revoked' });
    return errorResponse(
      'SESSION_REVOKED',
      'This session has been revoked. Please sign in again.',
      HTTP.UNAUTHORIZED,
    );
  }

  if (options.requireAuth) {
    const auth = requireAuth(request);
    if (auth instanceof NextResponse) {
      blockedTotal.inc({ reason: 'auth' });
      return auth;
    }
  }

  return null;
}
