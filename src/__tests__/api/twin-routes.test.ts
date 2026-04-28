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
import { GET as getTwin } from '@/app/api/twin/route';

const mockedRunMiddleware = runMiddleware as jest.MockedFunction<typeof runMiddleware>;
import { GET as getParameters } from '@/app/api/twin/parameters/route';
import { GET as getPredictions } from '@/app/api/twin/predictions/route';
import { GET as getSimulations, POST as createSimulation } from '@/app/api/twin/simulations/route';

describe('/api/twin', () => {
  afterEach(() => {
    mockedRunMiddleware.mockImplementation((...args: unknown[]) => {
      const actual = jest.requireActual('@/lib/api/middleware');
      return actual.runMiddleware(...args);
    });
  });

  it('GET returns digital twin data', async () => {
    const res = await getTwin(new NextRequest('http://localhost:3000/api/twin'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
  });

  it('GET returns middleware error when blocked', async () => {
    mockedRunMiddleware.mockReturnValueOnce(
      NextResponse.json({ error: 'blocked' }, { status: 403 }),
    );
    const res = await getTwin(new NextRequest('http://localhost:3000/api/twin'));
    expect(res.status).toBe(403);
  });
});

describe('/api/twin/parameters', () => {
  it('GET returns twin parameters', async () => {
    const res = await getParameters(new NextRequest('http://localhost:3000/api/twin/parameters'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
  });

  it('GET returns middleware error when blocked', async () => {
    mockedRunMiddleware.mockReturnValueOnce(
      NextResponse.json({ error: 'blocked' }, { status: 403 }),
    );
    const res = await getParameters(new NextRequest('http://localhost:3000/api/twin/parameters'));
    expect(res.status).toBe(403);
  });
});

describe('/api/twin/predictions', () => {
  it('GET returns twin predictions', async () => {
    const res = await getPredictions(new NextRequest('http://localhost:3000/api/twin/predictions'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
  });

  it('GET returns middleware error when blocked', async () => {
    mockedRunMiddleware.mockReturnValueOnce(
      NextResponse.json({ error: 'blocked' }, { status: 403 }),
    );
    const res = await getPredictions(new NextRequest('http://localhost:3000/api/twin/predictions'));
    expect(res.status).toBe(403);
  });
});

describe('/api/twin/simulations', () => {
  it('GET returns middleware error when blocked', async () => {
    mockedRunMiddleware.mockReturnValueOnce(
      NextResponse.json({ error: 'blocked' }, { status: 403 }),
    );
    const res = await getSimulations(new NextRequest('http://localhost:3000/api/twin/simulations'));
    expect(res.status).toBe(403);
  });

  it('POST returns middleware error when blocked', async () => {
    mockedRunMiddleware.mockReturnValueOnce(
      NextResponse.json({ error: 'blocked' }, { status: 403 }),
    );
    const res = await createSimulation(
      new NextRequest('http://localhost:3000/api/twin/simulations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario: 'Test', description: 'test' }),
      }),
    );
    expect(res.status).toBe(403);
  });

  it('GET returns simulations list', async () => {
    const res = await getSimulations(new NextRequest('http://localhost:3000/api/twin/simulations'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.data[0].id).toMatch(/^sim-/);
    expect(body.data[0].scenario).toBeDefined();
    expect(body.data[0].trajectoryData).toBeDefined();
  });

  it('POST creates a new simulation', async () => {
    const res = await createSimulation(
      new NextRequest('http://localhost:3000/api/twin/simulations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenario: 'Increase Water Intake',
          description: 'Simulate increasing water intake to 3L per day.',
          parameters: [{ id: 'param-1', value: 3000 }],
        }),
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.scenario).toBe('Increase Water Intake');
    expect(body.data.status).toBe('simulating');
    expect(body.data.attestation).toBeDefined();
    expect(body.data.txHash).toBeDefined();
  });

  it('POST creates simulation without parameters (defaults to empty array)', async () => {
    const res = await createSimulation(
      new NextRequest('http://localhost:3000/api/twin/simulations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenario: 'No Parameters Test',
          description: 'Simulation without custom parameters.',
        }),
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.scenario).toBe('No Parameters Test');
    expect(body.data.parameters).toEqual([]);
  });

  it('POST returns 400 for missing scenario', async () => {
    const res = await createSimulation(
      new NextRequest('http://localhost:3000/api/twin/simulations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: 'Missing scenario field' }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it('POST returns 400 for missing description', async () => {
    const res = await createSimulation(
      new NextRequest('http://localhost:3000/api/twin/simulations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario: 'Test' }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it('POST returns 400 for invalid JSON body', async () => {
    const res = await createSimulation(
      new NextRequest('http://localhost:3000/api/twin/simulations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not-json',
      }),
    );
    expect(res.status).toBe(400);
  });
});
