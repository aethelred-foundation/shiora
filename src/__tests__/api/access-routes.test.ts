/** @jest-environment node */

import { NextRequest } from 'next/server';
import { GET as listGrants, POST as createGrant } from '@/app/api/access/route';
import {
  GET as getGrant,
  PATCH as patchGrant,
  DELETE as deleteGrant,
} from '@/app/api/access/[id]/route';
import { GET as getAudit } from '@/app/api/access/audit/route';
import { createSessionToken } from '@/lib/api/session';
import { seededAddress } from '@/lib/utils';

const actualStore = jest.requireActual('@/lib/api/store');
const actualMiddleware = jest.requireActual('@/lib/api/middleware');
const actualMockData = jest.requireActual('@/lib/api/mock-data');

jest.mock('@/lib/api/store', () => {
  const actual = jest.requireActual('@/lib/api/store');
  return {
    __esModule: true,
    ...actual,
    updateAccessGrant: jest.fn((...args: unknown[]) => actual.updateAccessGrant(...args)),
    listAccessGrants: jest.fn((...args: unknown[]) => actual.listAccessGrants(...args)),
    createAccessGrant: jest.fn((...args: unknown[]) => actual.createAccessGrant(...args)),
  };
});

jest.mock('@/lib/api/middleware', () => {
  const actual = jest.requireActual('@/lib/api/middleware');
  return {
    __esModule: true,
    ...actual,
    runMiddleware: jest.fn((...args: unknown[]) => actual.runMiddleware(...args)),
  };
});

jest.mock('@/lib/api/mock-data', () => {
  const actual = jest.requireActual('@/lib/api/mock-data');
  return {
    __esModule: true,
    ...actual,
    generateMockAuditLog: jest.fn((...args: unknown[]) => actual.generateMockAuditLog(...args)),
  };
});

import { updateAccessGrant, listAccessGrants, createAccessGrant } from '@/lib/api/store';
import { runMiddleware } from '@/lib/api/middleware';
import { generateMockAuditLog } from '@/lib/api/mock-data';
const mockedUpdateAccessGrant = updateAccessGrant as jest.MockedFunction<typeof updateAccessGrant>;
const mockedListAccessGrants = listAccessGrants as jest.MockedFunction<typeof listAccessGrants>;
const mockedCreateAccessGrant = createAccessGrant as jest.MockedFunction<typeof createAccessGrant>;
const mockedRunMiddleware = runMiddleware as jest.MockedFunction<typeof runMiddleware>;
const mockedGenerateMockAuditLog = generateMockAuditLog as jest.MockedFunction<
  typeof generateMockAuditLog
>;

afterEach(() => {
  mockedUpdateAccessGrant.mockImplementation((...args: unknown[]) =>
    actualStore.updateAccessGrant(...args),
  );
  mockedListAccessGrants.mockImplementation((...args: unknown[]) =>
    actualStore.listAccessGrants(...args),
  );
  mockedCreateAccessGrant.mockImplementation((...args: unknown[]) =>
    actualStore.createAccessGrant(...args),
  );
  mockedRunMiddleware.mockImplementation((...args: unknown[]) =>
    actualMiddleware.runMiddleware(...args),
  );
  mockedGenerateMockAuditLog.mockImplementation((...args: unknown[]) =>
    actualMockData.generateMockAuditLog(...args),
  );
});

const addr = seededAddress(5555);
const { token } = createSessionToken(addr);

function authed(url: string, init?: RequestInit): NextRequest {
  return new NextRequest(url, {
    ...init,
    headers: { ...(init?.headers ?? {}), authorization: `Bearer ${token}` },
  });
}

