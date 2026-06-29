/** @jest-environment node */

const pgQuery = jest.fn().mockResolvedValue({ rows: [] });

jest.mock('@/lib/persistence/sql-client', () => ({
  getPgClient: jest.fn(() => ({ query: pgQuery })),
}));

import {
  createAnchor,
  listAnchors,
  getLatestAnchor,
  verifyAnchors,
  verifyAnchorChain,
  __resetAnchorRepositoryForTests,
  type AnchorRecord,
} from '@/lib/api/anchoring/anchor-service';
import { getAuditLog, __resetAuditLogForTests } from '@/lib/api/audit-log';
import { __resetAnchorClientForTests } from '@/lib/api/anchoring/anchor-client';
import { GENESIS_HASH } from '@/lib/crypto/audit-chain';

beforeEach(() => {
  __resetAuditLogForTests();
  __resetAnchorRepositoryForTests();
  __resetAnchorClientForTests();
});

describe('createAnchor', () => {
  it('anchors the genesis head when the audit log is empty (local receipt)', async () => {
    const anchor = await createAnchor(1000);
    expect(anchor.seq).toBe(0);
    expect(anchor.prevHash).toBe(GENESIS_HASH);
    expect(anchor.payload.auditHead).toBe(GENESIS_HASH);
    expect(anchor.payload.auditLength).toBe(0);
    expect(anchor.payload.createdAt).toBe(1000);
    expect(anchor.receipt.status).toBe('local');
    expect(anchor.receipt.ref).toBe(`local:${anchor.hash}`);
  });

  it('anchors the current head and links successive anchors', async () => {
    await getAuditLog().record({
      actor: 'a', action: 'RECORD_CREATE', resource: 'health_records', resourceId: 'r1', success: true,
    });
    const first = await createAnchor(2000);
    expect(first.payload.auditLength).toBe(1);
    expect(first.payload.auditHead).not.toBe(GENESIS_HASH);

    const second = await createAnchor(3000);
    expect(second.seq).toBe(1);
    expect(second.prevHash).toBe(first.hash);
  });
});

describe('listAnchors / getLatestAnchor', () => {
  it('reports no anchors before any are created', async () => {
    expect(await getLatestAnchor()).toBeNull();
    expect(await listAnchors()).toEqual([]);
  });

  it('lists most-recent first and reports the latest', async () => {
    const a0 = await createAnchor(1000);
    const a1 = await createAnchor(2000);
    expect((await listAnchors()).map((a) => a.seq)).toEqual([1, 0]);
    expect((await getLatestAnchor())?.id).toBe(a1.id);
    expect(a0.seq).toBe(0);
  });
});

describe('verifyAnchors / verifyAnchorChain', () => {
  it('verifies a real persisted series', async () => {
    await createAnchor(1000);
    await createAnchor(2000);
    expect(await verifyAnchors()).toEqual({ valid: true, length: 2 });
  });

  it('accepts an empty series', () => {
    expect(verifyAnchorChain([])).toEqual({ valid: true, length: 0 });
  });

  it('detects a prevHash break', async () => {
    const a0 = await createAnchor(1000);
    const a1 = await createAnchor(2000);
    const tampered: AnchorRecord = { ...a1, prevHash: '0'.repeat(64) };
    expect(verifyAnchorChain([a0, tampered])).toEqual({
      valid: false, length: 2, brokenAt: 1, reason: 'prevHash mismatch',
    });
  });

  it('detects a payload/hash break', async () => {
    const a0 = await createAnchor(1000);
    const tampered: AnchorRecord = { ...a0, payload: { ...a0.payload, auditLength: 999 } };
    expect(verifyAnchorChain([tampered])).toEqual({
      valid: false, length: 1, brokenAt: 0, reason: 'hash mismatch',
    });
  });
});

describe('datastore selection', () => {
  const original = process.env.DATABASE_URL;

  afterEach(() => {
    if (original === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = original;
    __resetAnchorRepositoryForTests();
  });

  it('selects the Postgres store when DATABASE_URL is configured', async () => {
    process.env.DATABASE_URL = 'postgres://localhost/shiora';
    __resetAnchorRepositoryForTests();
    expect(await listAnchors()).toEqual([]);
    expect(pgQuery).toHaveBeenCalled();
  });
});
