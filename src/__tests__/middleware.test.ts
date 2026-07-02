/** @jest-environment node */
/**
 * Tests for src/middleware.ts — the Next.js Edge middleware that handles
 * CORS, request-ID propagation, and origin-based access control for /api
 * routes.
 */

import { NextRequest } from 'next/server';
import { middleware } from '@/middleware';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(
  pathname: string,
  method = 'GET',
  headers: Record<string, string> = {},
): NextRequest {
  const url = `http://localhost:3000${pathname}`;
  return new NextRequest(url, { method, headers });
}

// One of the origins that is allowed by default in serverEnv.
const ALLOWED_ORIGIN = 'http://localhost:3000';
// An origin that is NOT in the allow-list.
const DISALLOWED_ORIGIN = 'https://evil.example.com';

// ---------------------------------------------------------------------------
// Non-API routes — should pass through unchanged
// ---------------------------------------------------------------------------

describe('middleware — non-API routes', () => {
  it('calls NextResponse.next() for page routes without modification', () => {
    const req = makeRequest('/dashboard', 'GET');
    const res = middleware(req);
    // next() response has status 200 and does not set x-request-id on its own
    expect(res.status).toBe(200);
  });

  it('does not add Cache-Control for non-API routes', () => {
    const req = makeRequest('/', 'GET');
    const res = middleware(req);
    expect(res.headers.get('Cache-Control')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// OPTIONS preflight — allowed origin
// ---------------------------------------------------------------------------

describe('middleware — OPTIONS preflight', () => {
  it('returns 204 with CORS headers for allowed origin', () => {
    const req = makeRequest('/api/health', 'OPTIONS', { origin: ALLOWED_ORIGIN });
    const res = middleware(req);
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(ALLOWED_ORIGIN);
  });

  it('returns 403 with ORIGIN_NOT_ALLOWED for disallowed origin', async () => {
    const req = makeRequest('/api/health', 'OPTIONS', { origin: DISALLOWED_ORIGIN });
    const res = middleware(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error?.code).toBe('ORIGIN_NOT_ALLOWED');
  });
});

// ---------------------------------------------------------------------------
// Mutating methods (POST/PUT/PATCH/DELETE) — origin check
// ---------------------------------------------------------------------------

describe('middleware — mutating methods with disallowed origin', () => {
  const mutatingMethods = ['POST', 'PUT', 'PATCH', 'DELETE'] as const;

  mutatingMethods.forEach((method) => {
    it(`blocks ${method} from disallowed origin with 403`, async () => {
      const req = makeRequest('/api/records', method, { origin: DISALLOWED_ORIGIN });
      const res = middleware(req);
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error?.code).toBe('ORIGIN_NOT_ALLOWED');
    });

    it(`allows ${method} from allowed origin`, () => {
      const req = makeRequest('/api/records', method, { origin: ALLOWED_ORIGIN });
      const res = middleware(req);
      // createApiResponse returns a NextResponse.next() — status 200
      expect(res.status).toBe(200);
    });
  });
});

// ---------------------------------------------------------------------------
// GET to /api — createApiResponse path
// ---------------------------------------------------------------------------

describe('middleware — GET /api route (createApiResponse)', () => {
  it('sets Cache-Control: no-store', () => {
    const req = makeRequest('/api/health', 'GET', { origin: ALLOWED_ORIGIN });
    const res = middleware(req);
    expect(res.headers.get('Cache-Control')).toBe('no-store, max-age=0');
  });

  it('sets Cross-Origin-Resource-Policy', () => {
    const req = makeRequest('/api/health', 'GET', { origin: ALLOWED_ORIGIN });
    const res = middleware(req);
    expect(res.headers.get('Cross-Origin-Resource-Policy')).toBe('same-site');
  });

  it('sets Cross-Origin-Opener-Policy', () => {
    const req = makeRequest('/api/health', 'GET', { origin: ALLOWED_ORIGIN });
    const res = middleware(req);
    expect(res.headers.get('Cross-Origin-Opener-Policy')).toBe('same-origin');
  });

  it('echoes the x-request-id header when provided', () => {
    const req = makeRequest('/api/health', 'GET', {
      origin: ALLOWED_ORIGIN,
      'x-request-id': 'test-id-42',
    });
    const res = middleware(req);
    expect(res.headers.get('x-request-id')).toBe('test-id-42');
  });

  it('stamps X-Shiora-Maturity from the route registry', () => {
    const prod = middleware(makeRequest('/api/records', 'GET', { origin: ALLOWED_ORIGIN }));
    expect(prod.headers.get('X-Shiora-Maturity')).toBe('production');

    const sim = middleware(makeRequest('/api/genomics', 'GET', { origin: ALLOWED_ORIGIN }));
    expect(sim.headers.get('X-Shiora-Maturity')).toBe('simulated');

    const pilot = middleware(makeRequest('/api/sana/messages', 'GET', { origin: ALLOWED_ORIGIN }));
    expect(pilot.headers.get('X-Shiora-Maturity')).toBe('pilot');
  });

  it('generates a x-request-id when none is provided', () => {
    const req = makeRequest('/api/health', 'GET', { origin: ALLOWED_ORIGIN });
    const res = middleware(req);
    expect(res.headers.get('x-request-id')).toBeTruthy();
  });

  it('sets CORS headers for allowed origin on GET', () => {
    const req = makeRequest('/api/health', 'GET', { origin: ALLOWED_ORIGIN });
    const res = middleware(req);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(ALLOWED_ORIGIN);
    expect(res.headers.get('Access-Control-Allow-Credentials')).toBe('true');
  });

  it('does not set Access-Control-Allow-Origin for disallowed origin on GET', () => {
    const req = makeRequest('/api/health', 'GET', { origin: DISALLOWED_ORIGIN });
    const res = middleware(req);
    // Disallowed origins get only `Vary: Origin`
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('sets Pragma: no-cache', () => {
    const req = makeRequest('/api/health', 'GET', { origin: ALLOWED_ORIGIN });
    const res = middleware(req);
    expect(res.headers.get('Pragma')).toBe('no-cache');
  });
});

// ---------------------------------------------------------------------------
// matcher config export
// ---------------------------------------------------------------------------

describe('middleware config', () => {
  it('exports a matcher covering pages and APIs while skipping static assets', async () => {
    const mod = await import('@/middleware');
    expect(mod.config.matcher).toHaveLength(1);
    const pattern = mod.config.matcher[0];
    // Build assets and images are excluded — they cannot carry a per-request
    // nonce and CSP only matters on documents.
    expect(pattern).toContain('_next/static');
    expect(pattern).toContain('_next/image');
    expect(pattern).toContain('favicon');
  });
});

// ---------------------------------------------------------------------------
// Content-Security-Policy with per-request script nonce (audit M-01)
// ---------------------------------------------------------------------------

describe('middleware — page CSP nonce (audit M-01)', () => {
  it('sets a nonce-based CSP on page responses with no unsafe-inline scripts', () => {
    const res = middleware(makeRequest('/vault'));
    const csp = res.headers.get('Content-Security-Policy');
    expect(csp).toBeTruthy();

    const scriptSrc = csp!.split('; ').find((d) => d.startsWith('script-src '))!;
    expect(scriptSrc).toMatch(/'nonce-[A-Za-z0-9+/=]+'/);
    expect(scriptSrc).toContain("'strict-dynamic'");
    expect(scriptSrc).not.toContain("'unsafe-inline'");

    // Non-script hardening directives stay intact.
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("form-action 'self'");
  });

  it('forwards the nonce and CSP to the renderer via request headers', () => {
    const res = middleware(makeRequest('/'));
    const responseCsp = res.headers.get('Content-Security-Policy')!;

    // NextResponse.next({ request }) records overridden request headers here.
    const forwarded = res.headers.get('x-middleware-request-x-nonce');
    expect(forwarded).toBeTruthy();
    expect(responseCsp).toContain(`'nonce-${forwarded}'`);
    expect(res.headers.get('x-middleware-request-content-security-policy')).toBe(responseCsp);
  });

  it('wires violation reporting into the page CSP (GAP-10)', () => {
    const res = middleware(makeRequest('/vault'));
    const csp = res.headers.get('Content-Security-Policy')!;
    expect(csp).toContain('report-uri /api/security/csp-report');
    expect(csp).toContain('report-to csp-endpoint');
    expect(res.headers.get('Reporting-Endpoints')).toBe('csp-endpoint="/api/security/csp-report"');
  });

  it('generates a fresh nonce per request', () => {
    const first = middleware(makeRequest('/insights')).headers.get('Content-Security-Policy');
    const second = middleware(makeRequest('/insights')).headers.get('Content-Security-Policy');
    expect(first).not.toBe(second);
  });

  it("includes 'unsafe-eval' only in development (react-refresh)", () => {
    const prodCsp = middleware(makeRequest('/')).headers.get('Content-Security-Policy')!;
    expect(prodCsp).not.toContain("'unsafe-eval'");

    const replaced = jest.replaceProperty(process.env, 'NODE_ENV', 'development');
    try {
      const devCsp = middleware(makeRequest('/')).headers.get('Content-Security-Policy')!;
      expect(devCsp).toContain("'unsafe-eval'");
    } finally {
      replaced.restore();
    }
  });

  it('locks API responses down to a no-execution CSP', () => {
    const res = middleware(makeRequest('/api/health'));
    expect(res.headers.get('Content-Security-Policy')).toBe(
      "default-src 'none'; frame-ancestors 'none'",
    );
  });
});
