/** @jest-environment node */

jest.mock('@/lib/api/middleware', () => {
  const actual = jest.requireActual('@/lib/api/middleware');
  return { ...actual, runMiddleware: jest.fn((...args: unknown[]) => actual.runMiddleware(...args)) };
});

jest.mock('@/lib/api/store', () => {
  const actual = jest.requireActual('@/lib/api/store');
  return {
    ...actual,
    listRecords: jest.fn((...args: unknown[]) => actual.listRecords(...args)),
    updateRecord: jest.fn((...args: unknown[]) => actual.updateRecord(...args)),
    softDeleteRecord: jest.fn((...args: unknown[]) => actual.softDeleteRecord(...args)),
  };
});

import { NextRequest, NextResponse } from 'next/server';
import { runMiddleware } from '@/lib/api/middleware';
import { listRecords as storeListRecords, updateRecord as storeUpdateRecord, softDeleteRecord as storeSoftDeleteRecord } from '@/lib/api/store';

import { POST as createRecord, GET as listRecords } from '@/app/api/records/route';
import { GET as getRecord, PATCH as patchRecord, DELETE as deleteRecord } from '@/app/api/records/[id]/route';
import { createSessionToken } from '@/lib/api/session';
import { seededAddress } from '@/lib/utils';

const mockedStoreListRecords = storeListRecords as jest.MockedFunction<typeof storeListRecords>;
const mockedStoreUpdateRecord = storeUpdateRecord as jest.MockedFunction<typeof storeUpdateRecord>;
const mockedStoreSoftDeleteRecord = storeSoftDeleteRecord as jest.MockedFunction<typeof storeSoftDeleteRecord>;
const actualStore = jest.requireActual('@/lib/api/store');

const mockedRunMiddleware = runMiddleware as jest.MockedFunction<typeof runMiddleware>;

afterEach(() => {
  mockedRunMiddleware.mockImplementation((...args: unknown[]) => {
    const actual = jest.requireActual('@/lib/api/middleware');
    return actual.runMiddleware(...args);
  });
  mockedStoreListRecords.mockImplementation((...args: unknown[]) => actualStore.listRecords(...args));
  mockedStoreUpdateRecord.mockImplementation((...args: unknown[]) => actualStore.updateRecord(...args));
  mockedStoreSoftDeleteRecord.mockImplementation((...args: unknown[]) => actualStore.softDeleteRecord(...args));
});

function createAuthedRequest(
  url: string,
  init: RequestInit,
  token: string,
): NextRequest {
  return new NextRequest(url, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      authorization: `Bearer ${token}`,
    },
  });
}

describe('/api/records middleware blocking', () => {
  const address = seededAddress(111);
  const { token } = createSessionToken(address);

  it('GET listRecords returns middleware error when blocked', async () => {
    mockedRunMiddleware.mockReturnValueOnce(NextResponse.json({ error: 'blocked' }, { status: 403 }));
    const res = await listRecords(createAuthedRequest('http://localhost:3001/api/records', { method: 'GET' }, token));
    expect(res.status).toBe(403);
  });

  it('POST createRecord returns middleware error when blocked', async () => {
    mockedRunMiddleware.mockReturnValueOnce(NextResponse.json({ error: 'blocked' }, { status: 403 }));
    const res = await createRecord(
      createAuthedRequest('http://localhost:3001/api/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'lab_result', label: 'Test' }),
      }, token),
    );
    expect(res.status).toBe(403);
  });

  it('GET getRecord returns middleware error when blocked', async () => {
    mockedRunMiddleware.mockReturnValueOnce(NextResponse.json({ error: 'blocked' }, { status: 403 }));
    const res = await getRecord(
      createAuthedRequest('http://localhost:3001/api/records/rec-test', { method: 'GET' }, token),
      { params: Promise.resolve({ id: 'rec-test' }) },
    );
    expect(res.status).toBe(403);
  });

  it('PATCH patchRecord returns middleware error when blocked', async () => {
    mockedRunMiddleware.mockReturnValueOnce(NextResponse.json({ error: 'blocked' }, { status: 403 }));
    const res = await patchRecord(
      createAuthedRequest('http://localhost:3001/api/records/rec-test', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: 'Updated' }),
      }, token),
      { params: Promise.resolve({ id: 'rec-test' }) },
    );
    expect(res.status).toBe(403);
  });

  it('DELETE deleteRecord returns middleware error when blocked', async () => {
    mockedRunMiddleware.mockReturnValueOnce(NextResponse.json({ error: 'blocked' }, { status: 403 }));
    const res = await deleteRecord(
      createAuthedRequest('http://localhost:3001/api/records/rec-test', { method: 'DELETE' }, token),
      { params: Promise.resolve({ id: 'rec-test' }) },
    );
    expect(res.status).toBe(403);
  });
});

