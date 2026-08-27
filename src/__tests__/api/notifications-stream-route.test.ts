/** @jest-environment node */

jest.mock('@/lib/api/middleware', () => {
  const actual = jest.requireActual('@/lib/api/middleware');
  return { ...actual, runMiddleware: jest.fn((...args: unknown[]) => actual.runMiddleware(...args)) };
});

import { NextRequest, NextResponse } from 'next/server';
import { runMiddleware } from '@/lib/api/middleware';
import { GET as stream, dynamic } from '@/app/api/notifications/stream/route';
import { createSessionToken } from '@/lib/api/session';
import { __resetNotificationsForTests } from '@/lib/api/notification-service';
import { seededAddress } from '@/lib/utils';

const mockedRunMiddleware = runMiddleware as jest.MockedFunction<typeof runMiddleware>;
const URL = 'http://localhost:3000/api/notifications/stream';
const ADDR = seededAddress(2201);

afterEach(() => {
  __resetNotificationsForTests();
  mockedRunMiddleware.mockImplementation((...args: unknown[]) =>
    jest.requireActual('@/lib/api/middleware').runMiddleware(...args));
});

function authed(): NextRequest {
  return new NextRequest(URL, { headers: { authorization: `Bearer ${createSessionToken(ADDR).token}` } });
}

describe('GET /api/notifications/stream', () => {
  it('is rendered per-request (never prerendered/cached)', () => {
    expect(dynamic).toBe('force-dynamic');
  });

  it('replays missed notifications when the client reconnects with Last-Event-ID', async () => {
    const { notify } = jest.requireActual('@/lib/api/notification-service');
    const first = await notify(ADDR, { type: 'consent', title: 'Seen', body: 'ack' });
    await new Promise((r) => setTimeout(r, 3));
    await notify(ADDR, { type: 'consent', title: 'MissedWhileOffline', body: 'replay me' });

    const res = await stream(new NextRequest(URL, {
      headers: {
        authorization: `Bearer ${createSessionToken(ADDR).token}`,
        'last-event-id': first!.id,
      },
    }));
    expect(res.status).toBe(200);

    const reader = res.body!.getReader();
    let acc = '';
    const deadline = Date.now() + 2000;
    while (Date.now() < deadline && !acc.includes('MissedWhileOffline')) {
      const { value, done } = await reader.read();
      if (done) break;
      acc += new TextDecoder().decode(value);
    }
    expect(acc).toContain('MissedWhileOffline');
    expect(acc).not.toContain('"title":"Seen"');
    await reader.cancel();
  });

  it('opens an SSE stream for an authenticated caller', async () => {
    const res = await stream(authed());
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('text/event-stream');
    expect(res.headers.get('Cache-Control')).toContain('no-store');

    // Read the opening frame, then close.
    const reader = res.body!.getReader();
    const { value } = await reader.read();
    expect(new TextDecoder().decode(value)).toContain('retry:');
    await reader.cancel();
  });

  it('requires authentication', async () => {
    const res = await stream(new NextRequest(URL));
    expect(res.status).toBe(401);
  });

  it('route-level requireAuth blocks if middleware passed without auth', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(null);
    const res = await stream(new NextRequest(URL));
    expect(res.status).toBe(401);
  });

  it('returns the middleware block when blocked', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(NextResponse.json({ error: 'blocked' }, { status: 429 }));
    const res = await stream(authed());
    expect(res.status).toBe(429);
  });
});
