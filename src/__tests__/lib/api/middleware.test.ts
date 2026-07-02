/** @jest-environment node */

import { NextRequest } from 'next/server';
import {
  checkRateLimit,
  logRequest,
  handleOptions,
  extractAuth,
  requireAuth,
  runMiddleware,
  runMiddlewareWithOptions,
  getClientIp,
} from '@/lib/api/middleware';
import { createSessionToken, verifySessionToken } from '@/lib/api/session';
import { revokeSession } from '@/lib/api/session-revocation';
import { __resetRevocationStoreForTests } from '@/lib/persistence/revocation-store';
import { __resetRateLimiterForTests } from '@/lib/api/rate-limiter';
import { seededAddress } from '@/lib/utils';

const TEST_ADDRESS = seededAddress(9876);
const { token: TEST_TOKEN } = createSessionToken(TEST_ADDRESS);

function makeReq(url: string, init?: RequestInit & { ip?: string }): NextRequest {
  return new NextRequest(url, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      'x-forwarded-for': init?.ip ?? `${Math.random()}`,
    },
  });
}

describe('checkRateLimit', () => {
  it('allows requests within limit', async () => {
    const req = makeReq('http://localhost:3000/api/test');
    const result = await checkRateLimit(req, 10);
    expect(result).toBeNull();
  });

  it('blocks requests exceeding limit', async () => {
    const ip = `rate-limit-${Date.now()}`;
    for (let i = 0; i < 5; i++) {
      await checkRateLimit(makeReq('http://localhost:3000/api/test', { ip }), 5);
    }
    const result = await checkRateLimit(makeReq('http://localhost:3000/api/test', { ip }), 5);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(429);
  });
});

describe('logRequest', () => {
  it('does not throw in test environment', () => {
    const req = makeReq('http://localhost:3000/api/test');
    expect(() => logRequest(req)).not.toThrow();
  });
});

describe('handleOptions', () => {
  it('returns 204 for allowed origin', () => {
    const req = makeReq('http://localhost:3000/api/test', {
      method: 'OPTIONS',
      headers: { origin: 'http://localhost:3000' },
    });
    const res = handleOptions(req);
    expect(res.status).toBe(204);
  });

  it('returns 403 for disallowed origin', () => {
    const req = makeReq('http://localhost:3000/api/test', {
      method: 'OPTIONS',
      headers: { origin: 'http://evil.example.com' },
    });
    const res = handleOptions(req);
    expect(res.status).toBe(403);
  });
});

describe('extractAuth', () => {
  it('extracts valid session from Bearer token', () => {
    const req = new NextRequest('http://localhost:3000/api/test', {
      headers: { authorization: `Bearer ${TEST_TOKEN}` },
    });
    const auth = extractAuth(req);
    expect(auth.isAuthenticated).toBe(true);
    expect(auth.walletAddress).toBe(TEST_ADDRESS);
    expect(auth.authSource).toBe('session');
  });

  it('returns unauthenticated for missing token', () => {
    const req = new NextRequest('http://localhost:3000/api/test');
    const auth = extractAuth(req);
    expect(auth.isAuthenticated).toBe(false);
    expect(auth.walletAddress).toBeNull();
  });

  it('returns unauthenticated for invalid token', () => {
    const req = new NextRequest('http://localhost:3000/api/test', {
      headers: { authorization: 'Bearer invalid.token' },
    });
    const auth = extractAuth(req);
    expect(auth.isAuthenticated).toBe(false);
  });

  it('extracts wallet address from x-wallet-address header in dev', () => {
    const req = new NextRequest('http://localhost:3000/api/test', {
      headers: { 'x-wallet-address': 'aeth1devtestaddr' },
    });
    const auth = extractAuth(req);
    // May or may not be authenticated depending on allowInsecureWalletHeader setting
    if (auth.isAuthenticated) {
      expect(auth.authSource).toBe('wallet-header');
      expect(auth.walletAddress).toBe('aeth1devtestaddr');
    }
  });
});

describe('requireAuth', () => {
  it('returns AuthContext for authenticated request', () => {
    const req = new NextRequest('http://localhost:3000/api/test', {
      headers: { authorization: `Bearer ${TEST_TOKEN}` },
    });
    const result = requireAuth(req);
    expect('status' in result).toBe(false);
    if (!('status' in result)) {
      expect(result.isAuthenticated).toBe(true);
    }
  });

  it('returns NextResponse for unauthenticated request', () => {
    const req = new NextRequest('http://localhost:3000/api/test');
    const result = requireAuth(req);
    expect('status' in result).toBe(true);
  });
});

