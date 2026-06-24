/** @jest-environment node */

jest.mock('@/lib/api/middleware', () => {
  const actual = jest.requireActual('@/lib/api/middleware');
  return { ...actual, runMiddleware: jest.fn((...args: unknown[]) => actual.runMiddleware(...args)) };
});

import { NextRequest, NextResponse } from 'next/server';
import { runMiddleware } from '@/lib/api/middleware';
import { GET as getCompartments, POST as createCompartment } from '@/app/api/vault/compartments/route';
import { GET as getCompartment, PATCH as patchCompartment } from '@/app/api/vault/compartments/[id]/route';

const mockedRunMiddleware = runMiddleware as jest.MockedFunction<typeof runMiddleware>;

afterEach(() => {
  mockedRunMiddleware.mockImplementation((...args: unknown[]) => {
    const actual = jest.requireActual('@/lib/api/middleware');
    return actual.runMiddleware(...args);
  });
});

describe('/api/vault/compartments', () => {
  it('GET returns middleware error when blocked', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(NextResponse.json({ error: 'blocked' }, { status: 403 }));
    const res = await getCompartments(new NextRequest('http://localhost:3000/api/vault/compartments'));
    expect(res.status).toBe(403);
  });

  it('POST returns middleware error when blocked', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(NextResponse.json({ error: 'blocked' }, { status: 403 }));
    const res = await createCompartment(
      new NextRequest('http://localhost:3000/api/vault/compartments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: 'cycle_tracking', label: 'Test' }),
      }),
    );
    expect(res.status).toBe(403);
  });

  it('GET returns compartments list', async () => {
    const res = await getCompartments(new NextRequest('http://localhost:3000/api/vault/compartments'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.compartments).toBeDefined();
    expect(Array.isArray(body.data.compartments)).toBe(true);
    expect(body.data.total).toBeGreaterThan(0);
  });

  it('POST creates a new compartment', async () => {
    const res = await createCompartment(
      new NextRequest('http://localhost:3000/api/vault/compartments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: 'cycle_tracking',
          label: 'My Cycle Data',
        }),
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.category).toBe('cycle_tracking');
    expect(body.data.label).toBe('My Cycle Data');
    expect(body.data.lockStatus).toBe('locked');
    expect(body.data.encryptionKey).toBeDefined();
  });

  it('POST returns 422 for invalid category', async () => {
    const res = await createCompartment(
      new NextRequest('http://localhost:3000/api/vault/compartments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: 'invalid_category', label: 'Test' }),
      }),
    );
    expect(res.status).toBe(422);
  });

  it('POST returns 422 for missing label', async () => {
    const res = await createCompartment(
      new NextRequest('http://localhost:3000/api/vault/compartments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: 'cycle_tracking' }),
      }),
    );
    expect(res.status).toBe(422);
  });

  it('POST throws on invalid JSON body (non-Zod error)', async () => {
    await expect(
      createCompartment(
        new NextRequest('http://localhost:3000/api/vault/compartments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: 'not-json',
        }),
      ),
    ).rejects.toThrow();
  });
});

