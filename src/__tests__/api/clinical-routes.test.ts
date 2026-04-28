/** @jest-environment node */

import { NextRequest, NextResponse } from 'next/server';

// We need to mock runMiddleware to test the blocked branch.
// The module uses non-configurable exports, so we use jest.mock.
const mockRunMiddleware = jest.fn().mockReturnValue(null);
jest.mock('@/lib/api/middleware', () => ({
  ...jest.requireActual('@/lib/api/middleware'),
  runMiddleware: (...args: unknown[]) => mockRunMiddleware(...args),
}));

import { GET as getClinical } from '@/app/api/clinical/route';
import { GET as getDifferentials } from '@/app/api/clinical/differentials/route';
import { GET as getInteractions } from '@/app/api/clinical/interactions/route';
import { GET as getPathways } from '@/app/api/clinical/pathways/route';
import { GET as getAudit } from '@/app/api/clinical/audit/route';

afterEach(() => {
  mockRunMiddleware.mockReturnValue(null);
});

describe('/api/clinical', () => {
  it('GET returns clinical stats (default view)', async () => {
    const res = await getClinical(new NextRequest('http://localhost:3000/api/clinical'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.totalDecisions).toBeDefined();
    expect(body.data.activePathways).toBeDefined();
  });

  it('GET returns alerts view', async () => {
    const res = await getClinical(
      new NextRequest('http://localhost:3000/api/clinical?view=alerts'),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.data[0].type).toBeDefined();
    expect(body.data[0].severity).toBeDefined();
    expect(body.data[0].recommendation).toBeDefined();
  });

  it('GET returns 400 for invalid view', async () => {
    const res = await getClinical(
      new NextRequest('http://localhost:3000/api/clinical?view=invalid'),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it('GET returns blocked response when middleware blocks', async () => {
    mockRunMiddleware.mockReturnValueOnce(NextResponse.json({ error: 'blocked' }, { status: 429 }));
    const res = await getClinical(new NextRequest('http://localhost:3000/api/clinical'));
    expect(res.status).toBe(429);
  });
});

describe('/api/clinical/differentials', () => {
  it('GET returns differentials', async () => {
    const res = await getDifferentials(
      new NextRequest('http://localhost:3000/api/clinical/differentials'),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('GET returns blocked response when middleware blocks', async () => {
    mockRunMiddleware.mockReturnValueOnce(NextResponse.json({ error: 'blocked' }, { status: 429 }));
    const res = await getDifferentials(
      new NextRequest('http://localhost:3000/api/clinical/differentials'),
    );
    expect(res.status).toBe(429);
  });
});

describe('/api/clinical/interactions', () => {
  it('GET returns drug interactions', async () => {
    const res = await getInteractions(
      new NextRequest('http://localhost:3000/api/clinical/interactions'),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('GET returns blocked response when middleware blocks', async () => {
    mockRunMiddleware.mockReturnValueOnce(NextResponse.json({ error: 'blocked' }, { status: 429 }));
    const res = await getInteractions(
      new NextRequest('http://localhost:3000/api/clinical/interactions'),
    );
    expect(res.status).toBe(429);
  });
});

describe('/api/clinical/pathways', () => {
  it('GET returns clinical pathways', async () => {
    const res = await getPathways(new NextRequest('http://localhost:3000/api/clinical/pathways'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('GET returns blocked response when middleware blocks', async () => {
    mockRunMiddleware.mockReturnValueOnce(NextResponse.json({ error: 'blocked' }, { status: 429 }));
    const res = await getPathways(new NextRequest('http://localhost:3000/api/clinical/pathways'));
    expect(res.status).toBe(429);
  });
});

describe('/api/clinical/audit', () => {
  it('GET returns clinical audit log', async () => {
    const res = await getAudit(new NextRequest('http://localhost:3000/api/clinical/audit'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('GET returns blocked response when middleware blocks', async () => {
    mockRunMiddleware.mockReturnValueOnce(NextResponse.json({ error: 'blocked' }, { status: 429 }));
    const res = await getAudit(new NextRequest('http://localhost:3000/api/clinical/audit'));
    expect(res.status).toBe(429);
  });
});