describe('/api/records inner requireAuth branches', () => {
  it('GET returns 401 from inner requireAuth when middleware is bypassed', async () => {
    mockedRunMiddleware.mockReturnValueOnce(null);
    const res = await listRecords(new NextRequest('http://localhost:3001/api/records'));
    expect(res.status).toBe(401);
  });

  it('POST returns 401 from inner requireAuth when middleware is bypassed', async () => {
    mockedRunMiddleware.mockReturnValueOnce(null);
    const res = await createRecord(
      new NextRequest('http://localhost:3001/api/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'lab_result', label: 'Test', provider: 'Test', encryption: 'AES-256-GCM' }),
      }),
    );
    expect(res.status).toBe(401);
  });

  it('GET getRecord returns 401 from inner requireAuth when middleware is bypassed', async () => {
    mockedRunMiddleware.mockReturnValueOnce(null);
    const res = await getRecord(
      new NextRequest('http://localhost:3001/api/records/rec-test'),
      { params: Promise.resolve({ id: 'rec-test' }) },
    );
    expect(res.status).toBe(401);
  });

  it('PATCH patchRecord returns 401 from inner requireAuth when middleware is bypassed', async () => {
    mockedRunMiddleware.mockReturnValueOnce(null);
    const res = await patchRecord(
      new NextRequest('http://localhost:3001/api/records/rec-test', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: 'Updated' }),
      }),
      { params: Promise.resolve({ id: 'rec-test' }) },
    );
    expect(res.status).toBe(401);
  });

  it('DELETE deleteRecord returns 401 from inner requireAuth when middleware is bypassed', async () => {
    mockedRunMiddleware.mockReturnValueOnce(null);
    const res = await deleteRecord(
      new NextRequest('http://localhost:3001/api/records/rec-test', { method: 'DELETE' }),
      { params: Promise.resolve({ id: 'rec-test' }) },
    );
    expect(res.status).toBe(401);
  });
});

describe('/api/records route handlers', () => {
  it('creates, lists, and deletes records for the authenticated wallet', async () => {
    const address = seededAddress(222);
    const { token } = createSessionToken(address);

    const createResponse = await createRecord(
      createAuthedRequest(
        'http://localhost:3001/api/records',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'lab_result',
            label: 'CMP Panel',
            description: 'Comprehensive metabolic panel',
            provider: 'Aethelred General',
            tags: ['routine'],
            encryption: 'AES-256-GCM',
          }),
        },
        token,
      ),
    );

    expect(createResponse.status).toBe(201);
    const createdBody = await createResponse.json();
    expect(createdBody.success).toBe(true);
    expect(createdBody.data.ownerAddress).toBe(address);

    const listResponse = await listRecords(
      createAuthedRequest(
        'http://localhost:3001/api/records?page=1&limit=100&q=CMP',
        { method: 'GET' },
        token,
      ),
    );

    expect(listResponse.status).toBe(200);
    const listBody = await listResponse.json();
    expect(
      listBody.data.some((record: { id: string }) => record.id === createdBody.data.id),
    ).toBe(true);

    const deleteResponse = await deleteRecord(
      createAuthedRequest(
        `http://localhost:3001/api/records/${createdBody.data.id}`,
        { method: 'DELETE' },
        token,
      ),
      {
        params: Promise.resolve({ id: createdBody.data.id }),
      },
    );

    expect(deleteResponse.status).toBe(200);

    const afterDeleteResponse = await listRecords(
      createAuthedRequest(
        'http://localhost:3001/api/records?page=1&limit=100&q=CMP',
        { method: 'GET' },
        token,
      ),
    );
    const afterDeleteBody = await afterDeleteResponse.json();

    expect(
      afterDeleteBody.data.some((record: { id: string }) => record.id === createdBody.data.id),
    ).toBe(false);
  });
});

