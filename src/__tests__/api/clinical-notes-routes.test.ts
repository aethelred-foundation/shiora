/** @jest-environment node */

jest.mock('@/lib/api/middleware', () => {
  const actual = jest.requireActual('@/lib/api/middleware');
  return { ...actual, runMiddleware: jest.fn((...args: unknown[]) => actual.runMiddleware(...args)) };
});

import { NextRequest, NextResponse } from 'next/server';
import { runMiddleware } from '@/lib/api/middleware';
import { GET, POST } from '@/app/api/provider/patients/[address]/notes/route';
import { POST as amendNote } from '@/app/api/provider/patients/[address]/notes/[noteId]/amendments/route';
import { GET as getMyNotes } from '@/app/api/me/clinical-notes/route';
import { createClinicalNote, __resetClinicalNotesForTests } from '@/lib/api/clinical-notes-service';
import { createAccessGrant, __resetAccessForTests } from '@/lib/api/access-service';
import { assignRole, __resetRolesForTests } from '@/lib/api/roles-service';
import { createSessionToken } from '@/lib/api/session';
import { seededAddress } from '@/lib/utils';
import type { MockAccessGrant } from '@/lib/api/mock-data';

const mockedRunMiddleware = runMiddleware as jest.MockedFunction<typeof runMiddleware>;
const PROVIDER = seededAddress(800);
const PROVIDER_B = seededAddress(804);
const PATIENT = seededAddress(801);
const NON_PROVIDER = seededAddress(803);
const providerToken = createSessionToken(PROVIDER).token;
const nonProviderToken = createSessionToken(NON_PROVIDER).token;
const patientToken = createSessionToken(PATIENT).token;

function grantFrom(patient: string): MockAccessGrant {
  return {
    id: `grant-${patient}`, provider: 'Dr. Rivera', specialty: 'OB-GYN',
    address: PROVIDER, status: 'Active', scope: 'Full Records',
    grantedAt: Date.now(), expiresAt: Date.now() + 1e9, lastAccess: null,
    accessCount: 0, txHash: '0x', attestation: 'att',
    canView: true, canDownload: false, canShare: false, ownerAddress: patient,
  };
}

beforeEach(async () => {
  __resetClinicalNotesForTests();
  __resetAccessForTests();
  __resetRolesForTests();
  await assignRole(PROVIDER, 'provider');
});

afterEach(() => {
  mockedRunMiddleware.mockImplementation((...args: unknown[]) => {
    const actual = jest.requireActual('@/lib/api/middleware');
    return actual.runMiddleware(...args);
  });
});

const BASE = `http://localhost:3000/api/provider/patients/${PATIENT}/notes`;

function authed(url: string, init: RequestInit, token?: string): NextRequest {
  const headers: Record<string, string> = { ...(init.headers as Record<string, string>) };
  if (token) headers.authorization = `Bearer ${token}`;
  return new NextRequest(url, { ...init, headers });
}

function jsonBody(body: unknown): RequestInit {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  };
}

function ctx(address: string) {
  return { params: Promise.resolve({ address }) };
}

function amendCtx(address: string, noteId: string) {
  return { params: Promise.resolve({ address, noteId }) };
}

const grantAccess = () => createAccessGrant(PATIENT, grantFrom(PATIENT));
const ME = 'http://localhost:3000/api/me/clinical-notes';

describe('GET /api/provider/patients/[address]/notes', () => {
  it('returns the middleware error when blocked', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(NextResponse.json({ error: 'blocked' }, { status: 403 }));
    expect((await GET(authed(BASE, { method: 'GET' }, providerToken), ctx(PATIENT))).status).toBe(403);
  });

  it('returns 403 for a non-provider', async () => {
    expect((await GET(authed(BASE, { method: 'GET' }, nonProviderToken), ctx(PATIENT))).status).toBe(403);
  });

  it('returns 400 for an invalid patient address', async () => {
    const res = await GET(
      authed('http://localhost:3000/api/provider/patients/bad/notes', { method: 'GET' }, providerToken),
      ctx('not-an-address'),
    );
    expect(res.status).toBe(400);
  });

  it('returns 403 when the provider has no active grant', async () => {
    expect((await GET(authed(BASE, { method: 'GET' }, providerToken), ctx(PATIENT))).status).toBe(403);
  });

  it('lists notes for a granted patient (empty to start)', async () => {
    await grantAccess();
    const res = await GET(authed(BASE, { method: 'GET' }, providerToken), ctx(PATIENT));
    expect(res.status).toBe(200);
    expect((await res.json()).data.total).toBe(0);
  });
});

