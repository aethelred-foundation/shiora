/** @jest-environment node */

jest.mock('@/lib/api/middleware', () => {
  const actual = jest.requireActual('@/lib/api/middleware');
  return { ...actual, runMiddleware: jest.fn((...args: unknown[]) => actual.runMiddleware(...args)) };
});

jest.mock('@/lib/api/records-service', () => {
  const actual = jest.requireActual('@/lib/api/records-service');
  return {
    ...actual,
    listRecords: jest.fn((...args: unknown[]) => actual.listRecords(...args)),
    updateRecord: jest.fn((...args: unknown[]) => actual.updateRecord(...args)),
    softDeleteRecord: jest.fn((...args: unknown[]) => actual.softDeleteRecord(...args)),
    recordVersion: jest.fn((...args: unknown[]) => actual.recordVersion(...args)),
  };
});

import { NextRequest, NextResponse } from 'next/server';
import { runMiddleware } from '@/lib/api/middleware';
import {
  listRecords as svcListRecords,
  updateRecord as svcUpdateRecord,
  softDeleteRecord as svcSoftDeleteRecord,
  recordVersion as svcRecordVersion,
} from '@/lib/api/records-service';

import { POST as createRecord, GET as listRecords } from '@/app/api/records/route';
import { GET as getRecord, PATCH as patchRecord, DELETE as deleteRecord } from '@/app/api/records/[id]/route';
import { createSessionToken } from '@/lib/api/session';
import { seededAddress } from '@/lib/utils';

const mockedListRecords = svcListRecords as jest.MockedFunction<typeof svcListRecords>;
const mockedUpdateRecord = svcUpdateRecord as jest.MockedFunction<typeof svcUpdateRecord>;
const mockedSoftDeleteRecord = svcSoftDeleteRecord as jest.MockedFunction<typeof svcSoftDeleteRecord>;
const mockedRecordVersion = svcRecordVersion as jest.MockedFunction<typeof svcRecordVersion>;
const actualService = jest.requireActual('@/lib/api/records-service');

const mockedRunMiddleware = runMiddleware as jest.MockedFunction<typeof runMiddleware>;

afterEach(() => {
  mockedRunMiddleware.mockImplementation((...args: unknown[]) => {
    const actual = jest.requireActual('@/lib/api/middleware');
    return actual.runMiddleware(...args);
  });
  mockedListRecords.mockImplementation((...args: unknown[]) => actualService.listRecords(...args));
  mockedUpdateRecord.mockImplementation((...args: unknown[]) => actualService.updateRecord(...args));
  mockedSoftDeleteRecord.mockImplementation((...args: unknown[]) => actualService.softDeleteRecord(...args));
  mockedRecordVersion.mockImplementation((...args: unknown[]) => actualService.recordVersion(...args));
});

function createAuthedRequest(url: string, init: RequestInit, token: string): NextRequest {
  return new NextRequest(url, {
    ...init,
    headers: { ...(init.headers ?? {}), authorization: `Bearer ${token}` },
  });
}

interface RecordPayload {
  type: string;
  label: string;
  provider: string;
  encryption: string;
  description?: string;
  tags?: string[];
}

async function postRecord(token: string, payload: RecordPayload): Promise<{ id: string }> {
  const res = await createRecord(
    createAuthedRequest(
      'http://localhost:3001/api/records',
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) },
      token,
    ),
  );
  const body = await res.json();
  return body.data;
}

async function patchStatus(token: string, id: string, status: string): Promise<void> {
  await patchRecord(
    createAuthedRequest(
      `http://localhost:3001/api/records/${id}`,
      { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) },
      token,
    ),
    { params: Promise.resolve({ id }) },
  );
}