describe('/api/records additional filters and branches', () => {
  const address = seededAddress(444);
  const { token } = createSessionToken(address);

  it('GET filters by type', async () => {
    const res = await listRecords(
      createAuthedRequest(
        'http://localhost:3001/api/records?type=lab_result',
        { method: 'GET' },
        token,
      ),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    body.data.forEach((r: { type: string }) => {
      expect(r.type).toBe('lab_result');
    });
  });

  it('GET filters by status', async () => {
    const res = await listRecords(
      createAuthedRequest(
        'http://localhost:3001/api/records?status=Verified',
        { method: 'GET' },
        token,
      ),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    body.data.forEach((r: { status: string }) => {
      expect(r.status).toBe('Verified');
    });
  });

  it('GET sorts by size descending', async () => {
    const res = await listRecords(
      createAuthedRequest(
        'http://localhost:3001/api/records?sort=size&order=desc',
        { method: 'GET' },
        token,
      ),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    for (let i = 1; i < body.data.length; i++) {
      expect(body.data[i - 1].size).toBeGreaterThanOrEqual(body.data[i].size);
    }
  });

  it('GET sorts by label ascending', async () => {
    const res = await listRecords(
      createAuthedRequest(
        'http://localhost:3001/api/records?sort=label&order=asc',
        { method: 'GET' },
        token,
      ),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    for (let i = 1; i < body.data.length; i++) {
      expect(body.data[i - 1].label.localeCompare(body.data[i].label)).toBeLessThanOrEqual(0);
    }
  });

  it('GET returns 401 for unauthenticated request', async () => {
    const res = await listRecords(
      new NextRequest('http://localhost:3001/api/records'),
    );
    expect(res.status).toBe(401);
  });

  it('GET returns 422 for invalid query params', async () => {
    const res = await listRecords(
      createAuthedRequest(
        'http://localhost:3001/api/records?page=-1',
        { method: 'GET' },
        token,
      ),
    );
    expect(res.status).toBe(422);
  });

  it('POST creates record without description (uses default)', async () => {
    const res = await createRecord(
      createAuthedRequest(
        'http://localhost:3001/api/records',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'lab_result',
            label: 'No Description Record',
            provider: 'Default Provider',
            encryption: 'AES-256-GCM',
          }),
        },
        token,
      ),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.description).toContain('Encrypted health record uploaded at');
  });

  it('GET sorts by date ascending (default sort)', async () => {
    const res = await listRecords(
      createAuthedRequest(
        'http://localhost:3001/api/records?sort=date&order=asc',
        { method: 'GET' },
        token,
      ),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    for (let i = 1; i < body.data.length; i++) {
      expect(body.data[i - 1].date).toBeLessThanOrEqual(body.data[i].date);
    }
  });

  it('POST returns 422 for invalid body', async () => {
    const res = await createRecord(
      createAuthedRequest(
        'http://localhost:3001/api/records',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'invalid_type' }),
        },
        token,
      ),
    );
    expect(res.status).toBe(422);
  });
});

