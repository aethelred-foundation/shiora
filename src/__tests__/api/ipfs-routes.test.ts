/** @jest-environment node */

jest.mock('@/lib/api/middleware', () => {
  const actual = jest.requireActual('@/lib/api/middleware');
  return {
    ...actual,
    runMiddleware: jest.fn((...args: unknown[]) => actual.runMiddleware(...args)),
  };
});

const actualUtils = jest.requireActual('@/lib/utils');
const mockSeededRandom = jest.fn(actualUtils.seededRandom);
jest.mock('@/lib/utils', () => ({
  ...jest.requireActual('@/lib/utils'),
  seededRandom: (...args: unknown[]) => mockSeededRandom(...args),
}));

import { NextRequest, NextResponse } from 'next/server';
import { runMiddleware } from '@/lib/api/middleware';
import { GET as getIPFS } from '@/app/api/ipfs/[cid]/route';
import { POST as uploadIPFS } from '@/app/api/ipfs/upload/route';
import { createSessionToken } from '@/lib/api/session';
import { seededAddress } from '@/lib/utils';

const mockedRunMiddleware = runMiddleware as jest.MockedFunction<typeof runMiddleware>;

afterEach(() => {
  mockedRunMiddleware.mockImplementation((...args: unknown[]) => {
    const actual = jest.requireActual('@/lib/api/middleware');
    return actual.runMiddleware(...args);
  });
  mockSeededRandom.mockImplementation(actualUtils.seededRandom);
});

const addr = seededAddress(1234);
const { token } = createSessionToken(addr);

function authed(url: string, init?: RequestInit): NextRequest {
  return new NextRequest(url, {
    ...init,
    headers: { ...(init?.headers ?? {}), authorization: `Bearer ${token}` },
  });
}

describe('/api/ipfs/[cid]', () => {
  // Valid base58 CID (46 chars: Qm + 44 base58 chars)
  const validCid = 'QmYwAPJzv5CZsnANr8SSVkFhVbXViqnbi9HbcJdDgi1a2b';

  it('GET returns middleware error when blocked', async () => {
    mockedRunMiddleware.mockReturnValueOnce(
      NextResponse.json({ error: 'blocked' }, { status: 403 }),
    );
    const res = await getIPFS(authed(`http://localhost:3000/api/ipfs/${validCid}`), {
      params: Promise.resolve({ cid: validCid }),
    });
    expect(res.status).toBe(403);
  });

  it('GET returns 401 for unauthenticated request', async () => {
    const res = await getIPFS(new NextRequest(`http://localhost:3000/api/ipfs/${validCid}`), {
      params: Promise.resolve({ cid: validCid }),
    });
    expect(res.status).toBe(401);
  });

  it('GET returns IPFS metadata for valid CID (authenticated)', async () => {
    const res = await getIPFS(authed(`http://localhost:3000/api/ipfs/${validCid}`), {
      params: Promise.resolve({ cid: validCid }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.cid).toBe(validCid);
    expect(body.data.pinStatus).toBeDefined();
    expect(body.data.replication).toBeDefined();
    expect(body.data.nodes).toBeDefined();
    expect(body.data.encryption).toBeDefined();
    expect(body.data.tee).toBeDefined();
  });

  it('GET returns pinning status when seededRandom returns low value', async () => {
    // Force seededRandom to return 0.05 so pinned = false (0.05 <= 0.1)
    mockSeededRandom.mockReturnValue(0.05);
    const res = await getIPFS(authed(`http://localhost:3000/api/ipfs/${validCid}`), {
      params: Promise.resolve({ cid: validCid }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.pinStatus).toBe('pinning');
    expect(body.data.tee.processed).toBe(false);
    expect(body.data.tee.attestationHash).toBeNull();
  });

  it('GET returns 400 for invalid CID format', async () => {
    const res = await getIPFS(authed('http://localhost:3000/api/ipfs/invalid-cid'), {
      params: Promise.resolve({ cid: 'invalid-cid' }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_CID');
  });
});

describe('/api/ipfs/upload', () => {
  it('POST returns middleware error when blocked', async () => {
    mockedRunMiddleware.mockReturnValueOnce(
      NextResponse.json({ error: 'blocked' }, { status: 403 }),
    );
    const formData = new FormData();
    formData.append('file', new File(['test'], 'test.txt', { type: 'text/plain' }));
    const req = new NextRequest('http://localhost:3000/api/ipfs/upload', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
      body: formData,
    });
    const res = await uploadIPFS(req);
    expect(res.status).toBe(403);
  });

  it('POST returns 401 for unauthenticated upload', async () => {
    const formData = new FormData();
    formData.append('file', new File(['test content'], 'test.txt', { type: 'text/plain' }));
    const req = new NextRequest('http://localhost:3000/api/ipfs/upload', {
      method: 'POST',
      body: formData,
    });
    const res = await uploadIPFS(req);
    expect(res.status).toBe(401);
  });

  it('POST uploads a file when authenticated', async () => {
    const formData = new FormData();
    formData.append('file', new File(['test content'], 'test.txt', { type: 'text/plain' }));
    const req = new NextRequest('http://localhost:3000/api/ipfs/upload', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
      body: formData,
    });
    const res = await uploadIPFS(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.cid).toBeDefined();
    expect(body.data.filename).toBe('test.txt');
    expect(body.data.encryption.encrypted).toBe(true);
  });

  it('POST uploads a file without type (defaults to application/octet-stream)', async () => {
    const formData = new FormData();
    formData.append('file', new File(['test'], 'noext', { type: '' }));
    const req = new NextRequest('http://localhost:3000/api/ipfs/upload', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
      body: formData,
    });
    // Override formData to ensure the File has an empty type
    const origFormData = req.formData.bind(req);
    req.formData = async () => {
      const fd = await origFormData();
      const file = fd.get('file') as File;
      const emptyTypeFile = new File([file], file.name);
      Object.defineProperty(emptyTypeFile, 'type', { value: '', configurable: true });
      const newFd = new FormData();
      newFd.append('file', emptyTypeFile);
      return newFd;
    };
    const res = await uploadIPFS(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.contentType).toBe('application/octet-stream');
  });

  it('POST returns 400 when no file field is provided', async () => {
    const formData = new FormData();
    formData.append('other', 'not a file');
    const req = new NextRequest('http://localhost:3000/api/ipfs/upload', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
      body: formData,
    });
    const res = await uploadIPFS(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('NO_FILE');
  });

  it('POST returns 400 for file exceeding 100MB', async () => {
    // Create a request that returns a File with overridden size from formData()
    const formData = new FormData();
    const smallFile = new File(['x'], 'large.bin', { type: 'application/octet-stream' });
    formData.append('file', smallFile);
    const req = new NextRequest('http://localhost:3000/api/ipfs/upload', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
      body: formData,
    });
    // Override the formData method to return a File with large size
    const origFormData = req.formData.bind(req);
    req.formData = async () => {
      const fd = await origFormData();
      const file = fd.get('file') as File;
      const largeFile = new File([file], file.name, { type: file.type });
      Object.defineProperty(largeFile, 'size', { value: 101 * 1024 * 1024 });
      const newFd = new FormData();
      newFd.append('file', largeFile);
      return newFd;
    };
    const res = await uploadIPFS(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('FILE_TOO_LARGE');
  });

  it('POST returns 400 when request body is not multipart', async () => {
    const req = new NextRequest('http://localhost:3000/api/ipfs/upload', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ file: 'not-a-file' }),
    });
    const res = await uploadIPFS(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('UPLOAD_FAILED');
  });
});
