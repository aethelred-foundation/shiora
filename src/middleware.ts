import { NextRequest, NextResponse } from 'next/server';

import { getCorsHeaders, hasDisallowedOrigin, isMutatingMethod } from '@/lib/api/origin';
import { maturityForPath } from '@/lib/api/route-maturity';

// ────────────────────────────────────────────────────────────
// Content-Security-Policy (audit M-01)
//
// Pages get a per-request nonce instead of script-src 'unsafe-inline': the
// nonce is placed on the request's CSP header, which Next.js reads to stamp
// its own inline bootstrap scripts, and mirrored on the response so the
// browser enforces it. 'strict-dynamic' lets those nonced scripts load the
// framework chunks. Requires per-request rendering (see root layout).
//
// style-src keeps 'unsafe-inline': components set style attributes (progress
// widths etc.), which nonces cannot authorize — and inline styles are not a
// script-execution vector.
// ────────────────────────────────────────────────────────────

function buildPageCsp(nonce: string): string {
  const isDev = process.env.NODE_ENV === 'development';
  return [
    `default-src 'self'`,
    `base-uri 'self'`,
    `frame-ancestors 'none'`,
    `object-src 'none'`,
    `worker-src 'self' blob:`,
    `img-src 'self' data: https:`,
    `font-src 'self' data: https:`,
    `style-src 'self' 'unsafe-inline'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
    `connect-src 'self' https: wss:`,
    `form-action 'self'`,
    // Violations are reported, not silently swallowed (GAP-10). report-uri is
    // the universally-supported legacy channel; report-to (wired via the
    // Reporting-Endpoints response header) is its successor.
    `report-uri /api/security/csp-report`,
    `report-to csp-endpoint`,
  ].join('; ');
}

// API responses are JSON documents that must never execute anything.
const API_CSP = `default-src 'none'; frame-ancestors 'none'`;

function createPageResponse(request: NextRequest): NextResponse {
  const nonce = btoa(crypto.randomUUID());
  const csp = buildPageCsp(nonce);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
  response.headers.set('Content-Security-Policy', csp);
  response.headers.set('Reporting-Endpoints', 'csp-endpoint="/api/security/csp-report"');
  return response;
}

function createApiResponse(request: NextRequest): NextResponse {
  const requestHeaders = new Headers(request.headers);
  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID();
  requestHeaders.set('x-request-id', requestId);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  response.headers.set('x-request-id', requestId);
  response.headers.set('Cache-Control', 'no-store, max-age=0');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Cross-Origin-Resource-Policy', 'same-site');
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  response.headers.set('Content-Security-Policy', API_CSP);
  // Machine-readable feature maturity on every API response (audit Finding F1),
  // so consumers see production vs pilot vs simulated without reading the registry.
  response.headers.set('X-Shiora-Maturity', maturityForPath(request.nextUrl.pathname));

  const corsHeaders = getCorsHeaders(request);
  Object.entries(corsHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  return response;
}

export function middleware(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith('/api')) {
    return createPageResponse(request);
  }

  if (request.method === 'OPTIONS') {
    if (hasDisallowedOrigin(request)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'ORIGIN_NOT_ALLOWED',
            message: 'Origin is not allowed to access this API.',
          },
        },
        {
          status: 403,
          headers: getCorsHeaders(request),
        },
      );
    }

    return new NextResponse(null, {
      status: 204,
      headers: getCorsHeaders(request),
    });
  }

  if (isMutatingMethod(request.method) && hasDisallowedOrigin(request)) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'ORIGIN_NOT_ALLOWED',
          message: 'Cross-origin mutation requests are not allowed.',
        },
      },
      {
        status: 403,
        headers: getCorsHeaders(request),
      },
    );
  }

  return createApiResponse(request);
}

export const config = {
  matcher: [
    // All pages and API routes; skip build assets, images, and metadata files
    // (CSP only matters on documents, and static assets cannot carry a
    // per-request nonce anyway).
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)',
  ],
};
