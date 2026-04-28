/** @jest-environment node */

jest.mock('@/lib/api/middleware', () => {
  const actual = jest.requireActual('@/lib/api/middleware');
  return {
    ...actual,
    runMiddleware: jest.fn((...args: unknown[]) => actual.runMiddleware(...args)),
  };
});

import { NextRequest, NextResponse } from 'next/server';
import { runMiddleware } from '@/lib/api/middleware';
import { GET } from '@/app/api/health/route';

const mockedRunMiddleware = runMiddleware as jest.MockedFunction<typeof runMiddleware>;

afterEach(() => {
  mockedRunMiddleware.mockImplementation((...args: unknown[]) => {
    const actual = jest.requireActual('@/lib/api/middleware');
    return actual.runMiddleware(...args);
  });
});

describe('/api/health', () => {
  it('returns middleware error when blocked', async () => {
    mockedRunMiddleware.mockReturnValueOnce(
      NextResponse.json({ error: 'blocked' }, { status: 403 }),
    );
    const req = new NextRequest('http://localhost:3000/api/health', { method: 'GET' });
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  it('returns 200 with health status', async () => {
    const req = new NextRequest('http://localhost:3000/api/health', { method: 'GET' });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('healthy');
    expect(body.data.version).toBe('1.0.0');
    expect(body.data.service).toBe('Shiora on Aethelred API');
    expect(body.data.chain).toBe('Aethelred');
  });

  it('includes features object', async () => {
    const req = new NextRequest('http://localhost:3000/api/health', { method: 'GET' });
    const res = await GET(req);
    const body = await res.json();
    expect(body.data.features).toEqual({
      teeVerification: true,
      ipfsStorage: true,
      e2eEncryption: true,
      blockchainAudit: true,
    });
  });

  it('includes uptime info', async () => {
    const req = new NextRequest('http://localhost:3000/api/health', { method: 'GET' });
    const res = await GET(req);
    const body = await res.json();
    expect(body.data.uptime).toBeDefined();
    expect(typeof body.data.uptime.seconds).toBe('number');
    expect(typeof body.data.uptime.human).toBe('string');
  });

  it('includes timestamp and environment', async () => {
    const req = new NextRequest('http://localhost:3000/api/health', { method: 'GET' });
    const res = await GET(req);
    const body = await res.json();
    expect(body.data.timestamp).toBeDefined();
    expect(body.data.environment).toBe('test');
  });

  it('includes non-production readiness details', async () => {
    const req = new NextRequest('http://localhost:3000/api/health', { method: 'GET' });
    const res = await GET(req);
    const body = await res.json();
    expect(body.data.readiness.status).toBe('not_applicable');
    expect(Array.isArray(body.data.readiness.failures)).toBe(true);
  });

  it('returns uptime with formatted human-readable string', async () => {
    const req = new NextRequest('http://localhost:3000/api/health', { method: 'GET' });
    const res = await GET(req);
    const body = await res.json();
    const human = body.data.uptime.human;
    // The human-readable string should contain at least seconds
    expect(human).toMatch(/\d+s/);
  });

  it('returns correct apiVersion', async () => {
    const req = new NextRequest('http://localhost:3000/api/health', { method: 'GET' });
    const res = await GET(req);
    const body = await res.json();
    expect(body.data.apiVersion).toBe('v1');
  });

  it('falls back to development when NODE_ENV is undefined', async () => {
    const original = process.env.NODE_ENV;
    delete process.env.NODE_ENV;
    try {
      const req = new NextRequest('http://localhost:3000/api/health', { method: 'GET' });
      const res = await GET(req);
      const body = await res.json();
      expect(body.data.environment).toBe('development');
    } finally {
      process.env.NODE_ENV = original;
    }
  });

  it('uptime seconds is non-negative', async () => {
    const req = new NextRequest('http://localhost:3000/api/health', { method: 'GET' });
    const res = await GET(req);
    const body = await res.json();
    expect(body.data.uptime.seconds).toBeGreaterThanOrEqual(0);
  });

  it('formatUptime includes days, hours, and minutes for large uptimes', async () => {
    // Mock Date.now to return a time 2 days, 3 hours, 15 minutes, and 42 seconds after start
    const realDateNow = Date.now;
    const fakeNow = realDateNow() + (2 * 86400 + 3 * 3600 + 15 * 60 + 42) * 1000;
    jest.spyOn(Date, 'now').mockReturnValue(fakeNow);
    try {
      const req = new NextRequest('http://localhost:3000/api/health', { method: 'GET' });
      const res = await GET(req);
      const body = await res.json();
      expect(body.data.uptime.human).toMatch(/\d+d/);
      expect(body.data.uptime.human).toMatch(/\d+h/);
      expect(body.data.uptime.human).toMatch(/\d+m/);
      expect(body.data.uptime.human).toMatch(/\d+s/);
    } finally {
      jest.restoreAllMocks();
    }
  });

  it('formatUptime shows only hours and seconds (no days, no minutes)', async () => {
    const realDateNow = Date.now;
    // 1 hour and 5 seconds = 3605 seconds (d=0, h=1, m=0, s=5)
    const fakeNow = realDateNow() + 3605 * 1000;
    jest.spyOn(Date, 'now').mockReturnValue(fakeNow);
    try {
      const req = new NextRequest('http://localhost:3000/api/health', { method: 'GET' });
      const res = await GET(req);
      const body = await res.json();
      expect(body.data.uptime.human).toMatch(/\d+h/);
      expect(body.data.uptime.human).not.toMatch(/\d+d/);
      expect(body.data.uptime.human).toMatch(/\d+s/);
    } finally {
      jest.restoreAllMocks();
    }
  });
});

describe('/api/health production readiness', () => {
  afterEach(() => {
    jest.resetModules();
    jest.dontMock('@/lib/api/env');
    jest.dontMock('@/lib/api/middleware');
  });

  it('returns 503 without leaking individual production readiness failures', async () => {
    jest.resetModules();
    jest.doMock('@/lib/api/middleware', () => ({
      runMiddleware: jest.fn(() => null),
    }));
    jest.doMock('@/lib/api/env', () => ({
      serverEnv: {
        isProduction: true,
        getProductionReadinessFailures: () => [
          'SHIORA_SESSION_SECRET must be set to a 32+ character secret.',
          'DATABASE_URL must point to a durable audited datastore.',
        ],
      },
    }));

    const { GET: getHealth } = require('@/app/api/health/route');
    const req = new NextRequest('https://app.shiora.health/api/health', { method: 'GET' });
    const res = await getHealth(req);
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('PRODUCTION_READINESS_FAILED');
    expect(body.error.details).toEqual({
      readiness: {
        status: 'unready',
        failureCount: 2,
      },
    });
    expect(JSON.stringify(body)).not.toContain('SHIORA_SESSION_SECRET');
    expect(JSON.stringify(body)).not.toContain('DATABASE_URL');
  });

  it('returns ready in production when regulated readiness checks pass', async () => {
    jest.resetModules();
    jest.doMock('@/lib/api/middleware', () => ({
      runMiddleware: jest.fn(() => null),
    }));
    jest.doMock('@/lib/api/env', () => ({
      serverEnv: {
        isProduction: true,
        getProductionReadinessFailures: () => [],
      },
    }));

    const { GET: getHealth } = require('@/app/api/health/route');
    const req = new NextRequest('https://app.shiora.health/api/health', { method: 'GET' });
    const res = await getHealth(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.readiness).toEqual({
      status: 'ready',
      failureCount: 0,
    });
  });
});
