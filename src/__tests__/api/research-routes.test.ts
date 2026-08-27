/** @jest-environment node */

jest.mock('@/lib/api/middleware', () => {
  const actual = jest.requireActual('@/lib/api/middleware');
  return { ...actual, runMiddleware: jest.fn((...args: unknown[]) => actual.runMiddleware(...args)) };
});

import { NextRequest, NextResponse } from 'next/server';
import { runMiddleware } from '@/lib/api/middleware';
import { GET as getStudies, POST as enrollStudy } from '@/app/api/research/studies/route';

const mockedRunMiddleware = runMiddleware as jest.MockedFunction<typeof runMiddleware>;

afterEach(() => {
  mockedRunMiddleware.mockImplementation((...args: unknown[]) => {
    const actual = jest.requireActual('@/lib/api/middleware');
    return actual.runMiddleware(...args);
  });
});

function blockedOnce(): void {
  mockedRunMiddleware.mockResolvedValueOnce(NextResponse.json({ error: 'blocked' }, { status: 429 }));
}

describe('middleware guards', () => {
  it('GET /research/studies returns the middleware error when blocked', async () => {
    blockedOnce();
    expect((await getStudies(new NextRequest('http://localhost:3000/api/research/studies'))).status).toBe(429);
  });

  it('POST /research/studies returns the middleware error when blocked', async () => {
    blockedOnce();
    expect((await enrollStudy(new NextRequest('http://localhost:3000/api/research/studies', { method: 'POST' }))).status).toBe(429);
  });
});

describe('/api/research/studies', () => {
  it('GET returns research studies', async () => {
    const res = await getStudies(new NextRequest('http://localhost:3000/api/research/studies'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.data[0].title).toBeDefined();
    expect(body.data[0].institution).toBeDefined();
  });

  it('GET filters by status', async () => {
    const res = await getStudies(
      new NextRequest('http://localhost:3000/api/research/studies?status=recruiting'),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    body.data.forEach((s: { status: string }) => {
      expect(s.status).toBe('recruiting');
    });
  });

  it('GET filters by search', async () => {
    const res = await getStudies(
      new NextRequest('http://localhost:3000/api/research/studies?search=fertility'),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('GET returns contributions when include=contributions', async () => {
    const res = await getStudies(
      new NextRequest('http://localhost:3000/api/research/studies?include=contributions'),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('POST enrolls in a study', async () => {
    // Get a valid study ID
    const listRes = await getStudies(new NextRequest('http://localhost:3000/api/research/studies'));
    const listBody = await listRes.json();
    const studyId = listBody.data[0]?.id;
    expect(studyId).toBeDefined();

    const res = await enrollStudy(
      new NextRequest('http://localhost:3000/api/research/studies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studyId, dataTypes: ['vitals', 'lab_result'] }),
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.studyId).toBe(studyId);
    expect(body.data.status).toBe('pending');
  });

  it('POST returns 400 for missing fields', async () => {
    const res = await enrollStudy(
      new NextRequest('http://localhost:3000/api/research/studies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }),
    );
    expect(res.status).toBe(400);
  });

  it('POST returns 404 for nonexistent study', async () => {
    const res = await enrollStudy(
      new NextRequest('http://localhost:3000/api/research/studies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studyId: 'study-nonexistent', dataTypes: ['vitals'] }),
      }),
    );
    expect(res.status).toBe(404);
  });

  it('POST returns 500 for invalid JSON body', async () => {
    const res = await enrollStudy(
      new NextRequest('http://localhost:3000/api/research/studies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not-json',
      }),
    );
    expect(res.status).toBe(500);
  });
});
