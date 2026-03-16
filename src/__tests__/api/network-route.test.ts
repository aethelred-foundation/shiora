/** @jest-environment node */

jest.mock('@/lib/api/middleware', () => {
  const actual = jest.requireActual('@/lib/api/middleware');
  return { ...actual, runMiddleware: jest.fn((...args: unknown[]) => actual.runMiddleware(...args)) };
});

import { NextRequest, NextResponse } from 'next/server';
import { runMiddleware } from '@/lib/api/middleware';
import { GET } from '@/app/api/network/status/route';

const mockedRunMiddleware = runMiddleware as jest.MockedFunction<typeof runMiddleware>;

describe('/api/network/status', () => {
  afterEach(() => {
    mockedRunMiddleware.mockImplementation((...args: unknown[]) => {
      const actual = jest.requireActual('@/lib/api/middleware');
      return actual.runMiddleware(...args);
    });
  });

  it('returns network status with expected fields', async () => {
    const req = new NextRequest('http://localhost:3000/api/network/status');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('blockHeight');
    expect(body.data).toHaveProperty('tps');
    expect(body.data).toHaveProperty('epoch');
    expect(body.data).toHaveProperty('networkLoad');
    expect(body.data).toHaveProperty('aethelPrice');
  });

  it('returns middleware error when blocked', async () => {
    mockedRunMiddleware.mockReturnValueOnce(NextResponse.json({ error: 'blocked' }, { status: 403 }));
    const req = new NextRequest('http://localhost:3000/api/network/status');
    const res = await GET(req);
    expect(res.status).toBe(403);
  });
});
