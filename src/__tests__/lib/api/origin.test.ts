/** @jest-environment node */

import { NextRequest } from 'next/server';
import {
  getAllowedOrigins,
  isAllowedOrigin,
  getCorsHeaders,
  isMutatingMethod,
  hasDisallowedOrigin,
} from '@/lib/api/origin';

describe('getAllowedOrigins', () => {
  it('returns an array of allowed origins', () => {
    const origins = getAllowedOrigins();
    expect(Array.isArray(origins)).toBe(true);
    expect(origins.length).toBeGreaterThan(0);
    expect(origins).toContain('http://localhost:3000');
  });
});

describe('isAllowedOrigin', () => {
  it('returns true for allowed origin', () => {
    expect(isAllowedOrigin('http://localhost:3000')).toBe(true);
  });

  it('returns false for disallowed origin', () => {
    expect(isAllowedOrigin('http://evil.example.com')).toBe(false);
  });

  it('returns false for null origin', () => {
    expect(isAllowedOrigin(null)).toBe(false);
  });

  it('returns false for undefined origin', () => {
    expect(isAllowedOrigin(undefined)).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isAllowedOrigin('')).toBe(false);
  });

  it('returns false for invalid URL that triggers URL parse error', () => {
    // This will cause `new URL()` to throw in the comparison loop
    expect(isAllowedOrigin('not-a-valid-url')).toBe(false);
  });
});

describe('isAllowedOrigin with wildcard subdomain matching', () => {
  it('matches subdomain origins when allowed origin starts with dot', () => {
    jest.resetModules();

    const originalEnv = { ...process.env };
    process.env.SHIORA_ALLOWED_ORIGINS = 'https://.shiora.health';

    try {
      const { isAllowedOrigin: isAllowed } = require('@/lib/api/origin');

      // Subdomain should match
      expect(isAllowed('https://app.shiora.health')).toBe(true);
      expect(isAllowed('https://api.shiora.health')).toBe(true);

      // Different protocol should not match
      expect(isAllowed('http://app.shiora.health')).toBe(false);

      // Different base domain should not match
      expect(isAllowed('https://evil.example.com')).toBe(false);

      // Root domain without subdomain should not match (doesn't end with .shiora.health)
      expect(isAllowed('https://shiora.health')).toBe(false);
    } finally {
      process.env = originalEnv;
      jest.resetModules();
    }
  });
});

describe('getCorsHeaders', () => {
  it('returns full CORS headers for allowed origin', () => {
    const req = new NextRequest('http://localhost:3000/api/test', {
      headers: { origin: 'http://localhost:3000' },
    });
    const headers = getCorsHeaders(req);
    expect(headers['Access-Control-Allow-Origin']).toBe('http://localhost:3000');
    expect(headers['Access-Control-Allow-Credentials']).toBe('true');
    expect(headers['Access-Control-Allow-Methods']).toContain('GET');
    expect(headers.Vary).toBe('Origin');
  });

  it('returns only Vary for disallowed origin', () => {
    const req = new NextRequest('http://localhost:3000/api/test', {
      headers: { origin: 'http://evil.example.com' },
    });
    const headers = getCorsHeaders(req);
    expect(headers.Vary).toBe('Origin');
    expect(headers['Access-Control-Allow-Origin']).toBeUndefined();
  });
});

describe('isMutatingMethod', () => {
  it('returns true for POST, PUT, PATCH, DELETE', () => {
    expect(isMutatingMethod('POST')).toBe(true);
    expect(isMutatingMethod('PUT')).toBe(true);
    expect(isMutatingMethod('PATCH')).toBe(true);
    expect(isMutatingMethod('DELETE')).toBe(true);
  });

  it('returns false for GET, OPTIONS, HEAD', () => {
    expect(isMutatingMethod('GET')).toBe(false);
    expect(isMutatingMethod('OPTIONS')).toBe(false);
    expect(isMutatingMethod('HEAD')).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(isMutatingMethod('post')).toBe(true);
    expect(isMutatingMethod('get')).toBe(false);
  });
});

describe('hasDisallowedOrigin', () => {
  it('returns true for disallowed origin', () => {
    const req = new NextRequest('http://localhost:3000/api/test', {
      headers: { origin: 'http://evil.example.com' },
    });
    expect(hasDisallowedOrigin(req)).toBe(true);
  });

  it('returns false for allowed origin', () => {
    const req = new NextRequest('http://localhost:3000/api/test', {
      headers: { origin: 'http://localhost:3000' },
    });
    expect(hasDisallowedOrigin(req)).toBe(false);
  });

  it('returns false when no origin header', () => {
    const req = new NextRequest('http://localhost:3000/api/test');
    expect(hasDisallowedOrigin(req)).toBe(false);
  });
});
