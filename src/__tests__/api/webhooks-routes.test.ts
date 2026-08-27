/** @jest-environment node */

jest.mock('@/lib/api/middleware', () => {
  const actual = jest.requireActual('@/lib/api/middleware');
  return { ...actual, runMiddleware: jest.fn((...args: unknown[]) => actual.runMiddleware(...args)) };
});

// Deliver without touching the network.
jest.mock('@/lib/api/webhook-service', () => {
  const actual = jest.requireActual('@/lib/api/webhook-service');
  return {
    ...actual,
    deliverWebhook: jest.fn(async () => ({ delivered: true, status: 200, attempts: 1 })),
    createSubscription: jest.fn((...args: unknown[]) => actual.createSubscription(...args)),
  };
});

import { NextRequest, NextResponse } from 'next/server';
import { runMiddleware } from '@/lib/api/middleware';
import { GET as listHooks, POST as createHook } from '@/app/api/webhooks/route';
import { DELETE as deleteHook } from '@/app/api/webhooks/[id]/route';
import { POST as testHook } from '@/app/api/webhooks/[id]/test/route';
import { deliverWebhook, createSubscription, __resetWebhooksForTests } from '@/lib/api/webhook-service';
import { createSessionToken } from '@/lib/api/session';
import { seededAddress } from '@/lib/utils';

const mockedRunMiddleware = runMiddleware as jest.MockedFunction<typeof runMiddleware>;
const mockedDeliver = deliverWebhook as jest.MockedFunction<typeof deliverWebhook>;
const mockedCreate = createSubscription as jest.MockedFunction<typeof createSubscription>;
const ADDR = seededAddress(2199);
const token = createSessionToken(ADDR).token;
const BASE = 'http://localhost:3000/api/webhooks';

afterEach(() => {
  __resetWebhooksForTests();
  mockedDeliver.mockClear();
  mockedCreate.mockImplementation((...args: unknown[]) => jest.requireActual('@/lib/api/webhook-service').createSubscription(...args));
  mockedRunMiddleware.mockImplementation((...args: unknown[]) =>
    jest.requireActual('@/lib/api/middleware').runMiddleware(...args));
});

function authed(url: string, init: RequestInit = {}): NextRequest {
  return new NextRequest(url, { ...init, headers: { ...(init.headers ?? {}), authorization: `Bearer ${token}` } });
}
function jsonBody(body: unknown): RequestInit {
  return { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

async function create(url = 'https://hooks.partner.example.com/x'): Promise<string> {
  const res = await createHook(authed(BASE, jsonBody({ url })));
  return (await res.json()).data.id;
}

describe('/api/webhooks', () => {
  it('creates a subscription and returns the signing secret once', async () => {
    const res = await createHook(authed(BASE, jsonBody({ url: 'https://hooks.partner.example.com/x', events: ['record.created'] })));
    expect(res.status).toBe(201);
    const { data } = await res.json();
    expect(data.secret).toMatch(/^whsec_/);
    expect(data.events).toEqual(['record.created']);
  });

  it('rejects an unsafe URL with 400', async () => {
    const res = await createHook(authed(BASE, jsonBody({ url: 'https://169.254.169.254/x' })));
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('INVALID_WEBHOOK_URL');
  });

  it('validates the body (422 for a non-URL)', async () => {
    const res = await createHook(authed(BASE, jsonBody({ url: 'not-a-url' })));
    expect(res.status).toBe(422);
  });

  it('lists the caller subscriptions with secrets redacted', async () => {
    await create();
    const res = await listHooks(authed(BASE));
    const { data } = await res.json();
    expect(data.total).toBe(1);
    expect(data.subscriptions[0].secretPreview).toMatch(/…$/);
  });

  it('deletes a subscription, then 404s', async () => {
    const id = await create();
    expect((await deleteHook(authed(`${BASE}/${id}`, { method: 'DELETE' }), ctx(id))).status).toBe(200);
    expect((await deleteHook(authed(`${BASE}/${id}`, { method: 'DELETE' }), ctx(id))).status).toBe(404);
  });

  it('sends a signed test delivery', async () => {
    const id = await create();
    const res = await testHook(authed(`${BASE}/${id}/test`, { method: 'POST' }), ctx(id));
    expect(res.status).toBe(200);
    expect((await res.json()).data.delivered).toBe(true);
    expect(mockedDeliver).toHaveBeenCalledTimes(1);
  });

  it('404s a test delivery for an unknown subscription', async () => {
    const res = await testHook(authed(`${BASE}/nope/test`, { method: 'POST' }), ctx('nope'));
    expect(res.status).toBe(404);
  });

  it('rethrows a non-URL, non-validation error from the service', async () => {
    mockedCreate.mockRejectedValueOnce(new Error('datastore exploded'));
    await expect(createHook(authed(BASE, jsonBody({ url: 'https://ok.example.com/x' })))).rejects.toThrow('datastore exploded');
  });

  it('route-level requireAuth blocks each route if middleware passed without auth', async () => {
    mockedRunMiddleware.mockResolvedValue(null);
    expect((await listHooks(new NextRequest(BASE))).status).toBe(401);
    expect((await deleteHook(new NextRequest(`${BASE}/x`, { method: 'DELETE' }), ctx('x'))).status).toBe(401);
    expect((await testHook(new NextRequest(`${BASE}/x/test`, { method: 'POST' }), ctx('x'))).status).toBe(401);
    expect((await createHook(new NextRequest(BASE, jsonBody({ url: 'https://ok.example.com/x' })))).status).toBe(401);
  });

  it('requires authentication on each route', async () => {
    expect((await listHooks(new NextRequest(BASE))).status).toBe(401);
    expect((await createHook(new NextRequest(BASE, jsonBody({ url: 'https://x.example.com' })))).status).toBe(401);
    expect((await deleteHook(new NextRequest(`${BASE}/x`, { method: 'DELETE' }), ctx('x'))).status).toBe(401);
    expect((await testHook(new NextRequest(`${BASE}/x/test`, { method: 'POST' }), ctx('x'))).status).toBe(401);
  });

  it('returns the middleware block when blocked', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(NextResponse.json({ error: 'blocked' }, { status: 429 }));
    expect((await listHooks(authed(BASE))).status).toBe(429);
  });
});
