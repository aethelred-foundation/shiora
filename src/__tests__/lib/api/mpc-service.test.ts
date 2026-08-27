/** @jest-environment node */

const pgQuery = jest.fn().mockResolvedValue({ rows: [] });
jest.mock('@/lib/persistence/sql-client', () => ({
  getPgClient: jest.fn(() => ({ query: pgQuery })),
}));

import {
  runComputation,
  listSessions,
  getSession,
  __resetMpcForTests,
} from '@/lib/api/mpc-service';
import { getAuditLog, __resetAuditLogForTests } from '@/lib/api/audit-log';
import { seededAddress } from '@/lib/utils';

const USER = seededAddress(200);
const original = process.env.DATABASE_URL;

beforeEach(() => {
  delete process.env.DATABASE_URL;
  __resetMpcForTests();
  __resetAuditLogForTests();
});

afterEach(() => {
  if (original === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = original;
  __resetMpcForTests();
  jest.clearAllMocks();
});

describe('mpc-service', () => {
  it('computes a secure sum, stores only the aggregate, and audits it', async () => {
    const session = await runComputation(USER, {
      name: 'Vitals pooling', protocol: 'secure_sum', threshold: 2, contributions: [3, 5, 7],
    });

    expect(session.result).toBe(15); // exact secure aggregate
    expect(session.participantCount).toBe(3);
    expect(JSON.stringify(session)).not.toMatch(/"contributions"/); // inputs not persisted

    const audits = await getAuditLog().list({ action: 'MPC_COMPUTE', actor: USER });
    expect(audits).toHaveLength(1);
  });

  it('computes a federated average (mean)', async () => {
    const session = await runComputation(USER, {
      name: 'avg', protocol: 'federated_averaging', threshold: 2, contributions: [10, 20, 30],
    });
    expect(session.result).toBe(20);
  });

  it('computes a secure count (every party contributes one)', async () => {
    const session = await runComputation(USER, {
      name: 'count', protocol: 'secure_count', threshold: 1, contributions: [99, 99, 99, 99],
    });
    expect(session.result).toBe(4);
  });

  it('lists and fetches sessions, scoped to the owner', async () => {
    const session = await runComputation(USER, {
      name: 's', protocol: 'secure_sum', threshold: 1, contributions: [1],
    });
    expect(await listSessions(USER)).toHaveLength(1);
    expect((await getSession(USER, session.id))?.id).toBe(session.id);
    expect(await listSessions(seededAddress(201))).toEqual([]);
  });

  it('selects the Postgres store when DATABASE_URL is configured', async () => {
    process.env.DATABASE_URL = 'postgres://localhost/shiora';
    __resetMpcForTests();
    expect(await listSessions(USER)).toEqual([]);
    expect(pgQuery).toHaveBeenCalled();
  });
});
