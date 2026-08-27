/** @jest-environment node */

jest.mock('@/lib/api/middleware', () => {
  const actual = jest.requireActual('@/lib/api/middleware');
  return { ...actual, runMiddleware: jest.fn((...args: unknown[]) => actual.runMiddleware(...args)) };
});

import { NextRequest, NextResponse } from 'next/server';
import { runMiddleware } from '@/lib/api/middleware';
import { GET, POST } from '@/app/api/anchors/route';
import { getAuditLog, __resetAuditLogForTests } from '@/lib/api/audit-log';
import { __resetAnchorRepositoryForTests } from '@/lib/api/anchoring/anchor-service';
import { __resetAnchorClientForTests } from '@/lib/api/anchoring/anchor-client';
import { __resetAnchorOutboxStoreForTests } from '@/lib/persistence/anchor-outbox-store';
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

async function seedAudit(): Promise<void> {
  await getAuditLog().record({
    action: 'RECORD_CREATE', actor: ADMIN, resource: 'record', resourceId: 'r1', success: true,
  });
}

beforeEach(() => {
  process.env.SHIORA_ADMIN_ADDRESSES = ADMIN;
  __resetAuditLogForTests();
  __resetAnchorRepositoryForTests();
  __resetAnchorClientForTests();
  __resetAnchorOutboxStoreForTests();
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

  it('lists outbox jobs plus the WORM anchor series, re-verified, for an admin', async () => {
    await seedAudit();
    await POST(req(adminToken)); // run one outbox pass (local client → confirmed)

    const res = await GET(req(adminToken));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.jobs).toHaveLength(1);
    expect(body.data.jobs[0]).toMatchObject({ state: 'confirmed', anchorStatus: 'local' });
    expect(body.data.anchors).toHaveLength(1);
    expect(body.data.anchors[0].payload).toMatchObject({
      version: 2,
      commitment: body.data.jobs[0].commitment,
      fromSeq: body.data.jobs[0].fromSeq,
      toSeq: body.data.jobs[0].toSeq,
    });
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

  it('runs an outbox pass and answers 202 with the report — anchoring is asynchronous', async () => {
    await seedAudit();
    const res = await POST(req(adminToken));
    expect(res.status).toBe(202);

    const body = await res.json();
    expect(body.data.report).toMatchObject({ cut: 1, processed: 1, confirmed: 1, errors: 0 });
    expect(body.data.jobs[0]).toMatchObject({ state: 'confirmed', anchorStatus: 'local' });
    // The local receipt is honest: the ref names the commitment, no tx hash is invented.
    expect(body.data.jobs[0].txRef).toBe(`local:${body.data.jobs[0].commitment}`);
  });

  it('answers 202 with a zero report when there is nothing to anchor', async () => {
    const res = await POST(req(adminToken));
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.data.report).toMatchObject({ cut: 0, processed: 0 });
    expect(body.data.jobs).toEqual([]);
  });
});
