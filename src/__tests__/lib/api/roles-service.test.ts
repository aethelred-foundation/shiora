/** @jest-environment node */

const pgQuery = jest.fn().mockResolvedValue({ rows: [] });

jest.mock('@/lib/persistence/sql-client', () => ({
  getPgClient: jest.fn(() => ({ query: pgQuery })),
}));

import {
  assignRole,
  getAssignment,
  getRoles,
  hasRole,
  revokeRole,
  __resetRolesForTests,
} from '@/lib/api/roles-service';

const ADDR = 'aeth1user0000000000000000000000000000000';

describe('roles-service', () => {
  const original = process.env.DATABASE_URL;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = original;
    }
    __resetRolesForTests();
    jest.clearAllMocks();
  });

  it('defaults an unassigned address to individual', async () => {
    delete process.env.DATABASE_URL;
    __resetRolesForTests();
    expect(await getAssignment(ADDR)).toBeUndefined();
    expect(await getRoles(ADDR)).toEqual(['individual']);
    expect(await hasRole(ADDR, 'provider')).toBe(false);
    expect(await hasRole(ADDR, 'individual')).toBe(true);
  });

  it('assigns a role, creating the assignment with the default included', async () => {
    delete process.env.DATABASE_URL;
    __resetRolesForTests();
    const assignment = await assignRole(ADDR, 'provider');
    expect(assignment.roles).toEqual(['individual', 'provider']);
    expect(await hasRole(ADDR, 'provider')).toBe(true);
  });

  it('adds a second role to an existing assignment without duplicating', async () => {
    delete process.env.DATABASE_URL;
    __resetRolesForTests();
    await assignRole(ADDR, 'provider');
    const assignment = await assignRole(ADDR, 'researcher');
    expect(assignment.roles).toEqual(['individual', 'provider', 'researcher']);

    // Re-assigning an existing role is idempotent.
    const again = await assignRole(ADDR, 'provider');
    expect(again.roles).toEqual(['individual', 'provider', 'researcher']);
  });

  it('revokes a role from an existing assignment', async () => {
    delete process.env.DATABASE_URL;
    __resetRolesForTests();
    await assignRole(ADDR, 'provider');
    const revoked = await revokeRole(ADDR, 'provider');
    expect(revoked?.roles).toEqual(['individual']);
  });

  it('returns undefined when revoking from an address with no assignment', async () => {
    delete process.env.DATABASE_URL;
    __resetRolesForTests();
    expect(await revokeRole(ADDR, 'provider')).toBeUndefined();
  });

  it('reads role assignments from Postgres when DATABASE_URL is set', async () => {
    process.env.DATABASE_URL = 'postgres://localhost/shiora';
    __resetRolesForTests();
    expect(await getRoles(ADDR)).toEqual(['individual']);
    expect(pgQuery).toHaveBeenCalled();
  });
});
