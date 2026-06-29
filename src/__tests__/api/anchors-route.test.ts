/** @jest-environment node */

jest.mock('@/lib/api/middleware', () => {
  const actual = jest.requireActual('@/lib/api/middleware');
  return { ...actual, runMiddleware: jest.fn((...args: unknown[]) => actual.runMiddleware(...args)) };
});

import { NextRequest, NextResponse } from 'next/server';
import { runMiddleware } from '@/lib/api/middleware';
import { GET, POST } from '@/app/api/anchors/route';
import { __resetAuditLogForTests } from '@/lib/api/audit-log';
import { __resetAnchorRepositoryForTests } from '@/lib/api/anchoring/anchor-service';
import { __resetAnchorClientForTests } from '@/lib/api/anchoring/anchor-client';
import { createSessionToken } from '@/lib/api/session';
import { seededAddress } from '@/lib/utils';

const mockedRunMiddleware = runMiddleware as jest.MockedFunction<typeof runMiddleware>;

const ADMIN = seededAddress(700);
const USER = seededAddress(701);
const adminToken = createSessionToken(ADMIN).token;
const userToken = createSessionToken(USER).token;
const originalAdmins = process.env.SHIORA_ADMIN_ADDRESSES;
const URL = 'http://localhost:3000/api/anchors';

function req(token?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (token) headers.authorization = `Bearer ${token}`;
  return new NextRequest(URL, { headers });
}

beforeEach(() => {
  process.env.SHIORA_ADMIN_ADDRESSES = ADMIN;
  __resetAuditLogForTests();
  __resetAnchorRepositoryForTests();
  __resetAnchorClientForTests();
});

afterEach(() => {
  if (originalAdmins === undefined) delete process.env.SHIORA_ADMIN_ADDRESSES;
  else process.env.SHIORA_ADMIN_ADDRESSES = originalAdmins;
  mockedRunMiddleware.mockImplementation((...args: unknown[]) => {
    const actual = jest.requireActual('@/lib/api/middleware');
    return actual.runMiddleware(...args);
  });
});

describe('GET /api/anchors', () => {
  it('returns the middleware error when blocked', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(NextResponse.json({ error: 'blocked' }, { status: 403 }));
    expect((await GET(req(adminToken))).status).toBe(403);
  });

  it('rejects a non-admin caller', async () => {
    expect((await GET(req(userToken))).status).toBe(403);
  });

  it('lists anchors and verifies the series for an admin', async () => {
    await POST(req(adminToken)); // seed one anchor
    const res = await GET(req(adminToken));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.anchors).toHaveLength(1);
    expect(body.data.verification).toEqual({ valid: true, length: 1 });
  });
});

describe('POST /api/anchors', () => {
  it('returns the middleware error when blocked', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(NextResponse.json({ error: 'blocked' }, { status: 403 }));
    expect((await POST(req(adminToken))).status).toBe(403);
  });

  it('rejects a non-admin caller', async () => {
    expect((await POST(req(userToken))).status).toBe(403);
  });

  it('creates an anchor for an admin', async () => {
    const res = await POST(req(adminToken));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.seq).toBe(0);
    expect(body.data.receipt.status).toBe('local');
  });
});