describe('/api/access', () => {
  it('GET lists grants for authenticated user', async () => {
    const res = await listGrants(authed('http://localhost:3000/api/access'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.pagination).toBeDefined();
    expect(body.meta?.summary).toBeDefined();
  });

  it('GET returns 401 for unauthenticated', async () => {
    const res = await listGrants(new NextRequest('http://localhost:3000/api/access'));
    expect(res.status).toBe(401);
  });

  it('POST creates a new grant', async () => {
    const res = await createGrant(
      authed('http://localhost:3000/api/access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'Aethelred General Hospital',
          specialty: 'Cardiology',
          address: seededAddress(9999),
          scope: 'Full Records',
          durationDays: 30,
          canView: true,
          canDownload: false,
          canShare: false,
        }),
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.provider).toBe('Aethelred General Hospital');
    expect(body.data.status).toBe('Pending');
  });

  it('POST returns validation error for invalid body', async () => {
    const res = await createGrant(
      authed('http://localhost:3000/api/access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }),
    );
    expect(res.status).toBe(422);
  });

  it('POST returns 401 for unauthenticated', async () => {
    const res = await createGrant(
      new NextRequest('http://localhost:3000/api/access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'Test' }),
      }),
    );
    expect(res.status).toBe(401);
  });

  it('GET filters by status', async () => {
    const res = await listGrants(authed('http://localhost:3000/api/access?status=Active'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('GET filters by search query', async () => {
    const res = await listGrants(authed('http://localhost:3000/api/access?q=cardiology'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('GET returns 422 for invalid query params', async () => {
    const res = await listGrants(authed('http://localhost:3000/api/access?page=abc'));
    expect(res.status).toBe(422);
  });

  it('GET returns 401 from inner requireAuth when middleware is bypassed', async () => {
    mockedRunMiddleware.mockReturnValueOnce(null);
    const res = await listGrants(new NextRequest('http://localhost:3000/api/access'));
    expect(res.status).toBe(401);
  });

  it('POST returns 401 from inner requireAuth when middleware is bypassed', async () => {
    mockedRunMiddleware.mockReturnValueOnce(null);
    const res = await createGrant(
      new NextRequest('http://localhost:3000/api/access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'Test' }),
      }),
    );
    expect(res.status).toBe(401);
  });

  it('GET re-throws non-ZodError errors', async () => {
    mockedListAccessGrants.mockImplementationOnce(() => {
      throw new Error('Unexpected list error');
    });
    await expect(listGrants(authed('http://localhost:3000/api/access'))).rejects.toThrow(
      'Unexpected list error',
    );
    // afterEach handles restoration
  });

  it('POST re-throws non-ZodError errors', async () => {
    mockedCreateAccessGrant.mockImplementationOnce(() => {
      throw new Error('Unexpected create error');
    });
    await expect(
      createGrant(
        authed('http://localhost:3000/api/access', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider: 'Error Test Clinic',
            specialty: 'General',
            address: seededAddress(4444),
            scope: 'Lab Results Only',
            durationDays: 14,
          }),
        }),
      ),
    ).rejects.toThrow('Unexpected create error');
    // afterEach handles restoration
  });
});

describe('/api/access/[id]', () => {
  let grantId: string;

  beforeAll(async () => {
    // Create a grant to test with
    const res = await createGrant(
      authed('http://localhost:3000/api/access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'Test Clinic',
          specialty: 'General',
          address: seededAddress(8888),
          scope: 'Lab Results Only',
          durationDays: 14,
        }),
      }),
    );
    const body = await res.json();
    grantId = body.data.id;
  });

  it('GET returns grant details', async () => {
    const res = await getGrant(authed(`http://localhost:3000/api/access/${grantId}`), {
      params: Promise.resolve({ id: grantId }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(grantId);
    expect(body.data.permissions).toBeDefined();
    expect(body.data.blockchain).toBeDefined();
  });

  it('GET returns 404 for nonexistent grant', async () => {
    const res = await getGrant(authed('http://localhost:3000/api/access/nonexistent'), {
      params: Promise.resolve({ id: 'nonexistent' }),
    });
    expect(res.status).toBe(404);
  });

  it('PATCH updates grant permissions', async () => {
    const res = await patchGrant(
      authed(`http://localhost:3000/api/access/${grantId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ canDownload: true }),
      }),
      { params: Promise.resolve({ id: grantId }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.canDownload).toBe(true);
  });

  it('DELETE revokes grant', async () => {
    const res = await deleteGrant(
      authed(`http://localhost:3000/api/access/${grantId}`, { method: 'DELETE' }),
      { params: Promise.resolve({ id: grantId }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.status).toBe('Revoked');
  });

  it('DELETE returns conflict for already revoked', async () => {
    const res = await deleteGrant(
      authed(`http://localhost:3000/api/access/${grantId}`, { method: 'DELETE' }),
      { params: Promise.resolve({ id: grantId }) },
    );
    expect(res.status).toBe(409);
  });

  it('PATCH returns conflict for revoked grant', async () => {
    const res = await patchGrant(
      authed(`http://localhost:3000/api/access/${grantId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ canView: false }),
      }),
      { params: Promise.resolve({ id: grantId }) },
    );
    expect(res.status).toBe(409);
  });

  it('PATCH returns 404 for nonexistent grant', async () => {
    const res = await patchGrant(
      authed('http://localhost:3000/api/access/nonexistent', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ canView: false }),
      }),
      { params: Promise.resolve({ id: 'nonexistent' }) },
    );
    expect(res.status).toBe(404);
  });

  it('PATCH returns 422 for invalid body', async () => {
    // Create a fresh grant
    const createRes = await createGrant(
      authed('http://localhost:3000/api/access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'Patch Validation Test',
          specialty: 'Test',
          address: seededAddress(7777),
          scope: 'Lab Results Only',
          durationDays: 14,
        }),
      }),
    );
    const createBody = await createRes.json();
    const freshId = createBody.data.id;

    const res = await patchGrant(
      authed(`http://localhost:3000/api/access/${freshId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ durationDays: -5 }),
      }),
      { params: Promise.resolve({ id: freshId }) },
    );
    expect(res.status).toBe(422);
  });

  it('GET returns 401 for unauthenticated request', async () => {
    const res = await getGrant(new NextRequest('http://localhost:3000/api/access/some-id'), {
      params: Promise.resolve({ id: 'some-id' }),
    });
    expect(res.status).toBe(401);
  });

  it('DELETE returns 404 for nonexistent grant', async () => {
    const res = await deleteGrant(
      authed('http://localhost:3000/api/access/nonexistent', { method: 'DELETE' }),
      { params: Promise.resolve({ id: 'nonexistent' }) },
    );
    expect(res.status).toBe(404);
  });

  it('PATCH returns 404 when updateAccessGrant returns undefined (race condition)', async () => {
    // Create a fresh grant
    const createRes = await createGrant(
      authed('http://localhost:3000/api/access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'Race Condition Clinic',
          specialty: 'General',
          address: seededAddress(6060),
          scope: 'Lab Results Only',
          durationDays: 14,
        }),
      }),
    );
    const createBody = await createRes.json();
    const raceId = createBody.data.id;

    // Mock updateAccessGrant to return undefined
    mockedUpdateAccessGrant.mockReturnValueOnce(undefined);

    const res = await patchGrant(
      authed(`http://localhost:3000/api/access/${raceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ canView: true }),
      }),
      { params: Promise.resolve({ id: raceId }) },
    );
    expect(res.status).toBe(404);
    // afterEach handles restoration
  });

  it('PATCH re-throws non-ZodError errors', async () => {
    // Create a fresh grant
    const createRes = await createGrant(
      authed('http://localhost:3000/api/access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'Throw Test Clinic',
          specialty: 'General',
          address: seededAddress(6161),
          scope: 'Lab Results Only',
          durationDays: 14,
        }),
      }),
    );
    const createBody = await createRes.json();
    const throwId = createBody.data.id;

    // Mock updateAccessGrant to throw a non-Zod error
    mockedUpdateAccessGrant.mockImplementationOnce(() => {
      throw new Error('Unexpected DB error');
    });

    await expect(
      patchGrant(
        authed(`http://localhost:3000/api/access/${throwId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ canView: true }),
        }),
        { params: Promise.resolve({ id: throwId }) },
      ),
    ).rejects.toThrow('Unexpected DB error');
    // afterEach handles restoration
  });

  it('DELETE returns 404 when updateAccessGrant returns undefined (race condition)', async () => {
    // Create a fresh grant
    const createRes = await createGrant(
      authed('http://localhost:3000/api/access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'Delete Race Clinic',
          specialty: 'General',
          address: seededAddress(6262),
          scope: 'Lab Results Only',
          durationDays: 14,
        }),
      }),
    );
    const createBody = await createRes.json();
    const deleteRaceId = createBody.data.id;

    // Mock updateAccessGrant to return undefined
    mockedUpdateAccessGrant.mockReturnValueOnce(undefined);

    const res = await deleteGrant(
      authed(`http://localhost:3000/api/access/${deleteRaceId}`, { method: 'DELETE' }),
      { params: Promise.resolve({ id: deleteRaceId }) },
    );
    expect(res.status).toBe(404);
    // afterEach handles restoration
  });

  it('DELETE returns 401 for unauthenticated request', async () => {
    const res = await deleteGrant(
      new NextRequest('http://localhost:3000/api/access/some-id', { method: 'DELETE' }),
      { params: Promise.resolve({ id: 'some-id' }) },
    );
    expect(res.status).toBe(401);
  });

  it('PATCH returns 401 for unauthenticated request', async () => {
    const res = await patchGrant(
      new NextRequest('http://localhost:3000/api/access/some-id', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ canView: true }),
      }),
      { params: Promise.resolve({ id: 'some-id' }) },
    );
    expect(res.status).toBe(401);
  });

  it('GET returns 401 from inner requireAuth when middleware is bypassed', async () => {
    mockedRunMiddleware.mockReturnValueOnce(null);
    const res = await getGrant(new NextRequest('http://localhost:3000/api/access/some-id'), {
      params: Promise.resolve({ id: 'some-id' }),
    });
    expect(res.status).toBe(401);
  });

  it('PATCH returns 401 from inner requireAuth when middleware is bypassed', async () => {
    mockedRunMiddleware.mockReturnValueOnce(null);
    const res = await patchGrant(
      new NextRequest('http://localhost:3000/api/access/some-id', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ canView: true }),
      }),
      { params: Promise.resolve({ id: 'some-id' }) },
    );
    expect(res.status).toBe(401);
  });

  it('DELETE returns 401 from inner requireAuth when middleware is bypassed', async () => {
    mockedRunMiddleware.mockReturnValueOnce(null);
    const res = await deleteGrant(
      new NextRequest('http://localhost:3000/api/access/some-id', { method: 'DELETE' }),
      { params: Promise.resolve({ id: 'some-id' }) },
    );
    expect(res.status).toBe(401);
  });

  it('PATCH with multiple field updates', async () => {
    // Create a fresh grant with explicit permissions
    const createRes = await createGrant(
      authed('http://localhost:3000/api/access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'Multi Update Clinic',
          specialty: 'General',
          address: seededAddress(7070),
          scope: 'Lab Results Only',
          durationDays: 14,
          canView: true,
          canDownload: false,
          canShare: false,
        }),
      }),
    );
    const createBody = await createRes.json();
    const multiId = createBody.data.id;

    const res = await patchGrant(
      authed(`http://localhost:3000/api/access/${multiId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope: 'Full Records',
          canView: true,
          canDownload: true,
          canShare: true,
          durationDays: 30,
        }),
      }),
      { params: Promise.resolve({ id: multiId }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.scope).toBe('Full Records');
    expect(body.data.canDownload).toBe(true);
    expect(body.data.canShare).toBe(true);
  });
});

describe('/api/access/audit', () => {
  it('GET returns audit log', async () => {
    const res = await getAudit(authed('http://localhost:3000/api/access/audit'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('GET filters audit log by type', async () => {
    const res = await getAudit(authed('http://localhost:3000/api/access/audit?type=access'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('GET filters audit log by startDate', async () => {
    const res = await getAudit(
      authed('http://localhost:3000/api/access/audit?startDate=2025-01-01'),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('GET filters audit log by endDate', async () => {
    const res = await getAudit(authed('http://localhost:3000/api/access/audit?endDate=2099-12-31'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('GET filters audit log by date range', async () => {
    const res = await getAudit(
      authed('http://localhost:3000/api/access/audit?startDate=2025-01-01&endDate=2099-12-31'),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('GET returns 422 for invalid query params', async () => {
    const res = await getAudit(authed('http://localhost:3000/api/access/audit?page=abc'));
    expect(res.status).toBe(422);
  });

  it('GET returns 401 for unauthenticated request', async () => {
    const res = await getAudit(new NextRequest('http://localhost:3000/api/access/audit'));
    expect(res.status).toBe(401);
  });

  it('GET re-throws non-ZodError errors', async () => {
    mockedGenerateMockAuditLog.mockImplementationOnce(() => {
      throw new Error('Unexpected audit error');
    });
    await expect(getAudit(authed('http://localhost:3000/api/access/audit'))).rejects.toThrow(
      'Unexpected audit error',
    );
  });
});
