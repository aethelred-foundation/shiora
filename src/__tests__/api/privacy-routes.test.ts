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
import { POST as postAccessRequest } from '@/app/api/privacy/access-request/route';
import { POST as postErasure } from '@/app/api/privacy/erasure/route';
import { POST as postPortability } from '@/app/api/privacy/portability/route';

const mockedRunMiddleware = runMiddleware as jest.MockedFunction<typeof runMiddleware>;

afterEach(() => {
  mockedRunMiddleware.mockImplementation((...args: unknown[]) => {
    const actual = jest.requireActual('@/lib/api/middleware');
    return actual.runMiddleware(...args);
  });
});

function createRequest(url: string, init?: RequestInit): NextRequest {
  return new NextRequest(url, init);
}

describe('/api/privacy/access-request', () => {
  it('POST returns middleware error when blocked', async () => {
    mockedRunMiddleware.mockReturnValueOnce(
      NextResponse.json({ error: 'blocked' }, { status: 403 }),
    );
    const res = await postAccessRequest(
      createRequest('http://localhost:3000/api/privacy/access-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categories: ['vitals'] }),
      }),
    );
    expect(res.status).toBe(403);
  });

  it('POST submits an access request with valid categories', async () => {
    const res = await postAccessRequest(
      createRequest('http://localhost:3000/api/privacy/access-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categories: ['vitals', 'lab_results'] }),
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.type).toBe('access');
    expect(body.data.status).toBe('pending');
    expect(body.data.dataCategories).toEqual(['vitals', 'lab_results']);
    expect(body.data.id).toMatch(/^priv-/);
  });

  it('POST returns 400 for missing categories', async () => {
    const res = await postAccessRequest(
      createRequest('http://localhost:3000/api/privacy/access-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it('POST returns 400 for empty categories array', async () => {
    const res = await postAccessRequest(
      createRequest('http://localhost:3000/api/privacy/access-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categories: [] }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it('POST returns 500 for invalid JSON body', async () => {
    const res = await postAccessRequest(
      createRequest('http://localhost:3000/api/privacy/access-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not-json',
      }),
    );
    expect(res.status).toBe(500);
  });
});

describe('/api/privacy/erasure', () => {
  it('POST returns middleware error when blocked', async () => {
    mockedRunMiddleware.mockReturnValueOnce(
      NextResponse.json({ error: 'blocked' }, { status: 403 }),
    );
    const res = await postErasure(
      createRequest('http://localhost:3000/api/privacy/erasure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categories: ['vitals'] }),
      }),
    );
    expect(res.status).toBe(403);
  });

  it('POST submits an erasure request', async () => {
    const res = await postErasure(
      createRequest('http://localhost:3000/api/privacy/erasure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categories: ['vitals'] }),
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.type).toBe('erasure');
    expect(body.data.status).toBe('pending');
  });

  it('POST returns 400 for missing categories', async () => {
    const res = await postErasure(
      createRequest('http://localhost:3000/api/privacy/erasure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it('POST returns 500 for invalid JSON body', async () => {
    const res = await postErasure(
      createRequest('http://localhost:3000/api/privacy/erasure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not-json',
      }),
    );
    expect(res.status).toBe(500);
  });
});

describe('/api/privacy/portability', () => {
  it('POST returns middleware error when blocked', async () => {
    mockedRunMiddleware.mockReturnValueOnce(
      NextResponse.json({ error: 'blocked' }, { status: 403 }),
    );
    const res = await postPortability(
      createRequest('http://localhost:3000/api/privacy/portability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categories: ['vitals'], format: 'json' }),
      }),
    );
    expect(res.status).toBe(403);
  });

  it('POST submits a portability request', async () => {
    const res = await postPortability(
      createRequest('http://localhost:3000/api/privacy/portability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categories: ['vitals', 'imaging'], format: 'json' }),
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.type).toBe('portability');
    expect(body.data.status).toBe('pending');
  });

  it('POST defaults to json format when not specified', async () => {
    const res = await postPortability(
      createRequest('http://localhost:3000/api/privacy/portability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categories: ['vitals'] }),
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.details).toContain('json');
  });

  it('POST returns 400 for invalid format', async () => {
    const res = await postPortability(
      createRequest('http://localhost:3000/api/privacy/portability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categories: ['vitals'], format: 'yaml' }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it('POST returns 400 for missing categories', async () => {
    const res = await postPortability(
      createRequest('http://localhost:3000/api/privacy/portability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format: 'json' }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it('POST returns 500 for invalid JSON body', async () => {
    const res = await postPortability(
      createRequest('http://localhost:3000/api/privacy/portability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not-json',
      }),
    );
    expect(res.status).toBe(500);
  });
});