describe('/api/records middleware blocking', () => {
  const address = seededAddress(111);
  const { token } = createSessionToken(address);

  it('GET listRecords returns middleware error when blocked', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(NextResponse.json({ error: 'blocked' }, { status: 403 }));
    const res = await listRecords(createAuthedRequest('http://localhost:3001/api/records', { method: 'GET' }, token));
    expect(res.status).toBe(403);
  });

  it('POST createRecord returns middleware error when blocked', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(NextResponse.json({ error: 'blocked' }, { status: 403 }));
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
    mockedRunMiddleware.mockResolvedValueOnce(NextResponse.json({ error: 'blocked' }, { status: 403 }));
    const res = await getRecord(
      createAuthedRequest('http://localhost:3001/api/records/rec-test', { method: 'GET' }, token),
      { params: Promise.resolve({ id: 'rec-test' }) },
    );
    expect(res.status).toBe(403);
  });

  it('PATCH patchRecord returns middleware error when blocked', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(NextResponse.json({ error: 'blocked' }, { status: 403 }));
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
    mockedRunMiddleware.mockResolvedValueOnce(NextResponse.json({ error: 'blocked' }, { status: 403 }));
    const res = await deleteRecord(
      createAuthedRequest('http://localhost:3001/api/records/rec-test', { method: 'DELETE' }, token),
      { params: Promise.resolve({ id: 'rec-test' }) },
    );
    expect(res.status).toBe(403);
  });
});

describe('/api/records inner requireAuth branches', () => {
  it('GET returns 401 from inner requireAuth when middleware is bypassed', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(null);
    const res = await listRecords(new NextRequest('http://localhost:3001/api/records'));
    expect(res.status).toBe(401);
  });

  it('POST returns 401 from inner requireAuth when middleware is bypassed', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(null);
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
    mockedRunMiddleware.mockResolvedValueOnce(null);
    const res = await getRecord(
      new NextRequest('http://localhost:3001/api/records/rec-test'),
      { params: Promise.resolve({ id: 'rec-test' }) },
    );
    expect(res.status).toBe(401);
  });

  it('PATCH patchRecord returns 401 from inner requireAuth when middleware is bypassed', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(null);
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
    mockedRunMiddleware.mockResolvedValueOnce(null);
    const res = await deleteRecord(
      new NextRequest('http://localhost:3001/api/records/rec-test', { method: 'DELETE' }),
      { params: Promise.resolve({ id: 'rec-test' }) },
    );
    expect(res.status).toBe(401);
  });
});

describe('/api/records empty-start CRUD', () => {
  const address = seededAddress(222);
  const { token } = createSessionToken(address);

  it('a fresh wallet starts with no records', async () => {
    const res = await listRecords(createAuthedRequest('http://localhost:3001/api/records?limit=100', { method: 'GET' }, token));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual([]);
  });

  it('creates, lists, then deletes a record for the authenticated wallet', async () => {
    const created = await postRecord(token, {
      type: 'lab_result',
      label: 'CMP Panel',
      description: 'Comprehensive metabolic panel',
      provider: 'Aethelred General',
      tags: ['routine'],
      encryption: 'AES-256-GCM',
    });
    expect(created.id).toBeDefined();

    const listResponse = await listRecords(
      createAuthedRequest('http://localhost:3001/api/records?page=1&limit=100&q=CMP', { method: 'GET' }, token),
    );
    expect(listResponse.status).toBe(200);
    const listBody = await listResponse.json();
    expect(listBody.data.some((r: { id: string }) => r.id === created.id)).toBe(true);

    const deleteResponse = await deleteRecord(
      createAuthedRequest(`http://localhost:3001/api/records/${created.id}`, { method: 'DELETE' }, token),
      { params: Promise.resolve({ id: created.id }) },
    );
    expect(deleteResponse.status).toBe(200);

    const afterDelete = await listRecords(
      createAuthedRequest('http://localhost:3001/api/records?page=1&limit=100&q=CMP', { method: 'GET' }, token),
    );
    const afterBody = await afterDelete.json();
    expect(afterBody.data.some((r: { id: string }) => r.id === created.id)).toBe(false);
  });
});

