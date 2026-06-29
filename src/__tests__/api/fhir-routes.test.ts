/** @jest-environment node */

jest.mock('@/lib/api/middleware', () => {
  const actual = jest.requireActual('@/lib/api/middleware');
  return { ...actual, runMiddleware: jest.fn((...args: unknown[]) => actual.runMiddleware(...args)) };
});

import { NextRequest, NextResponse } from 'next/server';
import { runMiddleware } from '@/lib/api/middleware';
import { GET as capability } from '@/app/api/fhir/route';
import { GET as mapping } from '@/app/api/fhir/mapping/route';
import { POST as importFhir } from '@/app/api/fhir/import/route';
import { GET as exportFhir } from '@/app/api/fhir/export/route';
import { __resetRecordsForTests } from '@/lib/api/records-service';
import { __resetAuditLogForTests } from '@/lib/api/audit-log';
import { createSessionToken } from '@/lib/api/session';
import { seededAddress } from '@/lib/utils';

const mockedRunMiddleware = runMiddleware as jest.MockedFunction<typeof runMiddleware>;
const USER = seededAddress(820);
const token = createSessionToken(USER).token;
const URL = 'http://localhost:3000/api/fhir';

function req(method: string, body?: unknown, withToken = false): NextRequest {
  const headers: Record<string, string> = {};
  if (withToken) headers.authorization = `Bearer ${token}`;
  const init: { method: string; headers: Record<string, string>; body?: string } = { method, headers };
  if (body !== undefined) {
    headers['content-type'] = 'application/json';
    init.body = typeof body === 'string' ? body : JSON.stringify(body);
  }
  return new NextRequest(URL, init);
}

const SAMPLE_BUNDLE = {
  resourceType: 'Bundle',
  type: 'collection',
  entry: [
    { resource: { resourceType: 'Observation', code: { text: 'Glucose' }, valueQuantity: { value: 90, unit: 'mg/dL' } } },
  ],
};

beforeEach(() => {
  __resetRecordsForTests();
  __resetAuditLogForTests();
});

afterEach(() => {
  mockedRunMiddleware.mockImplementation((...args: unknown[]) => {
    const actual = jest.requireActual('@/lib/api/middleware');
    return actual.runMiddleware(...args);
  });
});

describe('GET /api/fhir (capability)', () => {
  it('returns the middleware error when blocked', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(NextResponse.json({ error: 'blocked' }, { status: 403 }));
    expect((await capability(req('GET'))).status).toBe(403);
  });

  it('returns the FHIR capability summary', async () => {
    const res = await capability(req('GET'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.fhirVersion).toBe('4.0.1');
    expect(body.data.supportedResources).toContain('Observation');
  });
});

describe('GET /api/fhir/mapping', () => {
  it('returns the middleware error when blocked', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(NextResponse.json({ error: 'blocked' }, { status: 403 }));
    expect((await mapping(req('GET'))).status).toBe(403);
  });

  it('returns the resource mapping table', async () => {
    const res = await mapping(req('GET'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.data.mappings)).toBe(true);
    expect(body.data.mappings[0]).toHaveProperty('resourceType');
  });
});

describe('POST /api/fhir/import', () => {
  it('requires authentication', async () => {
    expect((await importFhir(req('POST', SAMPLE_BUNDLE))).status).toBe(401);
  });

  it('imports a FHIR Bundle into encrypted records', async () => {
    const res = await importFhir(req('POST', SAMPLE_BUNDLE, true));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.imported).toBe(1);
    expect(body.data.recordIds).toHaveLength(1);
  });

  it('returns 422 for a non-Bundle payload', async () => {
    const res = await importFhir(req('POST', { resourceType: 'Patient' }, true));
    expect(res.status).toBe(422);
    expect((await res.json()).error.code).toBe('FHIR_PARSE_ERROR');
  });

  it('rethrows on a non-JSON body', async () => {
    await expect(importFhir(req('POST', 'not-json', true))).rejects.toThrow();
  });
});

describe('GET /api/fhir/export', () => {
  it('requires authentication', async () => {
    expect((await exportFhir(req('GET'))).status).toBe(401);
  });

  it('exports the caller records as a FHIR Bundle', async () => {
    await importFhir(req('POST', SAMPLE_BUNDLE, true));
    const res = await exportFhir(req('GET', undefined, true));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.resourceType).toBe('Bundle');
    expect(body.data.entry).toHaveLength(1);
    expect(body.data.entry[0].resource.code.text).toBe('Glucose');
  });
});
