/** @jest-environment node */

jest.mock('@/lib/api/middleware', () => {
  const actual = jest.requireActual('@/lib/api/middleware');
  return { ...actual, runMiddleware: jest.fn((...args: unknown[]) => actual.runMiddleware(...args)) };
});

import { NextRequest, NextResponse } from 'next/server';
import { runMiddleware } from '@/lib/api/middleware';
import { GET as getShap } from '@/app/api/xai/shap/route';

const mockedRunMiddleware = runMiddleware as jest.MockedFunction<typeof runMiddleware>;
import { GET as getBias } from '@/app/api/xai/bias/route';
import { GET as getModelCards } from '@/app/api/xai/model-cards/route';

afterEach(() => {
  mockedRunMiddleware.mockImplementation((...args: unknown[]) => {
    const actual = jest.requireActual('@/lib/api/middleware');
    return actual.runMiddleware(...args);
  });
});

describe('/api/xai/shap', () => {
  it('GET returns middleware error when blocked', async () => {
    mockedRunMiddleware.mockReturnValueOnce(NextResponse.json({ error: 'blocked' }, { status: 403 }));
    const res = await getShap(new NextRequest('http://localhost:3000/api/xai/shap?inferenceId=test'));
    expect(res.status).toBe(403);
  });

  it('GET returns SHAP values', async () => {
    const res = await getShap(new NextRequest('http://localhost:3000/api/xai/shap?inferenceId=test-001'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.shapValues).toBeDefined();
  });

  it('GET returns 422 when inferenceId is missing', async () => {
    const res = await getShap(new NextRequest('http://localhost:3000/api/xai/shap'));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('/api/xai/bias', () => {
  it('GET returns middleware error when blocked', async () => {
    mockedRunMiddleware.mockReturnValueOnce(NextResponse.json({ error: 'blocked' }, { status: 403 }));
    const res = await getBias(new NextRequest('http://localhost:3000/api/xai/bias?modelId=lstm'));
    expect(res.status).toBe(403);
  });

  it('GET returns bias analysis', async () => {
    const res = await getBias(new NextRequest('http://localhost:3000/api/xai/bias?modelId=lstm'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.modelId).toBe('lstm');
  });

  it('GET returns 422 when modelId is missing', async () => {
    const res = await getBias(new NextRequest('http://localhost:3000/api/xai/bias'));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('GET returns 404 when modelId is unknown', async () => {
    const res = await getBias(new NextRequest('http://localhost:3000/api/xai/bias?modelId=nonexistent'));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_FOUND');
  });
});

describe('/api/xai/model-cards', () => {
  afterEach(() => {
    mockedRunMiddleware.mockImplementation((...args: unknown[]) => {
      const actual = jest.requireActual('@/lib/api/middleware');
      return actual.runMiddleware(...args);
    });
  });

  it('GET returns model cards', async () => {
    const res = await getModelCards(new NextRequest('http://localhost:3000/api/xai/model-cards'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('GET returns middleware error when blocked', async () => {
    mockedRunMiddleware.mockReturnValueOnce(NextResponse.json({ error: 'blocked' }, { status: 403 }));
    const res = await getModelCards(new NextRequest('http://localhost:3000/api/xai/model-cards'));
    expect(res.status).toBe(403);
  });
});