describe('/api/records filters, search, and sorting', () => {
  const address = seededAddress(444);
  const { token } = createSessionToken(address);
  let alphaId: string;

  beforeAll(async () => {
    const alpha = await postRecord(token, {
      type: 'lab_result', label: 'Alpha CMP', description: 'd',
      provider: 'Aethelred General', tags: ['routine', 'blood'], encryption: 'AES-256-GCM',
    });
    alphaId = alpha.id;
    await postRecord(token, {
      type: 'imaging', label: 'Beta Scan', description: 'd',
      provider: 'Imaging Center', tags: ['xray'], encryption: 'AES-256-GCM',
    });
    await postRecord(token, {
      type: 'lab_result', label: 'Gamma Panel', description: 'd',
      provider: 'Zeta Clinic', tags: ['genomics'], encryption: 'AES-256-GCM',
    });
    await patchStatus(token, alphaId, 'Verified');
  });

  it('filters by type', async () => {
    const res = await listRecords(createAuthedRequest('http://localhost:3001/api/records?type=lab_result&limit=100', { method: 'GET' }, token));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.length).toBeGreaterThanOrEqual(2);
    body.data.forEach((r: { type: string }) => expect(r.type).toBe('lab_result'));
  });

  it('filters by status', async () => {
    const res = await listRecords(createAuthedRequest('http://localhost:3001/api/records?status=Verified&limit=100', { method: 'GET' }, token));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.length).toBeGreaterThanOrEqual(1);
    body.data.forEach((r: { status: string }) => expect(r.status).toBe('Verified'));
  });

  it('searches by label', async () => {
    const res = await listRecords(createAuthedRequest('http://localhost:3001/api/records?q=alpha&limit=100', { method: 'GET' }, token));
    const body = await res.json();
    expect(body.data.some((r: { id: string }) => r.id === alphaId)).toBe(true);
    expect(body.data.every((r: { label: string }) => r.label.toLowerCase().includes('alpha'))).toBe(true);
  });

  it('searches by provider when label does not match', async () => {
    const res = await listRecords(createAuthedRequest('http://localhost:3001/api/records?q=imaging&limit=100', { method: 'GET' }, token));
    const body = await res.json();
    expect(body.data.length).toBe(1);
    expect(body.data[0].provider).toBe('Imaging Center');
  });

  it('searches by tag when label and provider do not match', async () => {
    const res = await listRecords(createAuthedRequest('http://localhost:3001/api/records?q=genomics&limit=100', { method: 'GET' }, token));
    const body = await res.json();
    expect(body.data.length).toBe(1);
    expect(body.data[0].tags).toContain('genomics');
  });

  it('searches by type when nothing else matches', async () => {
    const res = await listRecords(createAuthedRequest('http://localhost:3001/api/records?q=lab_result&limit=100', { method: 'GET' }, token));
    const body = await res.json();
    expect(body.data.length).toBeGreaterThanOrEqual(2);
    body.data.forEach((r: { type: string }) => expect(r.type).toBe('lab_result'));
  });

  it('returns nothing when the search matches no field', async () => {
    const res = await listRecords(createAuthedRequest('http://localhost:3001/api/records?q=zzznomatch&limit=100', { method: 'GET' }, token));
    const body = await res.json();
    expect(body.data).toEqual([]);
  });

  it('sorts by size descending', async () => {
    const res = await listRecords(createAuthedRequest('http://localhost:3001/api/records?sort=size&order=desc&limit=100', { method: 'GET' }, token));
    const body = await res.json();
    for (let i = 1; i < body.data.length; i++) {
      expect(body.data[i - 1].size).toBeGreaterThanOrEqual(body.data[i].size);
    }
  });

  it('sorts by label ascending', async () => {
    const res = await listRecords(createAuthedRequest('http://localhost:3001/api/records?sort=label&order=asc&limit=100', { method: 'GET' }, token));
    const body = await res.json();
    for (let i = 1; i < body.data.length; i++) {
      expect(body.data[i - 1].label.localeCompare(body.data[i].label)).toBeLessThanOrEqual(0);
    }
  });

  it('sorts by date ascending', async () => {
    const res = await listRecords(createAuthedRequest('http://localhost:3001/api/records?sort=date&order=asc&limit=100', { method: 'GET' }, token));
    const body = await res.json();
    for (let i = 1; i < body.data.length; i++) {
      expect(body.data[i - 1].date).toBeLessThanOrEqual(body.data[i].date);
    }
  });

  it('returns 401 for unauthenticated request', async () => {
    const res = await listRecords(new NextRequest('http://localhost:3001/api/records'));
    expect(res.status).toBe(401);
  });

  it('returns 422 for invalid query params', async () => {
    const res = await listRecords(createAuthedRequest('http://localhost:3001/api/records?page=-1', { method: 'GET' }, token));
    expect(res.status).toBe(422);
  });

  it('creates a record without a description (uses default)', async () => {
    const res = await createRecord(
      createAuthedRequest('http://localhost:3001/api/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'lab_result', label: 'No Description', provider: 'Default Provider', encryption: 'AES-256-GCM' }),
      }, token),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.description).toContain('Health record created at');
  });

  it('returns 422 for an invalid create body', async () => {
    const res = await createRecord(
      createAuthedRequest('http://localhost:3001/api/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'invalid_type' }),
      }, token),
    );
    expect(res.status).toBe(422);
  });

  it('re-throws a non-Zod error from the datastore', async () => {
    mockedListRecords.mockImplementationOnce(() => {
      throw new Error('DB connection lost');
    });
    await expect(
      listRecords(createAuthedRequest('http://localhost:3001/api/records', { method: 'GET' }, token)),
    ).rejects.toThrow('DB connection lost');
  });

  it('throws on an invalid JSON create body (non-Zod error)', async () => {
    await expect(
      createRecord(
        createAuthedRequest('http://localhost:3001/api/records', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: 'not-json',
        }, token),
      ),
    ).rejects.toThrow();
  });
});

