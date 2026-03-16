/** @jest-environment node */

import { NextRequest, NextResponse } from 'next/server';

const mockRunMiddleware = jest.fn<NextResponse | null, [NextRequest, ...unknown[]]>(() => null);

jest.mock('@/lib/api/middleware', () => ({
  ...jest.requireActual('@/lib/api/middleware'),
  runMiddleware: (...args: unknown[]) => mockRunMiddleware(args[0] as NextRequest, ...args.slice(1)),
}));

import { GET as getFhir } from '@/app/api/fhir/route';
import { POST as importFhir } from '@/app/api/fhir/import/route';
import { POST as exportFhir } from '@/app/api/fhir/export/route';
import { GET as getMapping } from '@/app/api/fhir/mapping/route';

beforeEach(() => {
  mockRunMiddleware.mockReset();
  mockRunMiddleware.mockReturnValue(null);
});

describe('/api/fhir', () => {
  it('GET returns FHIR overview', async () => {
    const res = await getFhir(new NextRequest('http://localhost:3000/api/fhir'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
  });

  it('GET returns blocked response when middleware blocks', async () => {
    mockRunMiddleware.mockReturnValueOnce(
      new NextResponse(JSON.stringify({ error: 'blocked' }), { status: 429 }),
    );
    const res = await getFhir(new NextRequest('http://localhost:3000/api/fhir'));
    expect(res.status).toBe(429);
  });
});

describe('/api/fhir/import', () => {
  it('POST imports FHIR resources', async () => {
    const res = await importFhir(
      new NextRequest('http://localhost:3000/api/fhir/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'Hospital EHR System' }),
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.id).toMatch(/^import-/);
    expect(body.data.source).toBe('Hospital EHR System');
    expect(body.data.status).toBe('processing');
    expect(body.data.attestation).toBeDefined();
  });

  it('POST imports with optional URL', async () => {
    const res = await importFhir(
      new NextRequest('http://localhost:3000/api/fhir/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'Clinic', url: 'https://fhir.example.com/Patient' }),
      }),
    );
    expect(res.status).toBe(201);
  });

  it('POST returns 422 for missing source', async () => {
    const res = await importFhir(
      new NextRequest('http://localhost:3000/api/fhir/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }),
    );
    expect(res.status).toBe(422);
  });

  it('POST returns 422 for invalid URL format', async () => {
    const res = await importFhir(
      new NextRequest('http://localhost:3000/api/fhir/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'test', url: 'not-a-url' }),
      }),
    );
    expect(res.status).toBe(422);
  });

  it('POST re-throws non-ZodError', async () => {
    await expect(
      importFhir(
        new NextRequest('http://localhost:3000/api/fhir/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: 'not-valid-json',
        }),
      ),
    ).rejects.toThrow();
  });

  it('POST returns blocked response when middleware blocks', async () => {
    mockRunMiddleware.mockReturnValueOnce(
      new NextResponse(JSON.stringify({ error: 'blocked' }), { status: 429 }),
    );
    const res = await importFhir(
      new NextRequest('http://localhost:3000/api/fhir/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'test' }),
      }),
    );
    expect(res.status).toBe(429);
  });
});

describe('/api/fhir/export', () => {
  it('POST exports FHIR resources', async () => {
    const res = await exportFhir(
      new NextRequest('http://localhost:3000/api/fhir/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resourceTypes: ['Patient', 'Observation'],
          destination: 'Research Portal',
          format: 'json',
        }),
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.id).toMatch(/^export-/);
    expect(body.data.format).toBe('json');
    expect(body.data.resourceTypes).toEqual(['Patient', 'Observation']);
    expect(body.data.attestation).toBeDefined();
  });

  it('POST returns 422 for missing resourceTypes', async () => {
    const res = await exportFhir(
      new NextRequest('http://localhost:3000/api/fhir/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ destination: 'test' }),
      }),
    );
    expect(res.status).toBe(422);
  });

  it('POST returns 422 for empty resourceTypes', async () => {
    const res = await exportFhir(
      new NextRequest('http://localhost:3000/api/fhir/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resourceTypes: [], destination: 'test' }),
      }),
    );
    expect(res.status).toBe(422);
  });

  it('POST returns 422 for missing destination', async () => {
    const res = await exportFhir(
      new NextRequest('http://localhost:3000/api/fhir/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resourceTypes: ['Patient'] }),
      }),
    );
    expect(res.status).toBe(422);
  });

  it('POST re-throws non-ZodError', async () => {
    await expect(
      exportFhir(
        new NextRequest('http://localhost:3000/api/fhir/export', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: 'not-valid-json',
        }),
      ),
    ).rejects.toThrow();
  });

  it('POST returns blocked response when middleware blocks', async () => {
    mockRunMiddleware.mockReturnValueOnce(
      new NextResponse(JSON.stringify({ error: 'blocked' }), { status: 429 }),
    );
    const res = await exportFhir(
      new NextRequest('http://localhost:3000/api/fhir/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resourceTypes: ['Patient'], destination: 'test' }),
      }),
    );
    expect(res.status).toBe(429);
  });
});

describe('/api/fhir/mapping', () => {
  it('GET returns FHIR mapping', async () => {
    const res = await getMapping(new NextRequest('http://localhost:3000/api/fhir/mapping'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
  });

  it('GET returns blocked response when middleware blocks', async () => {
    mockRunMiddleware.mockReturnValueOnce(
      new NextResponse(JSON.stringify({ error: 'blocked' }), { status: 429 }),
    );
    const res = await getMapping(new NextRequest('http://localhost:3000/api/fhir/mapping'));
    expect(res.status).toBe(429);
  });
});
