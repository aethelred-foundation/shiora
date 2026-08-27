/** @jest-environment node */

jest.mock('@/lib/api/middleware', () => {
  const actual = jest.requireActual('@/lib/api/middleware');
  return { ...actual, runMiddleware: jest.fn((...args: unknown[]) => actual.runMiddleware(...args)) };
});

jest.mock('@/lib/api/env', () => {
  const actual = jest.requireActual('@/lib/api/env');
  return {
    ...actual,
    serverEnv: new Proxy(actual.serverEnv, {
      get(target, prop) {
        if (prop === 'metricsToken') {
          return mockMetricsToken;
        }
        return Reflect.get(target, prop);
      },
    }),
  };
});

let mockMetricsToken: string | null = null;

import { NextRequest, NextResponse } from 'next/server';
import { runMiddleware } from '@/lib/api/middleware';
import { GET as getMetrics } from '@/app/api/system/metrics/route';
import { createSessionToken } from '@/lib/api/session';
import { counter, __resetMetricsForTests } from '@/lib/observability/metrics';
import { __resetRolesForTests } from '@/lib/api/roles-service';
import { seededAddress } from '@/lib/utils';

const mockedRunMiddleware = runMiddleware as jest.MockedFunction<typeof runMiddleware>;
const URL = 'http://localhost:3000/api/system/metrics';
const ADMIN = seededAddress(777);
const USER = seededAddress(778);
const originalAdmins = process.env.SHIORA_ADMIN_ADDRESSES;

beforeEach(() => {
  process.env.SHIORA_ADMIN_ADDRESSES = ADMIN;
  mockMetricsToken = null;
  __resetRolesForTests();
});

afterEach(() => {
  if (originalAdmins === undefined) {
    delete process.env.SHIORA_ADMIN_ADDRESSES;
  } else {
    process.env.SHIORA_ADMIN_ADDRESSES = originalAdmins;
  }
  __resetMetricsForTests();
  mockedRunMiddleware.mockImplementation((...args: unknown[]) =>
    jest.requireActual('@/lib/api/middleware').runMiddleware(...args));
});

function req(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(URL, { headers });
}

describe('GET /api/system/metrics', () => {
  it('serves Prometheus exposition to a valid scraper token', async () => {
    mockMetricsToken = 'scraper-token-0123456789abcdef';
    counter('shiora_probe_total', 'probe').inc({ src: 'test' });

    const res = await getMetrics(req({ authorization: 'Bearer scraper-token-0123456789abcdef' }));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/plain; version=0.0.4');
    const body = await res.text();
    expect(body).toContain('# TYPE shiora_probe_total counter');
    expect(body).toContain('shiora_probe_total{src="test"} 1');
  });

  it('rejects a wrong token without an admin session (401 — no credentials)', async () => {
    mockMetricsToken = 'scraper-token-0123456789abcdef';
    const res = await getMetrics(req({ authorization: 'Bearer wrong-token-000000000000' }));
    expect(res.status).toBe(401);
  });

  it('rejects a same-length wrong token (timing-safe compare, not prefix match)', async () => {
    mockMetricsToken = 'scraper-token-0123456789abcdef';
    const wrong = 'scraper-token-0123456789abcdeX';
    const res = await getMetrics(req({ authorization: `Bearer ${wrong}` }));
    expect(res.status).toBe(401);
  });

  it('rejects a non-Bearer authorization header', async () => {
    mockMetricsToken = 'scraper-token-0123456789abcdef';
    const res = await getMetrics(req({ authorization: 'Basic dXNlcjpwYXNz' }));
    expect(res.status).toBe(401);
  });

  it('is admin-only when no token is configured', async () => {
    const unauthenticated = await getMetrics(req());
    expect(unauthenticated.status).toBe(401);

    const nonAdmin = await getMetrics(
      req({ authorization: `Bearer ${createSessionToken(USER).token}` }),
    );
    expect(nonAdmin.status).toBe(403);

    counter('shiora_admin_probe_total', 'probe').inc();
    const admin = await getMetrics(
      req({ authorization: `Bearer ${createSessionToken(ADMIN).token}` }),
    );
    expect(admin.status).toBe(200);
    expect(await admin.text()).toContain('# TYPE shiora_admin_probe_total counter');
  });

  it('returns the middleware block when blocked', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(NextResponse.json({ error: 'blocked' }, { status: 429 }));
    const res = await getMetrics(req());
    expect(res.status).toBe(429);
  });
});