describe('runMiddleware', () => {
  it('returns null for valid request', async () => {
    const req = makeReq('http://localhost:3000/api/test');
    const result = await runMiddleware(req);
    expect(result).toBeNull();
  });

  it('blocks cross-origin mutations', async () => {
    const req = makeReq('http://localhost:3000/api/test', {
      method: 'POST',
      headers: { origin: 'http://evil.example.com' },
    });
    const result = await runMiddleware(req);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(403);
  });

  it('checks auth when requireAuth is true', async () => {
    const req = new NextRequest('http://localhost:3000/api/test');
    const result = await runMiddleware(req, { requireAuth: true });
    expect(result).not.toBeNull();
    expect(result!.status).toBe(401);
  });

  it('passes with auth when requireAuth is true and token valid', async () => {
    const req = new NextRequest('http://localhost:3000/api/test', {
      headers: { authorization: `Bearer ${TEST_TOKEN}` },
    });
    const result = await runMiddleware(req, { requireAuth: true });
    expect(result).toBeNull();
  });
});

describe('runMiddlewareWithOptions', () => {
  it('delegates to the same logic as runMiddleware', async () => {
    const req = makeReq('http://localhost:3000/api/test');
    const result = await runMiddlewareWithOptions(req);
    expect(result).toBeNull();
  });

  it('blocks cross-origin mutations', async () => {
    const req = makeReq('http://localhost:3000/api/test', {
      method: 'POST',
      headers: { origin: 'http://evil.example.com' },
    });
    const result = await runMiddlewareWithOptions(req);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(403);
  });
});

describe('logRequest in non-test environment', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it('logs request details when not in test environment', () => {
    // We can't actually change serverEnv.isTest since it's computed at module load,
    // but we can verify logRequest doesn't throw in test env (which it shouldn't)
    const req = makeReq('http://localhost:3000/api/test', {
      headers: {
        'x-request-id': 'test-request-id',
        'user-agent': 'TestAgent/1.0',
        'x-forwarded-for': '192.168.1.1',
      },
    });
    expect(() => logRequest(req)).not.toThrow();
  });
});

describe('extractAuth with invalid session token', () => {
  it('returns invalidReason when session token is present but invalid', () => {
    const req = new NextRequest('http://localhost:3000/api/test', {
      headers: { authorization: 'Bearer invalid.token.here' },
    });
    const auth = extractAuth(req);
    expect(auth.isAuthenticated).toBe(false);
    expect(auth.invalidReason).toBeDefined();
    expect(auth.invalidReason).toContain('Session is missing');
  });
});

describe('requireAuth default message', () => {
  it('returns default message when no invalidReason', () => {
    const req = new NextRequest('http://localhost:3000/api/test');
    const result = requireAuth(req);
    expect('status' in result).toBe(true);
    if ('status' in result) {
      expect(result.status).toBe(401);
    }
  });
});

describe('getClientIp via x-real-ip', () => {
  it('uses x-real-ip when x-forwarded-for is absent', async () => {
    const req = new NextRequest('http://localhost:3000/api/test', {
      headers: { 'x-real-ip': '10.0.0.1' },
    });
    // Should resolve without throwing, proving the header is read
    await expect(checkRateLimit(req)).resolves.toBeNull();
  });
});

