/** @jest-environment node */

jest.mock('@/lib/api/middleware', () => {
  const actual = jest.requireActual('@/lib/api/middleware');
  return { ...actual, runMiddleware: jest.fn((...args: unknown[]) => actual.runMiddleware(...args)) };
});

import { NextRequest, NextResponse } from 'next/server';
import { runMiddleware } from '@/lib/api/middleware';
import { GET } from '@/app/api/system/status/route';

const mockedRunMiddleware = runMiddleware as jest.MockedFunction<typeof runMiddleware>;

afterEach(() => {
  mockedRunMiddleware.mockImplementation((...args: unknown[]) => {
    const actual = jest.requireActual('@/lib/api/middleware');
    return actual.runMiddleware(...args);
  });
});

const URL = 'http://localhost:3000/api/system/status';

describe('/api/system/status', () => {
  it('returns the middleware error when blocked', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(NextResponse.json({ error: 'blocked' }, { status: 403 }));
    expect((await GET(new NextRequest(URL))).status).toBe(403);
  });

  it('publishes the maturity registry and readiness', async () => {
    const res = await GET(new NextRequest(URL));
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.data.service).toBe('Shiora on Aethelred');
    expect(body.data.maturity.production).toBeGreaterThan(0);
    expect(body.data.maturity.simulated).toBeGreaterThan(0);

    const phi = body.data.features.find((f: { key: string }) => f.key === 'phi_records');
    expect(phi.maturity).toBe('production');
    const tee = body.data.features.find((f: { key: string }) => f.key === 'tee_attestation');
    expect(tee.maturity).toBe('simulated');

    expect(body.data.readiness).toHaveProperty('ok');
    expect(body.data.readiness).toHaveProperty('problems');
  });

  it('counts in the maturity summary match the feature list length', async () => {
    const body = await (await GET(new NextRequest(URL))).json();
    const { production, pilot, simulated } = body.data.maturity;
    expect(production + pilot + simulated).toBe(body.data.features.length);
  });
});
