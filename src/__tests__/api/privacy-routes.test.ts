/** @jest-environment node */

jest.mock('@/lib/api/middleware', () => {
  const actual = jest.requireActual('@/lib/api/middleware');
  return { ...actual, runMiddleware: jest.fn((...args: unknown[]) => actual.runMiddleware(...args)) };
});

import { NextRequest, NextResponse } from 'next/server';
import { runMiddleware } from '@/lib/api/middleware';
import { POST as accessRequest } from '@/app/api/privacy/access-request/route';
import { POST as portability } from '@/app/api/privacy/portability/route';
import { POST as erasure } from '@/app/api/privacy/erasure/route';
import { __resetRecordsForTests } from '@/lib/api/records-service';
import { __resetConsentForTests } from '@/lib/api/consent-service';
import { __resetAccessForTests } from '@/lib/api/access-service';
import { createSessionToken } from '@/lib/api/session';
import { seededAddress } from '@/lib/utils';

const mockedRunMiddleware = runMiddleware as jest.MockedFunction<typeof runMiddleware>;
const token = createSessionToken(seededAddress(400)).token;

beforeEach(() => {
  __resetRecordsForTests();
  __resetConsentForTests();
  __resetAccessForTests();
});

afterEach(() => {
  mockedRunMiddleware.mockImplementation((...args: unknown[]) => {
    const actual = jest.requireActual('@/lib/api/middleware');
    return actual.runMiddleware(...args);
  });
});

function post(url: string, body: unknown, authToken?: string): NextRequest {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authToken) headers.authorization = `Bearer ${authToken}`;
  return new NextRequest(url, {
    method: 'POST',
    headers,
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

describe.each([
  ['access-request', accessRequest, 'http://localhost:3000/api/privacy/access-request'],
  ['portability', portability, 'http://localhost:3000/api/privacy/portability'],
  ['erasure', erasure, 'http://localhost:3000/api/privacy/erasure'],
] as const)('/api/privacy/%s', (name, handler, url) => {
  it('returns the middleware error when blocked', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(NextResponse.json({ error: 'blocked' }, { status: 403 }));
    expect((await handler(post(url, { categories: ['records'] }, token))).status).toBe(403);
  });

  it('returns 401 when unauthenticated', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(null);
    expect((await handler(post(url, { categories: ['records'] }))).status).toBe(401);
  });

  it('returns 400 when categories is missing or empty', async () => {
    expect((await handler(post(url, { categories: [] }, token))).status).toBe(400);
  });

  it('returns 201 for an authenticated data subject', async () => {
    const res = await handler(post(url, { categories: ['records', 'consents'] }, token));
    expect(res.status).toBe(201);
    expect((await res.json()).data.request.status).toBe('completed');
  });

  it('returns 500 on an invalid JSON body', async () => {
    expect((await handler(post(url, 'not-json', token))).status).toBe(500);
  });
});

describe('/api/privacy/portability format validation', () => {
  it('returns 400 for an unsupported export format', async () => {
    const res = await portability(
      post('http://localhost:3000/api/privacy/portability', { categories: ['records'], format: 'pdf' }, token),
    );
    expect(res.status).toBe(400);
  });

  it('actually serializes the export as CSV when requested', async () => {
    const res = await portability(
      post('http://localhost:3000/api/privacy/portability', { categories: ['records'], format: 'csv' }, token),
    );
    expect(res.status).toBe(201);
    const data = (await res.json()).data;
    expect(data.format).toBe('csv');
    expect(typeof data.export).toBe('string');
    expect(data.export).toContain('# records'); // real CSV, not the JSON bundle
  });

  it('actually serializes the export as XML when requested', async () => {
    const res = await portability(
      post('http://localhost:3000/api/privacy/portability', { categories: ['records'], format: 'xml' }, token),
    );
    expect(res.status).toBe(201);
    const data = (await res.json()).data;
    expect(data.format).toBe('xml');
    expect(data.export).toContain('<userData>');
  });

  it('defaults to a JSON export string', async () => {
    const res = await portability(
      post('http://localhost:3000/api/privacy/portability', { categories: ['records'] }, token),
    );
    expect(res.status).toBe(201);
    const data = (await res.json()).data;
    expect(data.format).toBe('json');
    expect(data.export).toContain('"records"');
  });
});
