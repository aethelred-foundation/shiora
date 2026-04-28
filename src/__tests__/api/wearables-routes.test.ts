/** @jest-environment node */

jest.mock('@/lib/api/middleware', () => {
  const actual = jest.requireActual('@/lib/api/middleware');
  return {
    ...actual,
    runMiddleware: jest.fn((...args: unknown[]) => actual.runMiddleware(...args)),
  };
});

const actualUtils = jest.requireActual('@/lib/utils');
const mockSeededRandom = jest.fn(actualUtils.seededRandom);
jest.mock('@/lib/utils', () => ({
  ...jest.requireActual('@/lib/utils'),
  seededRandom: (...args: unknown[]) => mockSeededRandom(...args),
}));

import { NextRequest, NextResponse } from 'next/server';
import { runMiddleware } from '@/lib/api/middleware';

const mockedRunMiddleware = runMiddleware as jest.MockedFunction<typeof runMiddleware>;
import { GET as getWearables } from '@/app/api/wearables/route';
import {
  POST as connectDevice,
  DELETE as disconnectDevice,
} from '@/app/api/wearables/[provider]/route';
import { GET as getSyncBatches, POST as syncWearables } from '@/app/api/wearables/sync/route';

afterEach(() => {
  mockedRunMiddleware.mockImplementation((...args: unknown[]) => {
    const actual = jest.requireActual('@/lib/api/middleware');
    return actual.runMiddleware(...args);
  });
  mockSeededRandom.mockImplementation(actualUtils.seededRandom);
});

describe('/api/wearables', () => {
  it('GET returns middleware error when blocked', async () => {
    mockedRunMiddleware.mockReturnValueOnce(
      NextResponse.json({ error: 'blocked' }, { status: 403 }),
    );
    const res = await getWearables(new NextRequest('http://localhost:3000/api/wearables'));
    expect(res.status).toBe(403);
  });

  it('GET returns wearables list', async () => {
    const res = await getWearables(new NextRequest('http://localhost:3000/api/wearables'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('GET returns data-points view with default metric', async () => {
    const res = await getWearables(
      new NextRequest('http://localhost:3000/api/wearables?view=data-points'),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data[0].metric).toBe('heart_rate');
  });

  it('GET returns data-points view with specific metric', async () => {
    const res = await getWearables(
      new NextRequest('http://localhost:3000/api/wearables?view=data-points&metric=sleep_duration'),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data[0].metric).toBe('sleep_duration');
    expect(body.data[0].unit).toBe('hours');
  });

  it('GET returns wearables with syncing status via seededRandom mock', async () => {
    // Force seededRandom to always return > 0.8 so connected devices get 'syncing' status
    mockSeededRandom.mockReturnValue(0.95);
    const res = await getWearables(new NextRequest('http://localhost:3000/api/wearables'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    const syncingDevices = body.data.filter((d: { status: string }) => d.status === 'syncing');
    expect(syncingDevices.length).toBeGreaterThan(0);
  });

  it('GET returns data-points view with unknown metric (falls back to heart_rate config)', async () => {
    const res = await getWearables(
      new NextRequest('http://localhost:3000/api/wearables?view=data-points&metric=unknown_metric'),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data[0].metric).toBe('unknown_metric');
    // Should use heart_rate config as fallback
    expect(body.data[0].unit).toBe('bpm');
  });
});

describe('/api/wearables/[provider]', () => {
  it('POST returns middleware error when blocked', async () => {
    mockedRunMiddleware.mockReturnValueOnce(
      NextResponse.json({ error: 'blocked' }, { status: 403 }),
    );
    const res = await connectDevice(
      new NextRequest('http://localhost:3000/api/wearables/apple_health', { method: 'POST' }),
      { params: Promise.resolve({ provider: 'apple_health' }) },
    );
    expect(res.status).toBe(403);
  });

  it('DELETE returns middleware error when blocked', async () => {
    mockedRunMiddleware.mockReturnValueOnce(
      NextResponse.json({ error: 'blocked' }, { status: 403 }),
    );
    const res = await disconnectDevice(
      new NextRequest('http://localhost:3000/api/wearables/apple_health', { method: 'DELETE' }),
      { params: Promise.resolve({ provider: 'apple_health' }) },
    );
    expect(res.status).toBe(403);
  });

  it('POST connects a known provider device', async () => {
    const res = await connectDevice(
      new NextRequest('http://localhost:3000/api/wearables/apple_health', {
        method: 'POST',
      }),
      { params: Promise.resolve({ provider: 'apple_health' }) },
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.provider).toBe('apple_health');
    expect(body.data.status).toBe('connected');
    expect(body.data.attestation).toBeDefined();
  });

  it('POST returns 400 for unknown provider', async () => {
    const res = await connectDevice(
      new NextRequest('http://localhost:3000/api/wearables/unknown-device', {
        method: 'POST',
      }),
      { params: Promise.resolve({ provider: 'unknown-device' }) },
    );
    expect(res.status).toBe(400);
  });

  it('DELETE disconnects a device', async () => {
    const res = await disconnectDevice(
      new NextRequest('http://localhost:3000/api/wearables/apple_health', {
        method: 'DELETE',
      }),
      { params: Promise.resolve({ provider: 'apple_health' }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.provider).toBe('apple_health');
    expect(body.data.status).toBe('disconnected');
  });
});

describe('/api/wearables/sync', () => {
  it('POST returns middleware error when blocked', async () => {
    mockedRunMiddleware.mockReturnValueOnce(
      NextResponse.json({ error: 'blocked' }, { status: 403 }),
    );
    const res = await syncWearables(
      new NextRequest('http://localhost:3000/api/wearables/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId: 'test' }),
      }),
    );
    expect(res.status).toBe(403);
  });

  it('GET returns sync batches', async () => {
    const res = await getSyncBatches(new NextRequest('http://localhost:3000/api/wearables/sync'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.data[0].attestation).toBeDefined();
  });

  it('POST triggers sync with valid deviceId', async () => {
    const res = await syncWearables(
      new NextRequest('http://localhost:3000/api/wearables/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId: 'device-test-123' }),
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.deviceId).toBe('device-test-123');
    expect(body.data.status).toBe('completed');
    expect(body.data.attestation).toBeDefined();
  });

  it('POST returns 422 for missing deviceId', async () => {
    const res = await syncWearables(
      new NextRequest('http://localhost:3000/api/wearables/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }),
    );
    expect(res.status).toBe(422);
  });

  it('POST throws on invalid JSON body (non-Zod error)', async () => {
    await expect(
      syncWearables(
        new NextRequest('http://localhost:3000/api/wearables/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: 'not-json',
        }),
      ),
    ).rejects.toThrow();
  });

  it('GET returns middleware error when blocked', async () => {
    mockedRunMiddleware.mockReturnValueOnce(
      NextResponse.json({ error: 'blocked' }, { status: 403 }),
    );
    const res = await getSyncBatches(new NextRequest('http://localhost:3000/api/wearables/sync'));
    expect(res.status).toBe(403);
  });
});
