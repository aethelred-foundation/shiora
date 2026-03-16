/** @jest-environment node */

import { NextRequest, NextResponse } from 'next/server';

const mockRunMiddleware = jest.fn().mockReturnValue(null);
jest.mock('@/lib/api/middleware', () => ({
  ...jest.requireActual('@/lib/api/middleware'),
  runMiddleware: (...args: unknown[]) => mockRunMiddleware(...args),
}));

const actualResponses = jest.requireActual('@/lib/api/responses');
const mockSuccessResponse = jest.fn(actualResponses.successResponse);
const mockPaginatedResponse = jest.fn(actualResponses.paginatedResponse);
jest.mock('@/lib/api/responses', () => ({
  ...jest.requireActual('@/lib/api/responses'),
  successResponse: (...args: unknown[]) => mockSuccessResponse(...args),
  paginatedResponse: (...args: unknown[]) => mockPaginatedResponse(...args),
}));

import { GET as getCompliance } from '@/app/api/compliance/route';
import { GET as getChecks } from '@/app/api/compliance/checks/route';
import { GET as getReports, POST as postReport } from '@/app/api/compliance/reports/route';
import { GET as getAudit } from '@/app/api/compliance/audit/route';

afterEach(() => {
  mockRunMiddleware.mockReturnValue(null);
  mockSuccessResponse.mockImplementation(actualResponses.successResponse);
  mockPaginatedResponse.mockImplementation(actualResponses.paginatedResponse);
});

describe('/api/compliance', () => {
  it('GET returns compliance overview (default view)', async () => {
    const res = await getCompliance(new NextRequest('http://localhost:3000/api/compliance'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.overallComplianceScore).toBeDefined();
    expect(body.data.frameworks).toBeDefined();
    expect(Array.isArray(body.data.frameworks)).toBe(true);
  });

  it('GET returns frameworks view', async () => {
    const res = await getCompliance(
      new NextRequest('http://localhost:3000/api/compliance?view=frameworks'),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.data[0].id).toBeDefined();
    expect(body.data[0].totalControls).toBeDefined();
  });

  it('GET returns violations view', async () => {
    const res = await getCompliance(
      new NextRequest('http://localhost:3000/api/compliance?view=violations'),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data[0].severity).toBeDefined();
    expect(body.data[0].title).toBeDefined();
  });

  it('GET returns 400 for invalid view', async () => {
    const res = await getCompliance(
      new NextRequest('http://localhost:3000/api/compliance?view=invalid'),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it('GET returns blocked response when middleware blocks', async () => {
    mockRunMiddleware.mockReturnValueOnce(
      NextResponse.json({ error: 'blocked' }, { status: 429 }),
    );
    const res = await getCompliance(new NextRequest('http://localhost:3000/api/compliance'));
    expect(res.status).toBe(429);
  });

  it('GET returns 500 when try block throws', async () => {
    mockSuccessResponse.mockImplementationOnce(() => { throw new Error('boom'); });
    const res = await getCompliance(new NextRequest('http://localhost:3000/api/compliance'));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe('INTERNAL_ERROR');
  });
});

describe('/api/compliance/checks', () => {
  it('GET returns compliance checks for hipaa', async () => {
    const res = await getChecks(
      new NextRequest('http://localhost:3000/api/compliance/checks?framework=hipaa'),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('GET returns 400 when framework is missing', async () => {
    const res = await getChecks(
      new NextRequest('http://localhost:3000/api/compliance/checks'),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_FRAMEWORK');
  });

  it('GET returns 400 when framework is invalid', async () => {
    const res = await getChecks(
      new NextRequest('http://localhost:3000/api/compliance/checks?framework=invalid'),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_FRAMEWORK');
  });

  it('GET returns blocked response when middleware blocks', async () => {
    mockRunMiddleware.mockReturnValueOnce(
      NextResponse.json({ error: 'blocked' }, { status: 429 }),
    );
    const res = await getChecks(
      new NextRequest('http://localhost:3000/api/compliance/checks?framework=hipaa'),
    );
    expect(res.status).toBe(429);
  });

  it('GET returns 500 when try block throws', async () => {
    mockSuccessResponse.mockImplementationOnce(() => { throw new Error('boom'); });
    const res = await getChecks(
      new NextRequest('http://localhost:3000/api/compliance/checks?framework=hipaa'),
    );
    expect(res.status).toBe(500);
  });
});

describe('/api/compliance/reports', () => {
  it('GET returns compliance reports', async () => {
    const res = await getReports(
      new NextRequest('http://localhost:3000/api/compliance/reports'),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('POST creates a new compliance report with frameworkId', async () => {
    const res = await postReport(
      new NextRequest('http://localhost:3000/api/compliance/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          frameworkId: 'gdpr',
          period: { start: Date.now() - 90 * 86400000, end: Date.now() },
        }),
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.frameworkId).toBe('gdpr');
    expect(body.data.status).toBe('draft');
  });

  it('POST creates a report with defaults', async () => {
    const res = await postReport(
      new NextRequest('http://localhost:3000/api/compliance/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.frameworkId).toBe('hipaa');
  });

  it('POST returns error for invalid JSON', async () => {
    const res = await postReport(
      new NextRequest('http://localhost:3000/api/compliance/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not-json',
      }),
    );
    expect(res.status).toBe(400);
  });

  it('GET returns blocked response when middleware blocks', async () => {
    mockRunMiddleware.mockReturnValueOnce(
      NextResponse.json({ error: 'blocked' }, { status: 429 }),
    );
    const res = await getReports(
      new NextRequest('http://localhost:3000/api/compliance/reports'),
    );
    expect(res.status).toBe(429);
  });

  it('GET returns 500 when try block throws', async () => {
    mockSuccessResponse.mockImplementationOnce(() => { throw new Error('boom'); });
    const res = await getReports(
      new NextRequest('http://localhost:3000/api/compliance/reports'),
    );
    expect(res.status).toBe(500);
  });

  it('POST returns blocked response when middleware blocks', async () => {
    mockRunMiddleware.mockReturnValueOnce(
      NextResponse.json({ error: 'blocked' }, { status: 429 }),
    );
    const res = await postReport(
      new NextRequest('http://localhost:3000/api/compliance/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ frameworkId: 'hipaa' }),
      }),
    );
    expect(res.status).toBe(429);
  });
});

describe('/api/compliance/audit', () => {
  it('GET returns compliance audit log', async () => {
    const res = await getAudit(
      new NextRequest('http://localhost:3000/api/compliance/audit'),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('GET returns blocked response when middleware blocks', async () => {
    mockRunMiddleware.mockReturnValueOnce(
      NextResponse.json({ error: 'blocked' }, { status: 429 }),
    );
    const res = await getAudit(
      new NextRequest('http://localhost:3000/api/compliance/audit'),
    );
    expect(res.status).toBe(429);
  });

  it('GET returns 500 when try block throws', async () => {
    mockPaginatedResponse.mockImplementationOnce(() => { throw new Error('boom'); });
    const res = await getAudit(
      new NextRequest('http://localhost:3000/api/compliance/audit'),
    );
    expect(res.status).toBe(500);
  });
});