describe('/api/vault/compartments/[id]', () => {
  it('GET returns middleware error when blocked', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(NextResponse.json({ error: 'blocked' }, { status: 403 }));
    const res = await getCompartment(
      new NextRequest('http://localhost:3000/api/vault/compartments/any-id'),
      { params: Promise.resolve({ id: 'any-id' }) },
    );
    expect(res.status).toBe(403);
  });

  it('PATCH returns middleware error when blocked', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(NextResponse.json({ error: 'blocked' }, { status: 403 }));
    const res = await patchCompartment(
      new NextRequest('http://localhost:3000/api/vault/compartments/any-id', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lockStatus: 'locked' }),
      }),
      { params: Promise.resolve({ id: 'any-id' }) },
    );
    expect(res.status).toBe(403);
  });

  let validId: string;

  beforeAll(async () => {
    const res = await getCompartments(new NextRequest('http://localhost:3000/api/vault/compartments'));
    const body = await res.json();
    validId = body.data.compartments[0]?.id;
  });

  it('GET returns a specific compartment', async () => {
    expect(validId).toBeDefined();
    const res = await getCompartment(
      new NextRequest(`http://localhost:3000/api/vault/compartments/${validId}`),
      { params: Promise.resolve({ id: validId }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(validId);
  });

  it('GET returns 404 for unknown compartment', async () => {
    const res = await getCompartment(
      new NextRequest('http://localhost:3000/api/vault/compartments/vault-nonexistent'),
      { params: Promise.resolve({ id: 'vault-nonexistent' }) },
    );
    expect(res.status).toBe(404);
  });

  it('PATCH updates compartment lock status', async () => {
    expect(validId).toBeDefined();
    const res = await patchCompartment(
      new NextRequest(`http://localhost:3000/api/vault/compartments/${validId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lockStatus: 'unlocked' }),
      }),
      { params: Promise.resolve({ id: validId }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.lockStatus).toBe('unlocked');
  });

  it('PATCH updates compartment to locked status', async () => {
    expect(validId).toBeDefined();
    const res = await patchCompartment(
      new NextRequest(`http://localhost:3000/api/vault/compartments/${validId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lockStatus: 'locked' }),
      }),
      { params: Promise.resolve({ id: validId }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.lockStatus).toBe('locked');
    expect(body.meta.message).toContain('locked');
  });

  it('PATCH updates compartment to partial status', async () => {
    expect(validId).toBeDefined();
    const res = await patchCompartment(
      new NextRequest(`http://localhost:3000/api/vault/compartments/${validId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lockStatus: 'partial' }),
      }),
      { params: Promise.resolve({ id: validId }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.lockStatus).toBe('partial');
    expect(body.meta.message).toContain('updated');
  });

  it('PATCH updates compartment label and description', async () => {
    expect(validId).toBeDefined();
    const res = await patchCompartment(
      new NextRequest(`http://localhost:3000/api/vault/compartments/${validId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: 'Updated Label', description: 'New description' }),
      }),
      { params: Promise.resolve({ id: validId }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.label).toBe('Updated Label');
    expect(body.data.description).toBe('New description');
  });

  it('PATCH updates label only (description undefined)', async () => {
    expect(validId).toBeDefined();
    const res = await patchCompartment(
      new NextRequest(`http://localhost:3000/api/vault/compartments/${validId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: 'Label Only Update' }),
      }),
      { params: Promise.resolve({ id: validId }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.label).toBe('Label Only Update');
    expect(body.meta.message).toContain('updated');
  });

  it('PATCH updates description only (label undefined)', async () => {
    expect(validId).toBeDefined();
    const res = await patchCompartment(
      new NextRequest(`http://localhost:3000/api/vault/compartments/${validId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: 'Description only update' }),
      }),
      { params: Promise.resolve({ id: validId }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.description).toBe('Description only update');
    expect(body.meta.message).toContain('updated');
  });

  it('GET returns details for multiple compartments (covering all lock states)', async () => {
    const listRes = await getCompartments(new NextRequest('http://localhost:3000/api/vault/compartments'));
    const listBody = await listRes.json();
    for (const c of listBody.data.compartments) {
      const res = await getCompartment(
        new NextRequest(`http://localhost:3000/api/vault/compartments/${c.id}`),
        { params: Promise.resolve({ id: c.id }) },
      );
      expect(res.status).toBe(200);
    }
  });

  it('PATCH returns 422 for invalid lock status', async () => {
    expect(validId).toBeDefined();
    const res = await patchCompartment(
      new NextRequest(`http://localhost:3000/api/vault/compartments/${validId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lockStatus: 'invalid_status' }),
      }),
      { params: Promise.resolve({ id: validId }) },
    );
    expect(res.status).toBe(422);
  });

  it('PATCH returns 404 for unknown compartment', async () => {
    const res = await patchCompartment(
      new NextRequest('http://localhost:3000/api/vault/compartments/vault-nonexistent', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lockStatus: 'locked' }),
      }),
      { params: Promise.resolve({ id: 'vault-nonexistent' }) },
    );
    expect(res.status).toBe(404);
  });

  it('PATCH throws on invalid JSON body (non-Zod error)', async () => {
    expect(validId).toBeDefined();
    await expect(
      patchCompartment(
        new NextRequest(`http://localhost:3000/api/vault/compartments/${validId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: 'not-json',
        }),
        { params: Promise.resolve({ id: validId }) },
      ),
    ).rejects.toThrow();
  });
});
