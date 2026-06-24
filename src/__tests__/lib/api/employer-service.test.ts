/** @jest-environment node */

const pgQuery = jest.fn().mockResolvedValue({ rows: [] });

jest.mock('@/lib/persistence/sql-client', () => ({
  getPgClient: jest.fn(() => ({ query: pgQuery })),
}));

import {
  addMember,
  createOrganization,
  getOrganization,
  listMembers,
  listOrganizations,
  removeMember,
  __resetEmployerForTests,
} from '@/lib/api/employer-service';
import { seededAddress } from '@/lib/utils';

const ADMIN = seededAddress(600);
const OTHER = seededAddress(601);
const M1 = seededAddress(610);
const M2 = seededAddress(611);

describe('employer-service', () => {
  const original = process.env.DATABASE_URL;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = original;
    }
    __resetEmployerForTests();
    jest.clearAllMocks();
  });

  it('creates and lists organizations, scoped to the owner', async () => {
    delete process.env.DATABASE_URL;
    __resetEmployerForTests();

    const org = await createOrganization(ADMIN, { name: 'Acme', industry: 'Tech' });
    expect(org.id.startsWith('org-')).toBe(true);
    expect(org.industry).toBe('Tech');

    const plain = await createOrganization(ADMIN, { name: 'No Industry' });
    expect(plain.industry).toBeUndefined();

    expect(await listOrganizations(ADMIN)).toHaveLength(2);
    expect(await getOrganization(ADMIN, org.id)).toBeDefined();
    expect(await getOrganization(OTHER, org.id)).toBeUndefined(); // not the owner
  });

  it('adds, lists, and removes members', async () => {
    delete process.env.DATABASE_URL;
    __resetEmployerForTests();

    const org = await createOrganization(ADMIN, { name: 'Acme' });
    await addMember(org.id, { address: M1, role: 'employee' });
    await addMember(org.id, { address: M2, role: 'manager' });
    expect(await listMembers(org.id)).toHaveLength(2);

    const removed = await removeMember(org.id, M1);
    expect(removed?.status).toBe('removed');
    expect((await listMembers(org.id)).map((m) => m.address)).toEqual([M2]); // M1 filtered out

    expect(await removeMember(org.id, M1)).toBeUndefined(); // already removed
    expect(await removeMember(org.id, seededAddress(999))).toBeUndefined(); // not a member
  });

  it('uses the Postgres-backed store when DATABASE_URL is configured', async () => {
    process.env.DATABASE_URL = 'postgres://localhost/shiora';
    __resetEmployerForTests();
    expect(await listOrganizations(ADMIN)).toEqual([]);
    expect(pgQuery).toHaveBeenCalled();
  });
});