describe('/api/records/[id] GET, PATCH, DELETE', () => {
  const address = seededAddress(333);
  const { token } = createSessionToken(address);
  let recordId: string;

  beforeAll(async () => {
    const created = await postRecord(token, {
      type: 'imaging', label: 'Chest X-Ray', description: 'Annual chest imaging',
      provider: 'Imaging Center', tags: ['imaging'], encryption: 'AES-256-GCM',
    });
    recordId = created.id;
  });

  it('GET returns honest cryptography metadata with no IPFS/TEE/chain theater', async () => {
    const res = await getRecord(
      createAuthedRequest(`http://localhost:3001/api/records/${recordId}`, { method: 'GET' }, token),
      { params: Promise.resolve({ id: recordId }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.id).toBe(recordId);
    expect(body.data.cryptography).toEqual({
      encryption: 'AES-256-GCM',
      ivLength: 12,
      tagLength: 128,
    });
    // No fabricated IPFS pinning, TEE attestation, or on-chain anchoring.
    expect(body.data.ipfs).toBeUndefined();
    expect(body.data.tee).toBeUndefined();
    expect(body.data.cryptography.cid).toBeUndefined();
    expect(body.data.cryptography.attestation).toBeUndefined();
  });

  it('GET returns 404 for a nonexistent record', async () => {
    const res = await getRecord(
      createAuthedRequest('http://localhost:3001/api/records/rec-nonexistent', { method: 'GET' }, token),
      { params: Promise.resolve({ id: 'rec-nonexistent' }) },
    );
    expect(res.status).toBe(404);
  });

  it('PATCH updates the label and tags (re-sealing PHI)', async () => {
    const res = await patchRecord(
      createAuthedRequest(`http://localhost:3001/api/records/${recordId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: 'Updated Chest X-Ray', tags: ['imaging', 'annual'] }),
      }, token),
      { params: Promise.resolve({ id: recordId }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.label).toBe('Updated Chest X-Ray');
    expect(body.data.tags).toEqual(['imaging', 'annual']);
  });

  it('PATCH updates the description and status', async () => {
    const res = await patchRecord(
      createAuthedRequest(`http://localhost:3001/api/records/${recordId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: 'Updated desc', status: 'Verified' }),
      }, token),
      { params: Promise.resolve({ id: recordId }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.description).toBe('Updated desc');
    expect(body.data.status).toBe('Verified');
  });

  it('PATCH updates the label only', async () => {
    const res = await patchRecord(
      createAuthedRequest(`http://localhost:3001/api/records/${recordId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: 'Label Only' }),
      }, token),
      { params: Promise.resolve({ id: recordId }) },
    );
    expect(res.status).toBe(200);
    expect((await res.json()).data.label).toBe('Label Only');
  });

  it('PATCH updates the tags only', async () => {
    const res = await patchRecord(
      createAuthedRequest(`http://localhost:3001/api/records/${recordId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: ['solo-tag'] }),
      }, token),
      { params: Promise.resolve({ id: recordId }) },
    );
    expect(res.status).toBe(200);
    expect((await res.json()).data.tags).toEqual(['solo-tag']);
  });

  it('PATCH returns 404 for a nonexistent record', async () => {
    const res = await patchRecord(
      createAuthedRequest('http://localhost:3001/api/records/rec-nonexistent', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: 'Updated' }),
      }, token),
      { params: Promise.resolve({ id: 'rec-nonexistent' }) },
    );
    expect(res.status).toBe(404);
  });

  it('PATCH returns 422 for an invalid body', async () => {
    const res = await patchRecord(
      createAuthedRequest(`http://localhost:3001/api/records/${recordId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'invalid_status' }),
      }, token),
      { params: Promise.resolve({ id: recordId }) },
    );
    expect(res.status).toBe(422);
  });

  it('PATCH throws on an invalid JSON body (non-Zod error)', async () => {
    await expect(
      patchRecord(
        createAuthedRequest(`http://localhost:3001/api/records/${recordId}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: 'not-json',
        }, token),
        { params: Promise.resolve({ id: recordId }) },
      ),
    ).rejects.toThrow();
  });

  it('PATCH returns 404 when the datastore update returns nothing', async () => {
    mockedUpdateRecord.mockResolvedValueOnce(undefined);
    const res = await patchRecord(
      createAuthedRequest(`http://localhost:3001/api/records/${recordId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: 'Will Fail' }),
      }, token),
      { params: Promise.resolve({ id: recordId }) },
    );
    expect(res.status).toBe(404);
  });

  it('DELETE returns 404 when the datastore delete returns nothing', async () => {
    mockedSoftDeleteRecord.mockResolvedValueOnce(undefined);
    const res = await deleteRecord(
      createAuthedRequest(`http://localhost:3001/api/records/${recordId}`, { method: 'DELETE' }, token),
      { params: Promise.resolve({ id: recordId }) },
    );
    expect(res.status).toBe(404);
  });

  it('GET returns 401 for an unauthenticated request', async () => {
    const res = await getRecord(
      new NextRequest(`http://localhost:3001/api/records/${recordId}`),
      { params: Promise.resolve({ id: recordId }) },
    );
    expect(res.status).toBe(401);
  });

  it('DELETE returns 401 for an unauthenticated request', async () => {
    const res = await deleteRecord(
      new NextRequest(`http://localhost:3001/api/records/${recordId}`, { method: 'DELETE' }),
      { params: Promise.resolve({ id: recordId }) },
    );
    expect(res.status).toBe(401);
  });

  it('DELETE returns 404 for a nonexistent record', async () => {
    const res = await deleteRecord(
      createAuthedRequest('http://localhost:3001/api/records/rec-nonexistent', { method: 'DELETE' }, token),
      { params: Promise.resolve({ id: 'rec-nonexistent' }) },
    );
    expect(res.status).toBe(404);
  });

  it('DELETE soft-deletes an existing record', async () => {
    const created = await postRecord(token, {
      type: 'lab_result', label: 'To Delete', provider: 'P', encryption: 'AES-256-GCM',
    });
    const res = await deleteRecord(
      createAuthedRequest(`http://localhost:3001/api/records/${created.id}`, { method: 'DELETE' }, token),
      { params: Promise.resolve({ id: created.id }) },
    );
    expect(res.status).toBe(200);
    expect((await res.json()).data.deleted).toBe(true);
  });
});

