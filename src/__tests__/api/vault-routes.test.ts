/** @jest-environment node */

// ============================================================
// Tests for the REAL vault compartments API:
//   GET/PATCH /api/vault/compartments
//   GET/PATCH /api/vault/compartments/[id]
// Compartments are persisted, owner-scoped, encrypted state with derived
// live stats — these tests exercise lazy initialization, lock/unlock,
// derived counts from real entries, auth, and validation.
// ============================================================

jest.mock('@/lib/api/middleware', () => {
  const actual = jest.requireActual('@/lib/api/middleware');
  return { ...actual, runMiddleware: jest.fn((...args: unknown[]) => actual.runMiddleware(...args)) };
});

import { NextRequest, NextResponse } from 'next/server';
import { runMiddleware } from '@/lib/api/middleware';
import { GET as listCompartments, PATCH as patchCompartments } from '@/app/api/vault/compartments/route';
import { GET as getCompartment, PATCH as patchCompartment } from '@/app/api/vault/compartments/[id]/route';
import { POST as postSymptom } from '@/app/api/vault/symptoms/route';
import { POST as postCycle } from '@/app/api/vault/cycle/route';
import { __resetVaultForTests } from '@/lib/api/vault-service';
import { createSessionToken } from '@/lib/api/session';
import { seededAddress } from '@/lib/utils';

const mockedRunMiddleware = runMiddleware as jest.MockedFunction<typeof runMiddleware>;
const USER = seededAddress(710);
const token = createSessionToken(USER).token;

const BASE = 'http://localhost:3000/api/vault/compartments';

function authed(url: string, init: RequestInit = {}): NextRequest {
  return new NextRequest(url, {
    ...init,
    headers: { ...(init.headers as Record<string, string>), authorization: `Bearer ${token}` },
  });
}

function jsonBody(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  };
}

beforeEach(() => __resetVaultForTests());

afterEach(() => {
  mockedRunMiddleware.mockImplementation((...args: unknown[]) => {
    const actual = jest.requireActual('@/lib/api/middleware');
    return actual.runMiddleware(...args);
  });
});

describe('/api/vault/compartments', () => {
  it('GET returns the middleware error when blocked', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(NextResponse.json({ error: 'blocked' }, { status: 403 }));
    expect((await listCompartments(authed(BASE))).status).toBe(403);
  });

  it('GET requires authentication', async () => {
    const res = await listCompartments(new NextRequest(BASE));
    expect(res.status).toBe(401);
  });

  it('GET returns the auth error when the session vanishes after middleware', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(null as unknown as Response);
    const res = await listCompartments(new NextRequest(BASE));
    expect(res.status).toBe(401);
  });

  it('GET lazily initializes the default set: 8 categories, locked, honest empty crypto fields', async () => {
    const res = await listCompartments(authed(BASE));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data).toHaveLength(8);
    const categories = body.data.map((c: { category: string }) => c.category);
    expect(categories).toEqual([
      'cycle_tracking', 'fertility_data', 'hormone_levels', 'medications',
      'lab_results', 'imaging', 'symptoms', 'pregnancy',
    ]);
    for (const c of body.data) {
      expect(c.lockStatus).toBe('locked'); // privacy-first default
      expect(c.recordCount).toBe(0);
      expect(c.storageUsed).toBe(0);
      // No fabricated crypto facts: keys are never exposed, no per-compartment
      // access lists or jurisdiction flags exist.
      expect(c.encryptionKey).toBe('');
      expect(c.accessList).toEqual([]);
      expect(c.jurisdictionFlags).toEqual([]);
      expect(c.description).not.toMatch(/TEE/);
    }
  });

  it('GET is idempotent: the second call reuses the persisted set', async () => {
    const first = await (await listCompartments(authed(BASE))).json();
    const second = await (await listCompartments(authed(BASE))).json();
    expect(second.data.map((c: { id: string }) => c.id)).toEqual(
      first.data.map((c: { id: string }) => c.id),
    );
  });

  it('GET derives live record counts and storage from real entries', async () => {
    await postSymptom(authed('http://localhost:3000/api/vault/symptoms',
      jsonBody('POST', { category: 'pain', symptom: 'Cramps', severity: 3 })));
    await postCycle(authed('http://localhost:3000/api/vault/cycle',
      jsonBody('POST', { flow: 'heavy', isPeriodStart: true })));

    const body = await (await listCompartments(authed(BASE))).json();
    const byCat = Object.fromEntries(body.data.map((c: { category: string }) => [c.category, c]));
    expect(byCat.symptoms.recordCount).toBe(1);
    expect(byCat.symptoms.storageUsed).toBeGreaterThan(0);
    expect(byCat.cycle_tracking.recordCount).toBe(1);
    expect(byCat.cycle_tracking.storageUsed).toBeGreaterThan(0);
    expect(byCat.medications.recordCount).toBe(0);
    // lastAccessed reflects the newest real entry for data-bearing categories.
    expect(byCat.symptoms.lastAccessed).toBeGreaterThan(0);
  });

  it('PATCH unlocks and re-locks a compartment (persisted)', async () => {
    const list = await (await listCompartments(authed(BASE))).json();
    const id = list.data[0].id;

    const unlocked = await (await patchCompartments(
      authed(BASE, jsonBody('PATCH', { id, action: 'unlock' })))).json();
    expect(unlocked.data.lockStatus).toBe('unlocked');

    // Persisted: a fresh list reflects the change.
    const after = await (await listCompartments(authed(BASE))).json();
    expect(after.data.find((c: { id: string }) => c.id === id).lockStatus).toBe('unlocked');

    const relocked = await (await patchCompartments(
      authed(BASE, jsonBody('PATCH', { id, action: 'lock' })))).json();
    expect(relocked.data.lockStatus).toBe('locked');
  });

  it('PATCH returns 404 for an unknown compartment id', async () => {
    await listCompartments(authed(BASE));
    const res = await patchCompartments(
      authed(BASE, jsonBody('PATCH', { id: 'cmp-nonexistent', action: 'lock' })));
    expect(res.status).toBe(404);
  });

  it('PATCH returns 422 for an invalid action', async () => {
    const res = await patchCompartments(
      authed(BASE, jsonBody('PATCH', { id: 'x', action: 'explode' })));
    expect(res.status).toBe(422);
  });

  it('PATCH throws on invalid JSON (non-Zod error)', async () => {
    await expect(
      patchCompartments(authed(BASE, jsonBody('PATCH', 'not-json'))),
    ).rejects.toThrow();
  });

  it('PATCH returns the middleware error when blocked', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(NextResponse.json({ error: 'blocked' }, { status: 403 }));
    expect((await patchCompartments(authed(BASE, jsonBody('PATCH', { id: 'x', action: 'lock' })))).status).toBe(403);
  });

  it('PATCH returns the auth error when the session vanishes after middleware', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(null as unknown as Response);
    const res = await patchCompartments(new NextRequest(BASE, jsonBody('PATCH', { id: 'x', action: 'lock' })));
    expect(res.status).toBe(401);
  });

  it('compartments are owner-scoped: another wallet gets its own fresh set', async () => {
    const mine = await (await listCompartments(authed(BASE))).json();
    const other = createSessionToken(seededAddress(711)).token;
    const res = await listCompartments(new NextRequest(BASE, {
      headers: { authorization: `Bearer ${other}` },
    }));
    const theirs = await res.json();
    expect(theirs.data).toHaveLength(8);
    const mineIds = new Set(mine.data.map((c: { id: string }) => c.id));
    for (const c of theirs.data) {
      expect(mineIds.has(c.id)).toBe(false);
    }
  });
});