describe('/api/records/[id] GET and PATCH', () => {
  const address = seededAddress(333);
  const { token } = createSessionToken(address);
  let recordId: string;

  beforeAll(async () => {
    const res = await createRecord(
      createAuthedRequest(
        'http://localhost:3001/api/records',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'imaging',
            label: 'Chest X-Ray',
            description: 'Annual chest imaging',
            provider: 'Imaging Center',
            tags: ['imaging'],
            encryption: 'AES-256-GCM',
          }),
        },
        token,
      ),
    );
    const body = await res.json();
    recordId = body.data.id;
  });

  it('GET returns full record with cryptography details', async () => {
    const res = await getRecord(
      createAuthedRequest(
        `http://localhost:3001/api/records/${recordId}`,
        { method: 'GET' },
        token,
      ),
      { params: Promise.resolve({ id: recordId }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(recordId);
    expect(body.data.cryptography).toBeDefined();
    expect(body.data.ipfs).toBeDefined();
    expect(body.data.tee).toBeDefined();
  });

  it('GET returns pinned status for Verified record', async () => {
    // Patch record to Verified status
    await patchRecord(
      createAuthedRequest(
        `http://localhost:3001/api/records/${recordId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'Verified' }),
        },
        token,
      ),
      { params: Promise.resolve({ id: recordId }) },
    );

    const res = await getRecord(
      createAuthedRequest(
        `http://localhost:3001/api/records/${recordId}`,
        { method: 'GET' },
        token,
      ),
      { params: Promise.resolve({ id: recordId }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.ipfs.pinStatus).toBe('pinned');
    expect(body.data.tee.verified).toBe(true);
  });

  it('GET returns 404 for nonexistent record', async () => {
    const res = await getRecord(
      createAuthedRequest(
        'http://localhost:3001/api/records/rec-nonexistent',
        { method: 'GET' },
        token,
      ),
      { params: Promise.resolve({ id: 'rec-nonexistent' }) },
    );
    expect(res.status).toBe(404);
  });

  it('PATCH updates record metadata', async () => {
    const res = await patchRecord(
      createAuthedRequest(
        `http://localhost:3001/api/records/${recordId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ label: 'Updated Chest X-Ray', tags: ['imaging', 'annual'] }),
        },
        token,
      ),
      { params: Promise.resolve({ id: recordId }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.label).toBe('Updated Chest X-Ray');
  });

  it('PATCH updates description and status fields', async () => {
    const res = await patchRecord(
      createAuthedRequest(
        `http://localhost:3001/api/records/${recordId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ description: 'Updated desc', status: 'Verified' }),
        },
        token,
      ),
      { params: Promise.resolve({ id: recordId }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.description).toBe('Updated desc');
    expect(body.data.status).toBe('Verified');
  });

  it('GET returns verified=true for record with Verified status', async () => {
    await patchRecord(
      createAuthedRequest(
        `http://localhost:3001/api/records/${recordId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'Verified' }),
        },
        token,
      ),
      { params: Promise.resolve({ id: recordId }) },
    );
    const res = await getRecord(
      createAuthedRequest(
        `http://localhost:3001/api/records/${recordId}`,
        { method: 'GET' },
        token,
      ),
      { params: Promise.resolve({ id: recordId }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.ipfs.pinStatus).toBe('pinned');
    expect(body.data.tee.verified).toBe(true);
  });

  it('GET returns pinned status for record with Pinned status', async () => {
    await patchRecord(
      createAuthedRequest(
        `http://localhost:3001/api/records/${recordId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'Pinned' }),
        },
        token,
      ),
      { params: Promise.resolve({ id: recordId }) },
    );
    const res = await getRecord(
      createAuthedRequest(
        `http://localhost:3001/api/records/${recordId}`,
        { method: 'GET' },
        token,
      ),
      { params: Promise.resolve({ id: recordId }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.ipfs.pinStatus).toBe('pinned');
  });

  it('GET returns pinning status for record with Pinning status', async () => {
    // First update status to Pinning
    await patchRecord(
      createAuthedRequest(
        `http://localhost:3001/api/records/${recordId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'Pinning' }),
        },
        token,
      ),
      { params: Promise.resolve({ id: recordId }) },
    );
    // Now GET the record — should show pinStatus: 'pinning'
    const res = await getRecord(
      createAuthedRequest(
        `http://localhost:3001/api/records/${recordId}`,
        { method: 'GET' },
        token,
      ),
      { params: Promise.resolve({ id: recordId }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.ipfs.pinStatus).toBe('pinning');
    expect(body.data.tee.verified).toBe(false);
  });

  it('GET returns 401 for unauthenticated request', async () => {
    const res = await getRecord(
      new NextRequest(`http://localhost:3001/api/records/${recordId}`),
      { params: Promise.resolve({ id: recordId }) },
    );
    expect(res.status).toBe(401);
  });

  it('GET returns 401 from inner requireAuth when middleware bypassed', async () => {
    mockedRunMiddleware.mockReturnValueOnce(null);
    const res = await getRecord(
      new NextRequest(`http://localhost:3001/api/records/${recordId}`),
      { params: Promise.resolve({ id: recordId }) },
    );
    expect(res.status).toBe(401);
  });

  it('PATCH returns 401 from inner requireAuth when middleware bypassed', async () => {
    mockedRunMiddleware.mockReturnValueOnce(null);
    const res = await patchRecord(
      new NextRequest(`http://localhost:3001/api/records/${recordId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: 'Test' }),
      }),
      { params: Promise.resolve({ id: recordId }) },
    );
    expect(res.status).toBe(401);
  });

  it('DELETE returns 401 from inner requireAuth when middleware bypassed', async () => {
    mockedRunMiddleware.mockReturnValueOnce(null);
    const res = await deleteRecord(
      new NextRequest(`http://localhost:3001/api/records/${recordId}`, { method: 'DELETE' }),
      { params: Promise.resolve({ id: recordId }) },
    );
    expect(res.status).toBe(401);
  });

  it('PATCH updates label only', async () => {
    const res = await patchRecord(
      createAuthedRequest(
        `http://localhost:3001/api/records/${recordId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ label: 'Label Only' }),
        },
        token,
      ),
      { params: Promise.resolve({ id: recordId }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.label).toBe('Label Only');
  });

  it('PATCH updates tags only', async () => {
    const res = await patchRecord(
      createAuthedRequest(
        `http://localhost:3001/api/records/${recordId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tags: ['solo-tag'] }),
        },
        token,
      ),
      { params: Promise.resolve({ id: recordId }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.tags).toEqual(['solo-tag']);
  });

  it('PATCH returns 404 for nonexistent record', async () => {
    const res = await patchRecord(
      createAuthedRequest(
        'http://localhost:3001/api/records/rec-nonexistent',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ label: 'Updated' }),
        },
        token,
      ),
      { params: Promise.resolve({ id: 'rec-nonexistent' }) },
    );
    expect(res.status).toBe(404);
  });

  it('PATCH returns 422 for invalid body', async () => {
    const res = await patchRecord(
      createAuthedRequest(
        `http://localhost:3001/api/records/${recordId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'invalid_status' }),
        },
        token,
      ),
      { params: Promise.resolve({ id: recordId }) },
    );
    expect(res.status).toBe(422);
  });

  it('PATCH throws on invalid JSON body (non-Zod error)', async () => {
    await expect(
      patchRecord(
        createAuthedRequest(
          `http://localhost:3001/api/records/${recordId}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: 'not-json',
          },
          token,
        ),
        { params: Promise.resolve({ id: recordId }) },
      ),
    ).rejects.toThrow();
  });

  it('POST throws on invalid JSON body (non-Zod error)', async () => {
    await expect(
      createRecord(
        createAuthedRequest(
          'http://localhost:3001/api/records',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: 'not-json',
          },
          token,
        ),
      ),
    ).rejects.toThrow();
  });

  it('GET re-throws non-ZodError in catch block', async () => {
    mockedStoreListRecords.mockImplementationOnce(() => {
      throw new Error('DB connection lost');
    });
    await expect(
      listRecords(
        createAuthedRequest(
          'http://localhost:3001/api/records',
          { method: 'GET' },
          token,
        ),
      ),
    ).rejects.toThrow('DB connection lost');
  });

  it('PATCH returns 404 when updateRecord returns null', async () => {
    mockedStoreUpdateRecord.mockReturnValueOnce(undefined as never);
    const res = await patchRecord(
      createAuthedRequest(
        `http://localhost:3001/api/records/${recordId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ label: 'Will Fail' }),
        },
        token,
      ),
      { params: Promise.resolve({ id: recordId }) },
    );
    expect(res.status).toBe(404);
  });

  it('DELETE returns 404 when softDeleteRecord returns null', async () => {
    mockedStoreSoftDeleteRecord.mockReturnValueOnce(undefined as never);
    const res = await deleteRecord(
      createAuthedRequest(
        `http://localhost:3001/api/records/${recordId}`,
        { method: 'DELETE' },
        token,
      ),
      { params: Promise.resolve({ id: recordId }) },
    );
    expect(res.status).toBe(404);
  });

  it('DELETE returns 401 for unauthenticated request', async () => {
    const res = await deleteRecord(
      new NextRequest(`http://localhost:3001/api/records/${recordId}`, { method: 'DELETE' }),
      { params: Promise.resolve({ id: recordId }) },
    );
    expect(res.status).toBe(401);
  });

  it('DELETE returns 404 for nonexistent record', async () => {
    const res = await deleteRecord(
      createAuthedRequest(
        'http://localhost:3001/api/records/rec-nonexistent',
        { method: 'DELETE' },
        token,
      ),
      { params: Promise.resolve({ id: 'rec-nonexistent' }) },
    );
    expect(res.status).toBe(404);
  });
});
