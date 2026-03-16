/** @jest-environment node */

jest.mock('@/lib/api/middleware', () => {
  const actual = jest.requireActual('@/lib/api/middleware');
  return { ...actual, runMiddleware: jest.fn((...args: unknown[]) => actual.runMiddleware(...args)) };
});

import { NextRequest, NextResponse } from 'next/server';
import { runMiddleware } from '@/lib/api/middleware';
import { GET as getClaims, POST as createClaim } from '@/app/api/zkp/claims/route';
import { POST as prove } from '@/app/api/zkp/prove/route';
import { POST as verify } from '@/app/api/zkp/verify/route';

const mockedRunMiddleware = runMiddleware as jest.MockedFunction<typeof runMiddleware>;

afterEach(() => {
  mockedRunMiddleware.mockImplementation((...args: unknown[]) => {
    const actual = jest.requireActual('@/lib/api/middleware');
    return actual.runMiddleware(...args);
  });
});

describe('/api/zkp/claims', () => {
  it('GET returns middleware error when blocked', async () => {
    mockedRunMiddleware.mockReturnValueOnce(NextResponse.json({ error: 'blocked' }, { status: 403 }));
    const res = await getClaims(new NextRequest('http://localhost:3000/api/zkp/claims'));
    expect(res.status).toBe(403);
  });

  it('POST returns middleware error when blocked', async () => {
    mockedRunMiddleware.mockReturnValueOnce(NextResponse.json({ error: 'blocked' }, { status: 403 }));
    const res = await createClaim(
      new NextRequest('http://localhost:3000/api/zkp/claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claimType: 'age_range' }),
      }),
    );
    expect(res.status).toBe(403);
  });

  it('GET returns ZKP claims', async () => {
    const res = await getClaims(new NextRequest('http://localhost:3000/api/zkp/claims'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.data[0].id).toMatch(/^claim-/);
    expect(body.data[0].claimType).toBeDefined();
    expect(body.meta.total).toBeDefined();
  });

  it('POST creates a new claim', async () => {
    const res = await createClaim(
      new NextRequest('http://localhost:3000/api/zkp/claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claimType: 'age_range' }),
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.claimType).toBe('age_range');
    expect(body.data.status).toBe('unproven');
  });

  it('POST returns 400 for missing claimType', async () => {
    const res = await createClaim(
      new NextRequest('http://localhost:3000/api/zkp/claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }),
    );
    expect(res.status).toBe(400);
  });

  it('POST returns 400 for invalid claimType', async () => {
    const res = await createClaim(
      new NextRequest('http://localhost:3000/api/zkp/claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claimType: 'invalid_type' }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it('POST returns 400 for invalid JSON body', async () => {
    const res = await createClaim(
      new NextRequest('http://localhost:3000/api/zkp/claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not-json',
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_BODY');
  });
});

describe('/api/zkp/prove', () => {
  it('POST returns middleware error when blocked', async () => {
    mockedRunMiddleware.mockReturnValueOnce(NextResponse.json({ error: 'blocked' }, { status: 403 }));
    const req = new NextRequest('http://localhost:3000/api/zkp/prove', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ claimId: 'test' }),
    });
    const res = await prove(req);
    expect(res.status).toBe(403);
  });

  it('POST generates a proof', async () => {
    const req = new NextRequest('http://localhost:3000/api/zkp/prove', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ claimId: 'claim-0000', claimType: 'age_range', data: { age: 25 } }),
    });
    const res = await prove(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.claimType).toBe('age_range');
  });

  it('POST generates a proof without claimType (defaults to age_range)', async () => {
    const req = new NextRequest('http://localhost:3000/api/zkp/prove', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ claimId: 'claim-0001', data: { age: 30 } }),
    });
    const res = await prove(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.claimType).toBe('age_range');
  });

  it('POST returns 400 for missing claimId', async () => {
    const req = new NextRequest('http://localhost:3000/api/zkp/prove', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ claimType: 'age_range' }),
    });
    const res = await prove(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('POST returns 400 for invalid JSON', async () => {
    const req = new NextRequest('http://localhost:3000/api/zkp/prove', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    });
    const res = await prove(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_BODY');
  });
});

describe('/api/zkp/verify', () => {
  it('POST returns middleware error when blocked', async () => {
    mockedRunMiddleware.mockReturnValueOnce(NextResponse.json({ error: 'blocked' }, { status: 403 }));
    const req = new NextRequest('http://localhost:3000/api/zkp/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ proofId: 'test' }),
    });
    const res = await verify(req);
    expect(res.status).toBe(403);
  });

  it('POST verifies a proof', async () => {
    const req = new NextRequest('http://localhost:3000/api/zkp/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ proofId: 'proof-123', verifierKey: 'vk-456' }),
    });
    const res = await verify(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.valid).toBe(true);
  });

  it('POST returns 400 for missing proofId', async () => {
    const req = new NextRequest('http://localhost:3000/api/zkp/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const res = await verify(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('POST returns 400 for invalid JSON', async () => {
    const req = new NextRequest('http://localhost:3000/api/zkp/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    });
    const res = await verify(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_BODY');
  });
});
