/** @jest-environment node */

const pgQuery = jest.fn().mockResolvedValue({ rows: [] });

jest.mock('@/lib/persistence/sql-client', () => ({
  getPgClient: jest.fn(() => ({ query: pgQuery })),
}));

import crypto from 'node:crypto';

import {
  recordConfirmedAnchor,
  listAnchors,
  getLatestAnchor,
  verifyAnchors,
  verifyAnchorChain,
  __resetAnchorRepositoryForTests,
  type AnchorRecord,
  type ConfirmedAnchorInput,
} from '@/lib/api/anchoring/anchor-service';
import { __resetAuditLogForTests } from '@/lib/api/audit-log';
import { __resetAnchorClientForTests } from '@/lib/api/anchoring/anchor-client';
import { GENESIS_HASH } from '@/lib/crypto/audit-chain';

const commitment = (seed: string): string => crypto.createHash('sha256').update(seed).digest('hex');

function confirmed(seed: string, fromSeq: number, toSeq: number): ConfirmedAnchorInput {
  return {
    commitment: commitment(seed),
    fromSeq,
    toSeq,
    receipt: { ref: `0xtx-${seed}`, status: 'on-chain', target: 'https://l1.example/rpc', submittedAt: 500 },
  };
}

beforeEach(() => {
  __resetAuditLogForTests();
  __resetAnchorRepositoryForTests();
  __resetAnchorClientForTests();
});

describe('recordConfirmedAnchor', () => {
  it('appends a WORM record of the confirmed segment commitment, linked from genesis', async () => {
    const anchor = await recordConfirmedAnchor(confirmed('c0', 0, 4), 1000);
    expect(anchor.seq).toBe(0);
    expect(anchor.prevHash).toBe(GENESIS_HASH);
    expect(anchor.payload).toEqual({
      commitment: commitment('c0'),
      fromSeq: 0,
      toSeq: 4,
      createdAt: 1000,
      version: 2,
    });
    expect(anchor.receipt.ref).toBe('0xtx-c0');
  });

  it('links successive anchors into their own hash chain', async () => {
    const first = await recordConfirmedAnchor(confirmed('c0', 0, 4), 1000);
    const second = await recordConfirmedAnchor(confirmed('c1', 5, 9), 2000);
    expect(second.seq).toBe(1);
    expect(second.prevHash).toBe(first.hash);
  });

  it('stamps the record with the current clock by default', async () => {
    const before = Date.now();
    const anchor = await recordConfirmedAnchor(confirmed('c0', 0, 4));
    expect(anchor.payload.createdAt).toBeGreaterThanOrEqual(before);
  });
});

describe('listAnchors / getLatestAnchor', () => {
  it('reports no anchors before any are recorded', async () => {
    expect(await getLatestAnchor()).toBeNull();
    expect(await listAnchors()).toEqual([]);
  });

  it('lists most-recent first and reports the latest', async () => {
    const a0 = await recordConfirmedAnchor(confirmed('c0', 0, 4), 1000);
    const a1 = await recordConfirmedAnchor(confirmed('c1', 5, 9), 2000);
    expect((await listAnchors()).map((a) => a.seq)).toEqual([1, 0]);
    expect((await getLatestAnchor())?.id).toBe(a1.id);
    expect(a0.seq).toBe(0);
  });
});

describe('verifyAnchors / verifyAnchorChain', () => {
  it('verifies a real persisted series', async () => {
    await recordConfirmedAnchor(confirmed('c0', 0, 4), 1000);
    await recordConfirmedAnchor(confirmed('c1', 5, 9), 2000);
    expect(await verifyAnchors()).toEqual({ valid: true, length: 2 });
  });

  it('accepts an empty series', () => {
    expect(verifyAnchorChain([])).toEqual({ valid: true, length: 0 });
  });

  it('still verifies a version 1 record from before the outbox flow', () => {
    const payload = { auditHead: commitment('head'), auditLength: 7, createdAt: 900, version: 1 as const };
    const hash = crypto.createHash('sha256')
      .update([GENESIS_HASH, 0, payload.auditHead, payload.auditLength, payload.createdAt, 1].join('|'))
      .digest('hex');
    const legacy: AnchorRecord = {
      id: 'legacy-0',
      seq: 0,
      prevHash: GENESIS_HASH,
      hash,
      payload,
      receipt: { ref: `local:${hash}`, status: 'local', target: 'local', submittedAt: 900 },
    };
    expect(verifyAnchorChain([legacy])).toEqual({ valid: true, length: 1 });
  });

  it('detects a prevHash break', async () => {
    const a0 = await recordConfirmedAnchor(confirmed('c0', 0, 4), 1000);
    const a1 = await recordConfirmedAnchor(confirmed('c1', 5, 9), 2000);
    const tampered: AnchorRecord = { ...a1, prevHash: '0'.repeat(64) };
    expect(verifyAnchorChain([a0, tampered])).toEqual({
      valid: false, length: 2, brokenAt: 1, reason: 'prevHash mismatch',
    });
  });

  it('detects a payload/hash break', async () => {
    const a0 = await recordConfirmedAnchor(confirmed('c0', 0, 4), 1000);
    const tampered: AnchorRecord = { ...a0, payload: { ...a0.payload, toSeq: 999 } as AnchorRecord['payload'] };
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
