import { NextRequest, NextResponse } from 'next/server';

import { getCorsHeaders, hasDisallowedOrigin, isMutatingMethod } from '@/lib/api/origin';
import { maturityForPath } from '@/lib/api/route-maturity';

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
    return NextResponse.next();
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
  matcher: ['/api/:path*'],
};