describe('/api/records POST idempotency (GAP-17)', () => {
  const address = seededAddress(717);
  const { token } = createSessionToken(address);

  afterEach(() => {
    const { __resetIdempotencyStoreForTests } = jest.requireActual('@/lib/persistence/idempotency-store');
    __resetIdempotencyStoreForTests();
  });

  function createWithKey(key: string) {
    return createRecord(createAuthedRequest('http://localhost:3001/api/records', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
      body: JSON.stringify({ type: 'lab_result', label: 'Idempotent', provider: 'Lab', encryption: 'AES-256-GCM' }),
    }, token));
  }

  it('a retried create with the same key replays the first record, not a duplicate', async () => {
    const first = await createWithKey('create-once');
    expect(first.status).toBe(201);
    const firstId = (await first.json()).data.id;

    const retry = await createWithKey('create-once');
    expect(retry.status).toBe(201);
    expect(retry.headers.get('Idempotent-Replayed')).toBe('true');
    expect((await retry.json()).data.id).toBe(firstId); // same record, no duplicate

    // Exactly one record exists for the wallet.
    const list = await listRecords(createAuthedRequest('http://localhost:3001/api/records?limit=100', { method: 'GET' }, token));
    expect((await list.json()).data.filter((r: { label: string }) => r.label === 'Idempotent')).toHaveLength(1);
  });
});

