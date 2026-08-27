/** @jest-environment node */

jest.mock('@/lib/api/middleware', () => {
  const actual = jest.requireActual('@/lib/api/middleware');
  return { ...actual, runMiddleware: jest.fn((...args: unknown[]) => actual.runMiddleware(...args)) };
});

import { NextRequest, NextResponse } from 'next/server';
import { runMiddleware } from '@/lib/api/middleware';
import { GET as exportAudit } from '@/app/api/audit/export/route';
import { getAuditLog, __resetAuditLogForTests } from '@/lib/api/audit-log';
import { verifyAuditExport } from '@/lib/api/audit-export';
import { createSessionToken } from '@/lib/api/session';
import { __resetRolesForTests } from '@/lib/api/roles-service';
import { seededAddress } from '@/lib/utils';

const mockedRunMiddleware = runMiddleware as jest.MockedFunction<typeof runMiddleware>;
const ADMIN = seededAddress(2801);
const USER = seededAddress(2802);
const originalAdmins = process.env.SHIORA_ADMIN_ADDRESSES;

beforeEach(async () => {
  process.env.SHIORA_ADMIN_ADDRESSES = ADMIN;
  delete process.env.DATABASE_URL;
  __resetRolesForTests();
  __resetAuditLogForTests();
  for (let i = 0; i < 3; i++) {
    await getAuditLog().record({ action: 'RECORD_CREATE', actor: ADMIN, resource: 'record', resourceId: `r${i}`, success: true });
  }
});

afterEach(() => {
  if (originalAdmins === undefined) delete process.env.SHIORA_ADMIN_ADDRESSES;
  else process.env.SHIORA_ADMIN_ADDRESSES = originalAdmins;
  __resetAuditLogForTests();
  mockedRunMiddleware.mockImplementation((...args: unknown[]) =>
    jest.requireActual('@/lib/api/middleware').runMiddleware(...args));
});

function req(query = '', token?: string): NextRequest {
  return new NextRequest(`http://localhost:3000/api/audit/export${query}`, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

describe('GET /api/audit/export', () => {
  it('returns a signed, self-verifiable bundle to an admin', async () => {
    const res = await exportAudit(req('', createSessionToken(ADMIN).token));
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Disposition')).toContain('attachment; filename="audit-export-0-2.json"');
    const bundle = (await res.json()).data;
    expect(bundle.count).toBe(3);
    expect(verifyAuditExport(bundle)).toEqual({ valid: true });
  });

  it('honors from/to bounds', async () => {
    const res = await exportAudit(req('?from=1&to=2', createSessionToken(ADMIN).token));
    const bundle = (await res.json()).data;
    expect(bundle.entries.map((e: { seq: number }) => e.seq)).toEqual([1, 2]);
  });

  it('rejects an inverted range with 400', async () => {
    const res = await exportAudit(req('?from=5&to=1', createSessionToken(ADMIN).token));
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('INVALID_RANGE');
  });

  it('rejects a malformed range with 422', async () => {
    const res = await exportAudit(req('?from=-1', createSessionToken(ADMIN).token));
    expect(res.status).toBe(422);
  });

  it('requires authentication and admin', async () => {
    expect((await exportAudit(req())).status).toBe(401);
    expect((await exportAudit(req('', createSessionToken(USER).token))).status).toBe(403);
  });

  it('returns the middleware block when blocked', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(NextResponse.json({ error: 'blocked' }, { status: 429 }));
    expect((await exportAudit(req('', createSessionToken(ADMIN).token))).status).toBe(429);
  });

  it('re-throws an unexpected (non-validation) error from the audit log', async () => {
    jest.spyOn(getAuditLog(), 'exportSegment').mockRejectedValueOnce(new Error('storage down'));
    await expect(exportAudit(req('', createSessionToken(ADMIN).token))).rejects.toThrow('storage down');
  });
});
