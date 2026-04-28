/** @jest-environment node */

import { NextRequest, NextResponse } from 'next/server';

// We need to use jest.mock to intercept runMiddleware calls in the route modules
// since they import the function directly (not as a method on the module object).
const mockRunMiddleware = jest.fn<NextResponse | null, [NextRequest, ...unknown[]]>(() => null);

jest.mock('@/lib/api/middleware', () => ({
  ...jest.requireActual('@/lib/api/middleware'),
  runMiddleware: (...args: unknown[]) =>
    mockRunMiddleware(args[0] as NextRequest, ...args.slice(1)),
}));

const actualConstants = jest.requireActual('@/lib/constants');
jest.mock('@/lib/constants', () => ({
  ...jest.requireActual('@/lib/constants'),
  get ALERT_METRICS() {
    return mockAlertMetrics ?? actualConstants.ALERT_METRICS;
  },
}));

let mockAlertMetrics: unknown[] | null = null;

import { GET as getAlerts, POST as postAlert } from '@/app/api/alerts/route';
import { GET as getHistory } from '@/app/api/alerts/history/route';
import {
  GET as getRules,
  POST as postRule,
  PATCH as patchRule,
} from '@/app/api/alerts/rules/route';
import { POST as resolveAlert } from '@/app/api/alerts/[id]/resolve/route';
import { POST as acknowledgeAlert } from '@/app/api/alerts/[id]/acknowledge/route';

beforeEach(() => {
  mockRunMiddleware.mockReset();
  mockRunMiddleware.mockReturnValue(null);
});

