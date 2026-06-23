/** @jest-environment node */

import { NextRequest } from 'next/server';

import { isAdmin, requireAdmin, requireCapability, requireRole } from '@/lib/api/rbac';
import { assignRole, __resetRolesForTests } from '@/lib/api/roles-service';
import { createSessionToken } from '@/lib/api/session';
import { seededAddress } from '@/lib/utils';

function reqFor(token?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (token) headers.authorization = `Bearer ${token}`;
  return new NextRequest('http://localhost:3001/api/x', { headers });
}

describe('rbac', () => {
  const original = process.env.SHIORA_ADMIN_ADDRESSES;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.SHIORA_ADMIN_ADDRESSES;
    } else {
      process.env.SHIORA_ADMIN_ADDRESSES = original;
    }
    __resetRolesForTests();
  });

  it('isAdmin is true for an allowlisted address', async () => {
    const addr = seededAddress(1);
    process.env.SHIORA_ADMIN_ADDRESSES = `${addr}, aeth1other`;
    __resetRolesForTests();
    expect(await isAdmin(addr)).toBe(true);
  });

  it('isAdmin is true for an address holding the government role', async () => {
    delete process.env.SHIORA_ADMIN_ADDRESSES;
    __resetRolesForTests();
    const addr = seededAddress(2);
    await assignRole(addr, 'government');
    expect(await isAdmin(addr)).toBe(true);
  });

  it('isAdmin is false for an ordinary address', async () => {
    delete process.env.SHIORA_ADMIN_ADDRESSES;
    __resetRolesForTests();
    expect(await isAdmin(seededAddress(3))).toBe(false);
  });

  it('requireRole returns 401 when unauthenticated', async () => {
    const res = await requireRole(reqFor(), 'provider');
    expect('status' in res && res.status).toBe(401);
  });

  it('requireRole grants access when the caller holds one of the roles', async () => {
    __resetRolesForTests();
    const addr = seededAddress(4);
    await assignRole(addr, 'provider');
    const { token } = createSessionToken(addr);
    const res = await requireRole(reqFor(token), 'provider', 'researcher');
    expect('walletAddress' in res && res.walletAddress).toBe(addr);
  });

  it('requireRole returns 403 when the caller lacks the role', async () => {
    __resetRolesForTests();
    const { token } = createSessionToken(seededAddress(5));
    const res = await requireRole(reqFor(token), 'government');
    expect('status' in res && res.status).toBe(403);
  });

  it('requireCapability returns 401 when unauthenticated', async () => {
    const res = await requireCapability(reqFor(), 'manage_own_records');
    expect('status' in res && res.status).toBe(401);
  });

  it('requireCapability grants access when a role provides the capability', async () => {
    __resetRolesForTests();
    const addr = seededAddress(8);
    await assignRole(addr, 'researcher');
    const { token } = createSessionToken(addr);
    const res = await requireCapability(reqFor(token), 'access_research_marketplace');
    expect('walletAddress' in res && res.walletAddress).toBe(addr);
  });

  it('requireCapability returns 403 when no role provides the capability', async () => {
    __resetRolesForTests();
    const { token } = createSessionToken(seededAddress(9)); // default individual only
    const res = await requireCapability(reqFor(token), 'run_secure_computation');
    expect('status' in res && res.status).toBe(403);
  });

  it('requireAdmin returns 401 when unauthenticated', async () => {
    const res = await requireAdmin(reqFor());
    expect('status' in res && res.status).toBe(401);
  });

  it('requireAdmin grants access to an allowlisted admin', async () => {
    const addr = seededAddress(6);
    process.env.SHIORA_ADMIN_ADDRESSES = addr;
    __resetRolesForTests();
    const { token } = createSessionToken(addr);
    const res = await requireAdmin(reqFor(token));
    expect('walletAddress' in res && res.walletAddress).toBe(addr);
  });

  it('requireAdmin returns 403 for a non-admin', async () => {
    delete process.env.SHIORA_ADMIN_ADDRESSES;
    __resetRolesForTests();
    const { token } = createSessionToken(seededAddress(7));
    const res = await requireAdmin(reqFor(token));
    expect('status' in res && res.status).toBe(403);
  });
});