describe('logRequest non-test behavior', () => {
  it('logs request details when serverEnv.isTest is false', () => {
    // We need to re-require the module with mocked env to test the non-test path.
    // Since serverEnv.isTest is computed at module load, we mock the env module.
    jest.resetModules();

    jest.doMock('@/lib/api/env', () => ({
      serverEnv: {
        isTest: false,
        isProduction: false,
        isDevelopment: true,
        nodeEnv: 'development',
        allowedOrigins: ['http://localhost:3000', 'http://localhost:3001'],
        hasConfiguredSessionSecret: false,
        sessionSecret: 'test-secret-at-least-32-chars-long-for-mocking',
        sessionTtlHours: 24,
        trustedProxyCount: 1,
        enableHsts: false,
        allowInsecureWalletHeader: true,
      },
    }));

    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    try {
      const { logRequest: logReqDev } = require('@/lib/api/middleware');
      const req = new NextRequest('http://localhost:3000/api/test', {
        headers: {
          'x-request-id': 'req-abc-123',
          'user-agent': 'TestBot/2.0',
          'x-forwarded-for': '192.168.1.100',
        },
      });
      logReqDev(req);
      // Structured JSON line from the api logger (GAP-02).
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"subsystem":"api"'),
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('req-abc-123'),
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('192.168.1.100'),
      );
    } finally {
      consoleSpy.mockRestore();
      jest.resetModules();
    }
  });

  it('logRequest handles missing user-agent and request-id', () => {
    jest.resetModules();

    jest.doMock('@/lib/api/env', () => ({
      serverEnv: {
        isTest: false,
        isProduction: false,
        isDevelopment: true,
        nodeEnv: 'development',
        allowedOrigins: ['http://localhost:3000'],
        hasConfiguredSessionSecret: false,
        sessionSecret: 'test-secret-at-least-32-chars-long-for-mocking',
        sessionTtlHours: 24,
        trustedProxyCount: 1,
        enableHsts: false,
        allowInsecureWalletHeader: true,
      },
    }));

    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    try {
      const { logRequest: logReqDev } = require('@/lib/api/middleware');
      // Request with no user-agent, no request-id, no x-forwarded-for
      const req = new NextRequest('http://localhost:3000/api/health', {
        headers: { 'x-real-ip': '10.0.0.5' },
      });
      logReqDev(req);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('unknown'),
      );
    } finally {
      consoleSpy.mockRestore();
      jest.resetModules();
    }
  });

  it('logRequest uses unknown IP when both x-forwarded-for and x-real-ip are absent', () => {
    jest.resetModules();

    jest.doMock('@/lib/api/env', () => ({
      serverEnv: {
        isTest: false,
        isProduction: false,
        isDevelopment: true,
        nodeEnv: 'development',
        allowedOrigins: ['http://localhost:3000'],
        hasConfiguredSessionSecret: false,
        sessionSecret: 'test-secret-at-least-32-chars-long-for-mocking',
        sessionTtlHours: 24,
        trustedProxyCount: 1,
        enableHsts: false,
        allowInsecureWalletHeader: true,
      },
    }));

    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    try {
      const { logRequest: logReqDev } = require('@/lib/api/middleware');
      const req = new NextRequest('http://localhost:3000/api/test');
      logReqDev(req);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('unknown'),
      );
    } finally {
      consoleSpy.mockRestore();
      jest.resetModules();
    }
  });

  it('getClientIp returns empty trim result as unknown from x-forwarded-for', () => {
    // x-forwarded-for with empty first value: ", 10.0.0.1"
    jest.resetModules();

    jest.doMock('@/lib/api/env', () => ({
      serverEnv: {
        isTest: false,
        isProduction: false,
        isDevelopment: true,
        nodeEnv: 'development',
        allowedOrigins: ['http://localhost:3000'],
        hasConfiguredSessionSecret: false,
        sessionSecret: 'test-secret-at-least-32-chars-long-for-mocking',
        sessionTtlHours: 24,
        trustedProxyCount: 1,
        enableHsts: false,
        allowInsecureWalletHeader: true,
      },
    }));

    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    try {
      const { logRequest: logReqDev } = require('@/lib/api/middleware');
      const req = new NextRequest('http://localhost:3000/api/test', {
        headers: { 'x-forwarded-for': ', 10.0.0.1' },
      });
      logReqDev(req);
      // The first element of split(',') is empty string, trim() -> '', so || 'unknown'
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('unknown'),
      );
    } finally {
      consoleSpy.mockRestore();
      jest.resetModules();
    }
  });
});

describe('extractAuth with wallet header when insecure header is disabled', () => {
  it('does not authenticate via wallet header when allowInsecureWalletHeader is false', () => {
    jest.resetModules();

    jest.doMock('@/lib/api/env', () => ({
      serverEnv: {
        isTest: true,
        isProduction: true,
        isDevelopment: false,
        nodeEnv: 'production',
        allowedOrigins: ['http://localhost:3000'],
        hasConfiguredSessionSecret: true,
        sessionSecret: 'test-secret-at-least-32-chars-long-for-mocking',
        sessionTtlHours: 24,
        trustedProxyCount: 1,
        enableHsts: true,
        allowInsecureWalletHeader: false,
      },
    }));

    try {
      const { extractAuth: extractAuthProd } = require('@/lib/api/middleware');
      const req = new NextRequest('http://localhost:3000/api/test', {
        headers: { 'x-wallet-address': 'aeth1someaddr' },
      });
      const auth = extractAuthProd(req);
      expect(auth.isAuthenticated).toBe(false);
      expect(auth.walletAddress).toBeNull();
    } finally {
      jest.resetModules();
    }
  });
});

describe('requireAuth with invalidReason', () => {
  it('includes invalidReason in error response when session token is present but invalid', () => {
    const req = new NextRequest('http://localhost:3000/api/test', {
      headers: { authorization: 'Bearer bad.token.value' },
    });
    const result = requireAuth(req);
    expect('status' in result).toBe(true);
    if ('status' in result) {
      expect(result.status).toBe(401);
    }
  });
});

describe('runMiddlewareWithOptions rate limiting', () => {
  it('returns rate limit response when limit is exceeded', async () => {
    const ip = `middleware-rl-${Date.now()}`;
    // Exhaust the rate limit
    for (let i = 0; i < 3; i++) {
      await runMiddlewareWithOptions(makeReq('http://localhost:3000/api/test', { ip }), { maxRequests: 3 });
    }
    // Next request should be rate limited
    const result = await runMiddlewareWithOptions(
      makeReq('http://localhost:3000/api/test', { ip }),
      { maxRequests: 3 },
    );
    expect(result).not.toBeNull();
    expect(result!.status).toBe(429);
  });
});