describe('/api/alerts', () => {
  it('GET returns alerts list', async () => {
    const req = new NextRequest('http://localhost:3000/api/alerts');
    const res = await getAlerts(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('GET filters by severity', async () => {
    const req = new NextRequest('http://localhost:3000/api/alerts?severity=critical');
    const res = await getAlerts(req);
    const body = await res.json();
    expect(body.success).toBe(true);
    body.data.forEach((a: { severity: string }) => {
      expect(a.severity).toBe('critical');
    });
  });

  it('GET filters by status=active', async () => {
    const req = new NextRequest('http://localhost:3000/api/alerts?status=active');
    const res = await getAlerts(req);
    const body = await res.json();
    body.data.forEach((a: { acknowledgedAt?: number; resolvedAt?: number }) => {
      expect(a.acknowledgedAt).toBeUndefined();
      expect(a.resolvedAt).toBeUndefined();
    });
  });

  it('GET filters by status=acknowledged', async () => {
    const req = new NextRequest('http://localhost:3000/api/alerts?status=acknowledged');
    const res = await getAlerts(req);
    const body = await res.json();
    expect(body.success).toBe(true);
    body.data.forEach((a: { acknowledgedAt?: number; resolvedAt?: number }) => {
      expect(a.acknowledgedAt).toBeDefined();
      expect(a.resolvedAt).toBeUndefined();
    });
  });

  it('GET filters by status=resolved', async () => {
    const req = new NextRequest('http://localhost:3000/api/alerts?status=resolved');
    const res = await getAlerts(req);
    const body = await res.json();
    expect(body.success).toBe(true);
    body.data.forEach((a: { resolvedAt?: number }) => {
      expect(a.resolvedAt).toBeDefined();
    });
  });

  it('GET with unknown status returns all alerts', async () => {
    const req = new NextRequest('http://localhost:3000/api/alerts?status=unknown');
    const res = await getAlerts(req);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
  });

  it('GET with both severity and status filters', async () => {
    const req = new NextRequest('http://localhost:3000/api/alerts?severity=warning&status=active');
    const res = await getAlerts(req);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('GET returns blocked response when middleware blocks', async () => {
    mockRunMiddleware.mockReturnValueOnce(
      new NextResponse(JSON.stringify({ error: 'blocked' }), { status: 429 }),
    );
    const res = await getAlerts(new NextRequest('http://localhost:3000/api/alerts'));
    expect(res.status).toBe(429);
  });

  it('GET falls back to "Health Alert" title for unknown metric', async () => {
    // Replace ALERT_METRICS with a single unknown metric so that
    // titles[metric] is undefined and the ?? fallback is triggered
    mockAlertMetrics = [
      {
        id: 'unknown_metric',
        label: 'Unknown',
        unit: 'x',
        defaultThreshold: 50,
        condition: 'above',
      },
    ];
    const res = await getAlerts(new NextRequest('http://localhost:3000/api/alerts'));
    const body = await res.json();
    expect(body.success).toBe(true);
    // All alerts should have the fallback title since the only metric has no title entry
    body.data.forEach((a: { title: string }) => {
      expect(a.title).toBe('Health Alert');
    });
    mockAlertMetrics = null;
  });

  it('POST returns 400 for invalid JSON body', async () => {
    const req = new NextRequest('http://localhost:3000/api/alerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-valid-json',
    });
    const res = await postAlert(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_BODY');
  });

  it('POST acknowledges an alert', async () => {
    const req = new NextRequest('http://localhost:3000/api/alerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alertId: 'alert-123', action: 'acknowledge' }),
    });
    const res = await postAlert(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.alertId).toBe('alert-123');
    expect(body.data.action).toBe('acknowledge');
  });

  it('POST returns error for missing fields', async () => {
    const req = new NextRequest('http://localhost:3000/api/alerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const res = await postAlert(req);
    expect(res.status).toBe(400);
  });

  it('POST returns error for invalid action', async () => {
    const req = new NextRequest('http://localhost:3000/api/alerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alertId: 'a', action: 'invalid' }),
    });
    const res = await postAlert(req);
    expect(res.status).toBe(400);
  });

  it('POST returns blocked response when middleware blocks', async () => {
    mockRunMiddleware.mockReturnValueOnce(
      new NextResponse(JSON.stringify({ error: 'blocked' }), { status: 429 }),
    );
    const res = await postAlert(
      new NextRequest('http://localhost:3000/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alertId: 'a', action: 'acknowledge' }),
      }),
    );
    expect(res.status).toBe(429);
  });
});

describe('/api/alerts/history', () => {
  it('GET returns alert history', async () => {
    const req = new NextRequest('http://localhost:3000/api/alerts/history');
    const res = await getHistory(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('GET filters history by alertId', async () => {
    const req = new NextRequest(
      'http://localhost:3000/api/alerts/history?alertId=alert-nonexistent',
    );
    const res = await getHistory(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toEqual([]);
  });

  it('GET returns blocked response when middleware blocks', async () => {
    mockRunMiddleware.mockReturnValueOnce(
      new NextResponse(JSON.stringify({ error: 'blocked' }), { status: 429 }),
    );
    const res = await getHistory(new NextRequest('http://localhost:3000/api/alerts/history'));
    expect(res.status).toBe(429);
  });
});

describe('/api/alerts/rules', () => {
  it('GET returns alert rules', async () => {
    const req = new NextRequest('http://localhost:3000/api/alerts/rules');
    const res = await getRules(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('GET returns blocked response when middleware blocks', async () => {
    mockRunMiddleware.mockReturnValueOnce(
      new NextResponse(JSON.stringify({ error: 'blocked' }), { status: 429 }),
    );
    const res = await getRules(new NextRequest('http://localhost:3000/api/alerts/rules'));
    expect(res.status).toBe(429);
  });

  it('POST creates a new alert rule with all fields', async () => {
    const res = await postRule(
      new NextRequest('http://localhost:3000/api/alerts/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metric: 'heart_rate',
          condition: 'above',
          threshold: 120,
          unit: 'bpm',
          severity: 'critical',
          channels: ['email', 'push'],
          cooldownMinutes: 60,
        }),
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.metric).toBe('heart_rate');
    expect(body.data.channels).toEqual(['email', 'push']);
    expect(body.data.cooldownMinutes).toBe(60);
  });

  it('POST creates rule with defaults for optional fields', async () => {
    const res = await postRule(
      new NextRequest('http://localhost:3000/api/alerts/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metric: 'glucose',
          condition: 'above',
          threshold: 180,
          severity: 'warning',
        }),
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.unit).toBe('');
    expect(body.data.channels).toEqual(['in_app']);
    expect(body.data.cooldownMinutes).toBe(30);
  });

  it('POST returns 400 for missing required fields', async () => {
    const res = await postRule(
      new NextRequest('http://localhost:3000/api/alerts/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metric: 'heart_rate' }),
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('POST returns 400 for invalid JSON body', async () => {
    const res = await postRule(
      new NextRequest('http://localhost:3000/api/alerts/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not-json',
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_BODY');
  });

  it('POST returns blocked response when middleware blocks', async () => {
    mockRunMiddleware.mockReturnValueOnce(
      new NextResponse(JSON.stringify({ error: 'blocked' }), { status: 429 }),
    );
    const res = await postRule(
      new NextRequest('http://localhost:3000/api/alerts/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metric: 'hr',
          condition: 'above',
          threshold: 100,
          severity: 'warning',
        }),
      }),
    );
    expect(res.status).toBe(429);
  });

  it('PATCH updates an existing rule', async () => {
    // First get a real rule id
    const listRes = await getRules(new NextRequest('http://localhost:3000/api/alerts/rules'));
    const listBody = await listRes.json();
    const ruleId = listBody.data[0].id;

    const res = await patchRule(
      new NextRequest('http://localhost:3000/api/alerts/rules', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: ruleId, threshold: 999 }),
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.threshold).toBe(999);
  });

  it('PATCH returns 400 for missing id', async () => {
    const res = await patchRule(
      new NextRequest('http://localhost:3000/api/alerts/rules', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threshold: 100 }),
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('PATCH returns 404 for nonexistent rule', async () => {
    const res = await patchRule(
      new NextRequest('http://localhost:3000/api/alerts/rules', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: 'rule-nonexistent', threshold: 100 }),
      }),
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('PATCH returns 400 for invalid JSON body', async () => {
    const res = await patchRule(
      new NextRequest('http://localhost:3000/api/alerts/rules', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: 'not-json',
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_BODY');
  });

  it('PATCH returns blocked response when middleware blocks', async () => {
    mockRunMiddleware.mockReturnValueOnce(
      new NextResponse(JSON.stringify({ error: 'blocked' }), { status: 429 }),
    );
    const res = await patchRule(
      new NextRequest('http://localhost:3000/api/alerts/rules', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: 'rule-1', threshold: 50 }),
      }),
    );
    expect(res.status).toBe(429);
  });
});

describe('/api/alerts/[id]/resolve', () => {
  it('POST resolves an alert by id', async () => {
    const res = await resolveAlert(
      new NextRequest('http://localhost:3000/api/alerts/alert-123/resolve', { method: 'POST' }),
      { params: Promise.resolve({ id: 'alert-123' }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.id).toBe('alert-123');
    expect(body.data.status).toBe('resolved');
    expect(body.data.resolvedAt).toBeDefined();
  });

  it('POST returns blocked response when middleware blocks', async () => {
    mockRunMiddleware.mockReturnValueOnce(
      new NextResponse(JSON.stringify({ error: 'blocked' }), { status: 403 }),
    );
    const res = await resolveAlert(
      new NextRequest('http://localhost:3000/api/alerts/alert-123/resolve', { method: 'POST' }),
      { params: Promise.resolve({ id: 'alert-123' }) },
    );
    expect(res.status).toBe(403);
  });
});

describe('/api/alerts/[id]/acknowledge', () => {
  it('POST acknowledges an alert by id', async () => {
    const res = await acknowledgeAlert(
      new NextRequest('http://localhost:3000/api/alerts/alert-456/acknowledge', { method: 'POST' }),
      { params: Promise.resolve({ id: 'alert-456' }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.id).toBe('alert-456');
    expect(body.data.status).toBe('acknowledged');
    expect(body.data.acknowledgedAt).toBeDefined();
  });

  it('POST returns blocked response when middleware blocks', async () => {
    mockRunMiddleware.mockReturnValueOnce(
      new NextResponse(JSON.stringify({ error: 'blocked' }), { status: 403 }),
    );
    const res = await acknowledgeAlert(
      new NextRequest('http://localhost:3000/api/alerts/alert-456/acknowledge', { method: 'POST' }),
      { params: Promise.resolve({ id: 'alert-456' }) },
    );
    expect(res.status).toBe(403);
  });
});