describe('POST /api/provider/patients/[address]/notes', () => {
  const note = { type: 'observation', title: 'X', body: 'Y' };

  it('returns the middleware error when blocked', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(NextResponse.json({ error: 'blocked' }, { status: 403 }));
    expect((await POST(authed(BASE, jsonBody(note), providerToken), ctx(PATIENT))).status).toBe(403);
  });

  it('returns 403 for a non-provider', async () => {
    expect((await POST(authed(BASE, jsonBody(note), nonProviderToken), ctx(PATIENT))).status).toBe(403);
  });

  it('returns 400 for an invalid patient address', async () => {
    const res = await POST(
      authed('http://localhost:3000/api/provider/patients/bad/notes', jsonBody(note), providerToken),
      ctx('bad'),
    );
    expect(res.status).toBe(400);
  });

  it('returns 403 without an active grant', async () => {
    expect((await POST(authed(BASE, jsonBody(note), providerToken), ctx(PATIENT))).status).toBe(403);
  });

  it('creates a note that the patient view then lists', async () => {
    await grantAccess();
    const created = await POST(
      authed(BASE, jsonBody({ type: 'assessment', title: 'Initial visit', body: 'Patient stable' }), providerToken),
      ctx(PATIENT),
    );
    expect(created.status).toBe(201);
    const body = await created.json();
    expect(body.data.title).toBe('Initial visit');
    expect(body.data.providerAddress).toBe(PROVIDER);
    expect(body.data.patientAddress).toBe(PATIENT);

    const list = await GET(authed(BASE, { method: 'GET' }, providerToken), ctx(PATIENT));
    expect((await list.json()).data.total).toBe(1);
  });

  it('returns 422 for an invalid note', async () => {
    await grantAccess();
    const res = await POST(authed(BASE, jsonBody({ type: 'invalid', title: '', body: '' }), providerToken), ctx(PATIENT));
    expect(res.status).toBe(422);
  });

  it('throws on an invalid JSON body', async () => {
    await grantAccess();
    await expect(POST(authed(BASE, jsonBody('not-json'), providerToken), ctx(PATIENT))).rejects.toThrow();
  });

  it('filters notes by type', async () => {
    await grantAccess();
    await createClinicalNote(PATIENT, PROVIDER, { type: 'observation', title: 'Obs', body: 'b' });
    await createClinicalNote(PATIENT, PROVIDER, { type: 'plan', title: 'Plan', body: 'b' });

    const planOnly = await GET(authed(`${BASE}?type=plan`, { method: 'GET' }, providerToken), ctx(PATIENT));
    const body = await planOnly.json();
    expect(body.data.total).toBe(1);
    expect(body.data.notes[0].type).toBe('plan');
  });
});

describe('POST /api/provider/patients/[address]/notes/[noteId]/amendments', () => {
  const amendment = { body: 'Addendum: lab results returned normal.' };

  async function seedNote(): Promise<string> {
    await grantAccess();
    return (await createClinicalNote(PATIENT, PROVIDER, { type: 'observation', title: 'Visit', body: 'Initial' })).id;
  }

  it('returns the middleware error when blocked', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(NextResponse.json({ error: 'blocked' }, { status: 403 }));
    expect((await amendNote(authed(`${BASE}/n/amendments`, jsonBody(amendment), providerToken), amendCtx(PATIENT, 'n'))).status).toBe(403);
  });

  it('returns 403 for a non-provider', async () => {
    expect((await amendNote(authed(`${BASE}/n/amendments`, jsonBody(amendment), nonProviderToken), amendCtx(PATIENT, 'n'))).status).toBe(403);
  });

  it('returns 400 for an invalid patient address', async () => {
    expect((await amendNote(authed(`${BASE}/n/amendments`, jsonBody(amendment), providerToken), amendCtx('bad', 'n'))).status).toBe(400);
  });

  it('returns 403 without an active grant', async () => {
    expect((await amendNote(authed(`${BASE}/n/amendments`, jsonBody(amendment), providerToken), amendCtx(PATIENT, 'n'))).status).toBe(403);
  });

  it('returns 404 for an unknown note', async () => {
    await grantAccess();
    expect((await amendNote(authed(`${BASE}/missing/amendments`, jsonBody(amendment), providerToken), amendCtx(PATIENT, 'note-missing'))).status).toBe(404);
  });

  it('appends an amendment without mutating the original body', async () => {
    const noteId = await seedNote();
    const res = await amendNote(
      authed(`${BASE}/${noteId}/amendments`, jsonBody(amendment), providerToken),
      amendCtx(PATIENT, noteId),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.amendments).toHaveLength(1);
    expect(body.data.amendments[0].body).toBe(amendment.body);
    expect(body.data.body).toBe('Initial'); // original untouched
  });

  it('returns 422 for an empty amendment', async () => {
    const noteId = await seedNote();
    expect((await amendNote(authed(`${BASE}/${noteId}/amendments`, jsonBody({ body: '' }), providerToken), amendCtx(PATIENT, noteId))).status).toBe(422);
  });

  it('throws on an invalid JSON body', async () => {
    const noteId = await seedNote();
    await expect(amendNote(authed(`${BASE}/${noteId}/amendments`, jsonBody('not-json'), providerToken), amendCtx(PATIENT, noteId))).rejects.toThrow();
  });
});

describe('GET /api/me/clinical-notes', () => {
  it('returns the middleware error when blocked', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(NextResponse.json({ error: 'blocked' }, { status: 403 }));
    expect((await getMyNotes(authed(ME, { method: 'GET' }, patientToken))).status).toBe(403);
  });

  it('returns 401 when the middleware is bypassed but unauthenticated', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(null);
    expect((await getMyNotes(new NextRequest(ME))).status).toBe(401);
  });

  it('lets a patient see every note about them, including other providers\' notes', async () => {
    await createClinicalNote(PATIENT, PROVIDER, { type: 'observation', title: 'A', body: 'a' });
    await createClinicalNote(PATIENT, PROVIDER_B, { type: 'plan', title: 'B', body: 'b' });

    const res = await getMyNotes(authed(ME, { method: 'GET' }, patientToken));
    expect(res.status).toBe(200);
    expect((await res.json()).data.total).toBe(2);
  });
});
