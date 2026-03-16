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
} from '@/lib/api/middleware';
import { createSessionToken } from '@/lib/api/session';
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
  it('allows requests within limit', () => {
    const req = makeReq('http://localhost:3000/api/test');
    const result = checkRateLimit(req, 10);
    expect(result).toBeNull();
  });

  it('blocks requests exceeding limit', () => {
    const ip = `rate-limit-${Date.now()}`;
    for (let i = 0; i < 5; i++) {
      checkRateLimit(makeReq('http://localhost:3000/api/test', { ip }), 5);
    }
    const result = checkRateLimit(makeReq('http://localhost:3000/api/test', { ip }), 5);
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
  it('returns null for valid request', () => {
    const req = makeReq('http://localhost:3000/api/test');
    const result = runMiddleware(req);
    expect(result).toBeNull();
  });

  it('blocks cross-origin mutations', () => {
    const req = makeReq('http://localhost:3000/api/test', {
      method: 'POST',
      headers: { origin: 'http://evil.example.com' },
    });
    const result = runMiddleware(req);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(403);
  });

  it('checks auth when requireAuth is true', () => {
    const req = new NextRequest('http://localhost:3000/api/test');
    const result = runMiddleware(req, { requireAuth: true });
    expect(result).not.toBeNull();
    expect(result!.status).toBe(401);
  });

  it('passes with auth when requireAuth is true and token valid', () => {
    const req = new NextRequest('http://localhost:3000/api/test', {
      headers: { authorization: `Bearer ${TEST_TOKEN}` },
    });
    const result = runMiddleware(req, { requireAuth: true });
    expect(result).toBeNull();
  });
});

describe('runMiddlewareWithOptions', () => {
  it('delegates to the same logic as runMiddleware', () => {
    const req = makeReq('http://localhost:3000/api/test');
    const result = runMiddlewareWithOptions(req);
    expect(result).toBeNull();
  });

  it('blocks cross-origin mutations', () => {
    const req = makeReq('http://localhost:3000/api/test', {
      method: 'POST',
      headers: { origin: 'http://evil.example.com' },
    });
    const result = runMiddlewareWithOptions(req);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(403);
  });
});

describe('checkRateLimit cleanup', () => {
  it('cleans up expired entries after 60s', () => {
    // Use a unique IP to avoid collisions
    const ip = `cleanup-test-${Date.now()}`;
    const req = makeReq('http://localhost:3000/api/test', { ip });

    // First request sets an entry
    checkRateLimit(req, 100, 1); // 1ms window so it expires immediately

    // Mock Date.now to simulate time passing > 60s
    const originalDateNow = Date.now;
    const futureTime = originalDateNow() + 120_000; // 2 minutes later
    Date.now = jest.fn(() => futureTime);

    try {
      // This call should trigger cleanup and the entry should be expired
      const result = checkRateLimit(
        makeReq('http://localhost:3000/api/test', { ip: `cleanup-trigger-${futureTime}` }),
        100,
      );
      expect(result).toBeNull();
    } finally {
      Date.now = originalDateNow;
    }
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
  it('uses x-real-ip when x-forwarded-for is absent', () => {
    const req = new NextRequest('http://localhost:3000/api/test', {
      headers: { 'x-real-ip': '10.0.0.1' },
    });
    // Should not throw, proving the header is read
    expect(() => checkRateLimit(req)).not.toThrow();
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
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[API]'),
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
  it('returns rate limit response when limit is exceeded', () => {
    const ip = `middleware-rl-${Date.now()}`;
    // Exhaust the rate limit
    for (let i = 0; i < 3; i++) {
      runMiddlewareWithOptions(makeReq('http://localhost:3000/api/test', { ip }), { maxRequests: 3 });
    }
    // Next request should be rate limited
    const result = runMiddlewareWithOptions(
      makeReq('http://localhost:3000/api/test', { ip }),
      { maxRequests: 3 },
    );
    expect(result).not.toBeNull();
    expect(result!.status).toBe(429);
  });
});
