/** @jest-environment node */

import { NextRequest, NextResponse } from 'next/server';

const mockRunMiddleware = jest.fn().mockReturnValue(null);
jest.mock('@/lib/api/middleware', () => ({
  ...jest.requireActual('@/lib/api/middleware'),
  runMiddleware: (...args: unknown[]) => mockRunMiddleware(...args),
}));

const actualMockData = jest.requireActual('@/lib/api/mock-data');
const mockGenerateMockAnomalies = jest.fn(actualMockData.generateMockAnomalies);
const mockGenerateMockInferences = jest.fn(actualMockData.generateMockInferences);
jest.mock('@/lib/api/mock-data', () => ({
  ...jest.requireActual('@/lib/api/mock-data'),
  generateMockAnomalies: (...args: unknown[]) => mockGenerateMockAnomalies(...args),
  generateMockInferences: (...args: unknown[]) => mockGenerateMockInferences(...args),
}));

import { GET as getInsights } from '@/app/api/insights/route';
import { GET as getAnomalies } from '@/app/api/insights/anomalies/route';
import { GET as getInferences } from '@/app/api/insights/inferences/route';

afterEach(() => {
  mockRunMiddleware.mockReturnValue(null);
  mockGenerateMockAnomalies.mockImplementation(actualMockData.generateMockAnomalies);
  mockGenerateMockInferences.mockImplementation(actualMockData.generateMockInferences);
});

describe('/api/insights', () => {
  it('GET returns insights overview', async () => {
    const req = new NextRequest('http://localhost:3000/api/insights');
    const res = await getInsights(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    expect(body.meta?.teeVerified).toBe(true);
  });

  it('GET returns blocked response when middleware blocks', async () => {
    mockRunMiddleware.mockReturnValueOnce(
      NextResponse.json({ error: 'blocked' }, { status: 429 }),
    );
    const req = new NextRequest('http://localhost:3000/api/insights');
    const res = await getInsights(req);
    expect(res.status).toBe(429);
  });
});

describe('/api/insights/anomalies', () => {
  it('GET returns anomaly list', async () => {
    const req = new NextRequest('http://localhost:3000/api/insights/anomalies');
    const res = await getAnomalies(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
  });

  it('GET returns anomalies with severity filter', async () => {
    const req = new NextRequest('http://localhost:3000/api/insights/anomalies?severity=High');
    const res = await getAnomalies(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('GET returns anomalies with resolved filter', async () => {
    const req = new NextRequest('http://localhost:3000/api/insights/anomalies?resolved=true');
    const res = await getAnomalies(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('GET returns anomalies with resolved=false filter', async () => {
    const req = new NextRequest('http://localhost:3000/api/insights/anomalies?resolved=false');
    const res = await getAnomalies(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('GET returns anomalies with pagination', async () => {
    const req = new NextRequest('http://localhost:3000/api/insights/anomalies?page=1&limit=2');
    const res = await getAnomalies(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.pagination).toBeDefined();
  });

  it('GET returns 422 for invalid query params', async () => {
    const req = new NextRequest('http://localhost:3000/api/insights/anomalies?page=abc');
    const res = await getAnomalies(req);
    expect(res.status).toBe(422);
  });

  it('GET returns blocked response when middleware blocks', async () => {
    mockRunMiddleware.mockReturnValueOnce(
      NextResponse.json({ error: 'blocked' }, { status: 429 }),
    );
    const req = new NextRequest('http://localhost:3000/api/insights/anomalies');
    const res = await getAnomalies(req);
    expect(res.status).toBe(429);
  });

  it('GET rethrows non-ZodError exceptions', async () => {
    mockGenerateMockAnomalies.mockImplementationOnce(() => {
      throw new Error('unexpected error');
    });
    await expect(
      getAnomalies(new NextRequest('http://localhost:3000/api/insights/anomalies')),
    ).rejects.toThrow('unexpected error');
  });
});

describe('/api/insights/inferences', () => {
  it('GET returns inference list', async () => {
    const req = new NextRequest('http://localhost:3000/api/insights/inferences');
    const res = await getInferences(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
  });

  it('GET returns inferences with category filter', async () => {
    const req = new NextRequest('http://localhost:3000/api/insights/inferences?category=vitals');
    const res = await getInferences(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('GET returns inferences with model filter', async () => {
    const req = new NextRequest('http://localhost:3000/api/insights/inferences?model=lstm');
    const res = await getInferences(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('GET returns 422 for invalid query params', async () => {
    const req = new NextRequest('http://localhost:3000/api/insights/inferences?page=abc');
    const res = await getInferences(req);
    expect(res.status).toBe(422);
  });

  it('GET returns blocked response when middleware blocks', async () => {
    mockRunMiddleware.mockReturnValueOnce(
      NextResponse.json({ error: 'blocked' }, { status: 429 }),
    );
    const req = new NextRequest('http://localhost:3000/api/insights/inferences');
    const res = await getInferences(req);
    expect(res.status).toBe(429);
  });

  it('GET rethrows non-ZodError exceptions', async () => {
    mockGenerateMockInferences.mockImplementationOnce(() => {
      throw new Error('unexpected error');
    });
    await expect(
      getInferences(new NextRequest('http://localhost:3000/api/insights/inferences')),
    ).rejects.toThrow('unexpected error');
  });
});