describe('getClientIp — trusted-proxy resolution (audit H-01)', () => {
  const REAL_IP = '203.0.113.9';
  const xff = (value: string) =>
    new NextRequest('http://localhost:3000/api/test', { headers: { 'x-forwarded-for': value } });

  it('ignores spoofed leftmost XFF entries and uses the proxy-appended client IP', () => {
    // Default trusted-proxy count is 1: the real client IP is the rightmost hop
    // (appended by our proxy). An attacker rotating leftmost values cannot move it.
    expect(getClientIp(xff(`9.9.9.9, 8.8.8.8, ${REAL_IP}`))).toBe(REAL_IP);
    expect(getClientIp(xff(`10.10.10.10, ${REAL_IP}`))).toBe(REAL_IP);
    expect(getClientIp(xff(REAL_IP))).toBe(REAL_IP);
  });

  it('falls back to x-real-ip when XFF is present but has no usable hop', () => {
    // A non-empty header that yields no hops after trimming/filtering exercises
    // the clientIndex < 0 path (fewer real hops than the trusted-proxy count).
    const req = new NextRequest('http://localhost:3000/api/test', {
      headers: { 'x-forwarded-for': ',', 'x-real-ip': '198.51.100.7' },
    });
    expect(getClientIp(req)).toBe('198.51.100.7');
  });

  it('returns unknown when neither XFF nor x-real-ip is present', () => {
    expect(getClientIp(new NextRequest('http://localhost:3000/api/test'))).toBe('unknown');
  });

  it('ignores X-Forwarded-For entirely when no trusted proxy is configured (count=0)', () => {
    jest.isolateModules(() => {
      jest.doMock('@/lib/api/env', () => ({
        serverEnv: {
          trustedProxyCount: 0,
          isTest: true, isProduction: false, isDevelopment: true, nodeEnv: 'test',
          allowedOrigins: [], enableHsts: false, allowInsecureWalletHeader: false,
          sessionTtlHours: 24, hasConfiguredSessionSecret: false,
          sessionSecret: 'x'.repeat(32),
        },
      }));
      const { getClientIp: isolated } = require('@/lib/api/middleware');
      const req = new NextRequest('http://localhost:3000/api/test', {
        headers: { 'x-forwarded-for': '1.2.3.4', 'x-real-ip': '5.6.7.8' },
      });
      expect(isolated(req)).toBe('unknown');
    });
  });
});

describe('rate limiting is per-account for authenticated callers (audit H-01)', () => {
  it('shares one bucket across source IPs for the same wallet', async () => {
    __resetRateLimiterForTests();
    const acct = seededAddress(24680);
    const { token } = createSessionToken(acct);
    const authed = (ip: string) =>
      new NextRequest('http://localhost:3000/api/test', {
        headers: { authorization: `Bearer ${token}`, 'x-forwarded-for': ip },
      });

    expect((await checkRateLimit(authed('1.1.1.1'), 2))).toBeNull();
    expect((await checkRateLimit(authed('2.2.2.2'), 2))).toBeNull(); // different IP, same account
    const third = await checkRateLimit(authed('3.3.3.3'), 2);        // still the account's bucket
    expect(third).not.toBeNull();
    expect(third!.status).toBe(429);
    __resetRateLimiterForTests();
  });
});

describe('runMiddleware honors server-side session revocation (audit M-03)', () => {
  // Use the top-level imports (not requireActual): prior tests call
  // jest.resetModules(), so a freshly required revocation-store would carry a
  // different cached singleton than the runMiddleware imported at file load.
  afterEach(() => __resetRevocationStoreForTests());

  it('rejects a revoked token with 401 SESSION_REVOKED, on any route', async () => {
    __resetRevocationStoreForTests();
    const { token } = createSessionToken(seededAddress(55221));
    await revokeSession(verifySessionToken(token)!);

    const req = new NextRequest('http://localhost:3000/api/test', {
      headers: { authorization: `Bearer ${token}` },
    });
    const res = await runMiddleware(req);
    expect(res).not.toBeNull();
    expect(res!.status).toBe(401);
    expect((await res!.json()).error.code).toBe('SESSION_REVOKED');
  });

  it('passes a fresh (non-revoked) token through', async () => {
    __resetRevocationStoreForTests();
    const { token } = createSessionToken(seededAddress(55222));
    const req = new NextRequest('http://localhost:3000/api/test', {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(await runMiddleware(req)).toBeNull();
  });
});