describe('/api/records/[id] optimistic concurrency (GAP-18)', () => {
  const address = seededAddress(818);
  const { token } = createSessionToken(address);

  async function create(): Promise<string> {
    const res = await createRecord(createAuthedRequest('http://localhost:3001/api/records', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'lab_result', label: 'Versioned', provider: 'Lab', encryption: 'AES-256-GCM' }),
    }, token));
    return (await res.json()).data.id;
  }

  function patch(id: string, body: unknown, ifMatch?: string) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (ifMatch !== undefined) headers['If-Match'] = ifMatch;
    return patchRecord(
      createAuthedRequest(`http://localhost:3001/api/records/${id}`, { method: 'PATCH', headers, body: JSON.stringify(body) }, token),
      { params: Promise.resolve({ id }) },
    );
  }

  it('GET exposes the version and an ETag', async () => {
    const id = await create();
    const res = await getRecord(
      createAuthedRequest(`http://localhost:3001/api/records/${id}`, { method: 'GET' }, token),
      { params: Promise.resolve({ id }) },
    );
    expect(res.status).toBe(200);
    expect((await res.json()).data.version).toBe(1);
    expect(res.headers.get('ETag')).toBe('"1"');
  });

  it('accepts a PATCH with the matching If-Match and advances the version', async () => {
    const id = await create();
    const res = await patch(id, { status: 'Pinned' }, '"1"');
    expect(res.status).toBe(200);
    expect((await res.json()).data.version).toBe(2);
    expect(res.headers.get('ETag')).toBe('"2"');
  });

  it('rejects a PATCH whose If-Match is stale with 412', async () => {
    const id = await create();
    await patch(id, { status: 'Pinned' }, '"1"'); // moves to version 2
    const conflict = await patch(id, { status: 'Verified' }, '"1"'); // stale
    expect(conflict.status).toBe(412);
    expect((await conflict.json()).error.code).toBe('VERSION_CONFLICT');
  });

  it('rejects a malformed If-Match with 400', async () => {
    const id = await create();
    const res = await patch(id, { status: 'Pinned' }, 'not-a-number');
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('INVALID_IF_MATCH');
  });

  it('without If-Match, updates last-write-wins (backward compatible)', async () => {
    const id = await create();
    const res = await patch(id, { status: 'Pinned' });
    expect(res.status).toBe(200);
    expect((await res.json()).data.version).toBe(2);
  });

  it('omits the ETag on GET when the version is unavailable', async () => {
    const id = await create();
    mockedRecordVersion.mockResolvedValueOnce(undefined);
    const res = await getRecord(
      createAuthedRequest(`http://localhost:3001/api/records/${id}`, { method: 'GET' }, token),
      { params: Promise.resolve({ id }) },
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('ETag')).toBeNull();
    expect((await res.json()).data.version).toBeUndefined();
  });

  it('omits the ETag on PATCH when the new version is unavailable', async () => {
    const id = await create();
    mockedRecordVersion.mockResolvedValueOnce(undefined);
    const res = await patch(id, { status: 'Pinned' });
    expect(res.status).toBe(200);
    expect(res.headers.get('ETag')).toBeNull();
  });
});
