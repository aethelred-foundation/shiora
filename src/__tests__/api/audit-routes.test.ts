/** @jest-environment node */

jest.mock('@/lib/api/middleware', () => {
  const actual = jest.requireActual('@/lib/api/middleware');
  return { ...actual, runMiddleware: jest.fn((...args: unknown[]) => actual.runMiddleware(...args)) };
});

jest.mock('@/lib/api/audit-log', () => {
  const actual = jest.requireActual('@/lib/api/audit-log');
  return { ...actual, getAuditLog: jest.fn(() => actual.getAuditLog()) };
});

import { NextRequest, NextResponse } from 'next/server';
import { runMiddleware } from '@/lib/api/middleware';
import { getAuditLog, __resetAuditLogForTests } from '@/lib/api/audit-log';
import { GET as getAudit } from '@/app/api/audit/route';
import { createSessionToken } from '@/lib/api/session';
import { seededAddress } from '@/lib/utils';

const mockedGetAuditLog = getAuditLog as jest.MockedFunction<typeof getAuditLog>;
const actualAuditLog = jest.requireActual('@/lib/api/audit-log');
const mockedRunMiddleware = runMiddleware as jest.MockedFunction<typeof runMiddleware>;

const ADMIN = seededAddress(900);
const USER = seededAddress(901);
const adminToken = createSessionToken(ADMIN).token;
const userToken = createSessionToken(USER).token;
const originalAdmins = process.env.SHIORA_ADMIN_ADDRESSES;

beforeEach(() => {
  process.env.SHIORA_ADMIN_ADDRESSES = ADMIN;
  __resetAuditLogForTests();
  mockedGetAuditLog.mockImplementation(() => actualAuditLog.getAuditLog());
});

afterEach(() => {
  if (originalAdmins === undefined) {
    delete process.env.SHIORA_ADMIN_ADDRESSES;
  } else {
    process.env.SHIORA_ADMIN_ADDRESSES = originalAdmins;
  }
  mockedRunMiddleware.mockImplementation((...args: unknown[]) => {
    const actual = jest.requireActual('@/lib/api/middleware');
    return actual.runMiddleware(...args);
  });
});

function req(url: string, token?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (token) headers.authorization = `Bearer ${token}`;
  return new NextRequest(url, { headers });
}

describe('GET /api/audit', () => {
  it('returns the middleware error when blocked', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(NextResponse.json({ error: 'blocked' }, { status: 403 }));
    expect((await getAudit(req('http://localhost:3001/api/audit', adminToken))).status).toBe(403);
  });

  it('returns 401 when unauthenticated', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(null);
    expect((await getAudit(req('http://localhost:3001/api/audit'))).status).toBe(401);
  });

  it('returns 403 for a non-admin caller', async () => {
    expect((await getAudit(req('http://localhost:3001/api/audit', userToken))).status).toBe(403);
  });

  it('returns the verified audit trail for an admin', async () => {
    await actualAuditLog.getAuditLog().record({ action: 'RECORD_CREATE', actor: ADMIN, resource: 'record', resourceId: 'r1', success: true });
    await actualAuditLog.getAuditLog().record({ action: 'GRANT_CREATE', actor: USER, resource: 'access-grant', resourceId: 'g1', success: true });

    const res = await getAudit(req('http://localhost:3001/api/audit?limit=100', adminToken));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.entries.length).toBe(2);
    expect(body.data.verification.valid).toBe(true);
  });

  it('filters the trail by actor', async () => {
    await actualAuditLog.getAuditLog().record({ action: 'RECORD_CREATE', actor: ADMIN, resource: 'record', resourceId: 'r1', success: true });
    await actualAuditLog.getAuditLog().record({ action: 'GRANT_CREATE', actor: USER, resource: 'access-grant', resourceId: 'g1', success: true });

    const res = await getAudit(req(`http://localhost:3001/api/audit?actor=${USER}`, adminToken));
    const body = await res.json();
    expect(body.data.entries.every((e: { actor: string }) => e.actor === USER)).toBe(true);
  });

  it('returns 422 for invalid query params', async () => {
    expect((await getAudit(req('http://localhost:3001/api/audit?limit=-1', adminToken))).status).toBe(422);
  });

  it('re-throws a non-Zod error from the audit log', async () => {
    mockedGetAuditLog.mockReturnValueOnce({
      list: jest.fn().mockRejectedValue(new Error('audit store down')),
      verify: jest.fn(),
    } as unknown as ReturnType<typeof getAuditLog>);
    await expect(getAudit(req('http://localhost:3001/api/audit', adminToken))).rejects.toThrow('audit store down');
  });
});
