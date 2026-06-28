/** @jest-environment node */

const pgQuery = jest.fn().mockResolvedValue({ rows: [] });
jest.mock('@/lib/persistence/sql-client', () => ({
  getPgClient: jest.fn(() => ({ query: pgQuery })),
}));

import {
  generateProof,
  verifyProof,
  listProofs,
  getProof,
  __resetZkpForTests,
} from '@/lib/api/zkp-service';
import { getAuditLog, __resetAuditLogForTests } from '@/lib/api/audit-log';
import { seededAddress } from '@/lib/utils';

const USER = seededAddress(400);
const original = process.env.DATABASE_URL;

beforeEach(() => {
  delete process.env.DATABASE_URL;
  __resetZkpForTests();
  __resetAuditLogForTests();
});

afterEach(() => {
  if (original === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = original;
  __resetZkpForTests();
  jest.clearAllMocks();
});

describe('zkp-service', () => {
  it('generates a real, self-verifying proof and audits it (value/blinding not stored)', async () => {
    const record = await generateProof(USER, 'age_range', 30, [18, 30, 65]);

    expect(record.id.startsWith('zkp-')).toBe(true);
    expect(verifyProof(record.proof, record.context)).toBe(true);
    expect(JSON.stringify(record)).not.toMatch(/"value"|"blinding"/); // secret-free

    const audits = await getAuditLog().list({ action: 'PROOF_GENERATE', actor: USER });
    expect(audits).toHaveLength(1);
    expect(audits[0].resourceId).toBe(record.id);
  });

  it('refuses to generate a proof for a value not in the set', async () => {
    await expect(generateProof(USER, 'data_quality', 99, [80, 90])).rejects.toThrow(/not in the set/);
  });

  it('verifyProof returns false for a tampered or malformed proof', async () => {
    const { proof, context } = await generateProof(USER, 'age_range', 18, [18, 30]);
    expect(verifyProof({ ...proof, z: [proof.z[0], 'deadbeef'] }, context)).toBe(false); // tampered
    expect(verifyProof({ ...proof, commitment: 'nothex!!' }, context)).toBe(false); // malformed → caught
  });

  it('lists and fetches proofs, scoped to the owner', async () => {
    const record = await generateProof(USER, 'age_range', 30, [18, 30]);
    expect(await listProofs(USER)).toHaveLength(1);
    expect((await getProof(USER, record.id))?.id).toBe(record.id);
    expect(await listProofs(seededAddress(401))).toEqual([]);
  });

  it('selects the Postgres store when DATABASE_URL is configured', async () => {
    process.env.DATABASE_URL = 'postgres://localhost/shiora';
    __resetZkpForTests();
    expect(await listProofs(USER)).toEqual([]);
    expect(pgQuery).toHaveBeenCalled();
  });
});
