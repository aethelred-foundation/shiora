/** @jest-environment node */

jest.mock('@/lib/api/middleware', () => {
  const actual = jest.requireActual('@/lib/api/middleware');
  return { ...actual, runMiddleware: jest.fn((...args: unknown[]) => actual.runMiddleware(...args)) };
});

// Mock the content-addressed store so the integrity-failure branch is reachable.
const mockBlocks = new Map<string, Uint8Array>();
jest.mock('@/lib/api/ipfs/ipfs-store', () => {
  const { computeCidV1 } = jest.requireActual('@/lib/crypto/cid');
  return {
    getIPFSStore: () => ({
      put: async (content: Uint8Array) => {
        const cid = computeCidV1(content);
        mockBlocks.set(cid, content);
        return cid;
      },
      get: async (cid: string) => mockBlocks.get(cid),
    }),
  };
});

import { NextRequest, NextResponse } from 'next/server';
import { runMiddleware } from '@/lib/api/middleware';
import { GET as getIPFS } from '@/app/api/ipfs/[cid]/route';
import { POST as uploadIPFS } from '@/app/api/ipfs/upload/route';
import { __resetIpfsForTests } from '@/lib/api/ipfs/ipfs-service';
import { createSessionToken } from '@/lib/api/session';
import { seededAddress } from '@/lib/utils';

const mockedRunMiddleware = runMiddleware as jest.MockedFunction<typeof runMiddleware>;
const USER = seededAddress(300);
const token = createSessionToken(USER).token;

beforeEach(() => {
  mockBlocks.clear();
  __resetIpfsForTests();
});

afterEach(() => {
  mockedRunMiddleware.mockImplementation((...args: unknown[]) => {
    const actual = jest.requireActual('@/lib/api/middleware');
    return actual.runMiddleware(...args);
  });
  __resetIpfsForTests();
});

const UPLOAD = 'http://localhost:3000/api/ipfs/upload';
const blocked = () => mockedRunMiddleware.mockResolvedValueOnce(NextResponse.json({ error: 'blocked' }, { status: 403 }));
const ctx = (cid: string) => ({ params: Promise.resolve({ cid }) });

function uploadReq(authed = true, withFile = true): NextRequest {
  const form = new FormData();
  if (withFile) form.append('file', new File([new TextEncoder().encode('attachment bytes')], 'lab.pdf', { type: 'application/pdf' }));
  const headers: Record<string, string> = {};
  if (authed) headers.authorization = `Bearer ${token}`;
  return new NextRequest(UPLOAD, { method: 'POST', headers, body: form });
}

async function upload(): Promise<string> {
  const res = await uploadIPFS(uploadReq());
  return (await res.json()).data.cid;
}

function authedGet(cid: string): NextRequest {
  return new NextRequest(`http://localhost:3000/api/ipfs/${cid}`, { headers: { authorization: `Bearer ${token}` } });
}

describe('POST /api/ipfs/upload', () => {
  it('returns the middleware error when blocked', async () => {
    blocked();
    expect((await uploadIPFS(uploadReq())).status).toBe(403);
  });

  it('returns 401 when bypassed but unauthenticated', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(null);
    expect((await uploadIPFS(uploadReq(false))).status).toBe(401);
  });

  it('stores a file and returns its real content-derived CID', async () => {
    const res = await uploadIPFS(uploadReq());
    expect(res.status).toBe(201);
    const data = (await res.json()).data;
    expect(data.cid).toMatch(/^bafkrei[a-z2-7]+$/);
    expect(data.pinStatus).toBe('stored');
  });

  it('returns 400 when no file is provided', async () => {
    expect((await uploadIPFS(uploadReq(true, false))).status).toBe(400);
  });

  it('returns 400 when the "file" field is not a file', async () => {
    const form = new FormData();
    form.append('file', 'just-a-string');
    const req = new NextRequest(UPLOAD, { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: form });
    expect((await uploadIPFS(req)).status).toBe(400);
  });

  it('returns 400 for a file over the 100MB size limit', async () => {
    const big = new File([new Uint8Array(100 * 1024 * 1024 + 1)], 'big.bin', { type: 'application/octet-stream' });
    const form = new FormData();
    form.append('file', big);
    const req = new NextRequest(UPLOAD, { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: form });
    expect((await uploadIPFS(req)).status).toBe(400);
  });

  it('defaults the content type when the file has none', async () => {
    const form = new FormData();
    form.append('file', new File([new TextEncoder().encode('x')], 'noext', { type: '' }));
    const req = new NextRequest(UPLOAD, { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: form });
    const res = await uploadIPFS(req);
    expect(res.status).toBe(201);
    expect((await res.json()).data.contentType).toBe('application/octet-stream');
  });

  it('returns 400 for a non-multipart body', async () => {
    const req = new NextRequest(UPLOAD, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
      body: '{"not":"multipart"}',
    });
    expect((await uploadIPFS(req)).status).toBe(400);
  });
});

describe('GET /api/ipfs/[cid]', () => {
  it('returns the middleware error when blocked', async () => {
    blocked();
    const cid = 'bafkreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku';
    expect((await getIPFS(authedGet(cid), ctx(cid))).status).toBe(403);
  });

  it('returns 401 when bypassed but unauthenticated', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(null);
    const cid = 'bafkreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku';
    expect((await getIPFS(new NextRequest(`http://localhost:3000/api/ipfs/${cid}`), ctx(cid))).status).toBe(401);
  });

  it('returns 400 for an invalid CID format', async () => {
    expect((await getIPFS(authedGet('not-a-cid'), ctx('not-a-cid'))).status).toBe(400);
  });

  it('returns 404 for a CID the caller does not own', async () => {
    const cid = 'bafkreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku';
    expect((await getIPFS(authedGet(cid), ctx(cid))).status).toBe(404);
  });

  it('resolves an owned object with integrity-verified content', async () => {
    const cid = await upload();
    const res = await getIPFS(authedGet(cid), ctx(cid));
    expect(res.status).toBe(200);
    const data = (await res.json()).data;
    expect(data.integrityVerified).toBe(true);
    expect(Buffer.from(data.content, 'base64').toString('utf8')).toBe('attachment bytes');
  });

  it('returns 422 when the stored content fails its integrity check', async () => {
    const cid = await upload();
    mockBlocks.set(cid, new TextEncoder().encode('tampered')); // corrupt the blob
    expect((await getIPFS(authedGet(cid), ctx(cid))).status).toBe(422);
  });
});