describe('/api/vault/compartments/[id]', () => {
  async function firstId(): Promise<string> {
    const body = await (await listCompartments(authed(BASE))).json();
    return body.data[0].id;
  }

  it('GET returns the middleware error when blocked', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(NextResponse.json({ error: 'blocked' }, { status: 403 }));
    const res = await getCompartment(authed(`${BASE}/x`), { params: Promise.resolve({ id: 'x' }) });
    expect(res.status).toBe(403);
  });

  it('GET returns the auth error when the session vanishes after middleware', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(null as unknown as Response);
    const res = await getCompartment(new NextRequest(`${BASE}/x`), { params: Promise.resolve({ id: 'x' }) });
    expect(res.status).toBe(401);
  });

  it('GET returns real compartment detail', async () => {
    const id = await firstId();
    const res = await getCompartment(authed(`${BASE}/${id}`), { params: Promise.resolve({ id }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.id).toBe(id);
    expect(body.data.category).toBe('cycle_tracking');
    expect(body.data.encryptionKey).toBe('');
  });

  it('GET returns 404 for an unknown id', async () => {
    await firstId();
    const res = await getCompartment(authed(`${BASE}/cmp-unknown`), { params: Promise.resolve({ id: 'cmp-unknown' }) });
    expect(res.status).toBe(404);
  });

  it('PATCH locks/unlocks via the detail route', async () => {
    const id = await firstId();
    const res = await patchCompartment(
      authed(`${BASE}/${id}`, jsonBody('PATCH', { action: 'unlock' })),
      { params: Promise.resolve({ id }) },
    );
    expect(res.status).toBe(200);
    expect((await res.json()).data.lockStatus).toBe('unlocked');
  });

  it('PATCH returns 404 for an unknown id', async () => {
    await firstId();
    const res = await patchCompartment(
      authed(`${BASE}/cmp-unknown`, jsonBody('PATCH', { action: 'lock' })),
      { params: Promise.resolve({ id: 'cmp-unknown' }) },
    );
    expect(res.status).toBe(404);
  });

  it('PATCH returns 422 for an invalid action', async () => {
    const id = await firstId();
    const res = await patchCompartment(
      authed(`${BASE}/${id}`, jsonBody('PATCH', { lockStatus: 'partial' })),
      { params: Promise.resolve({ id }) },
    );
    expect(res.status).toBe(422);
  });

  it('PATCH throws on invalid JSON (non-Zod error)', async () => {
    const id = await firstId();
    await expect(
      patchCompartment(
        authed(`${BASE}/${id}`, jsonBody('PATCH', 'not-json')),
        { params: Promise.resolve({ id }) },
      ),
    ).rejects.toThrow();
  });

  it('PATCH returns the middleware error when blocked', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(NextResponse.json({ error: 'blocked' }, { status: 403 }));
    const res = await patchCompartment(
      authed(`${BASE}/x`, jsonBody('PATCH', { action: 'lock' })),
      { params: Promise.resolve({ id: 'x' }) },
    );
    expect(res.status).toBe(403);
  });

  it('PATCH returns the auth error when the session vanishes after middleware', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(null as unknown as Response);
    const res = await patchCompartment(
      new NextRequest(`${BASE}/x`, jsonBody('PATCH', { action: 'lock' })),
      { params: Promise.resolve({ id: 'x' }) },
    );
    expect(res.status).toBe(401);
  });
});
