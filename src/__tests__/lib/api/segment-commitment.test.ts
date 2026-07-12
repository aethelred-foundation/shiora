/** @jest-environment node */

import crypto from 'node:crypto';

import { PersistentAuditLog } from '@/lib/api/audit-log';
import { InMemoryAuditStore } from '@/lib/persistence/audit-store';
import { buildAuditExport } from '@/lib/api/audit-export';
import {
  merkleRootOfHashes,
  newAnchorSalt,
  saltedCommitment,
  verifySegmentCommitment,
} from '@/lib/api/anchoring/segment-commitment';
import { __resetDerivedSecretsForTests } from '@/lib/crypto/derived-secrets';

afterEach(() => __resetDerivedSecretsForTests());

const sha256 = (data: Buffer): Buffer => crypto.createHash('sha256').update(data).digest();
const leaf = (hex: string): Buffer => sha256(Buffer.concat([Buffer.from([0x00]), Buffer.from(hex, 'hex')]));
const node = (l: Buffer, r: Buffer): Buffer => sha256(Buffer.concat([Buffer.from([0x01]), l, r]));

const h = (seed: string): string => crypto.createHash('sha256').update(seed).digest('hex');

async function chainOf(n: number): Promise<PersistentAuditLog> {
  const log = new PersistentAuditLog(new InMemoryAuditStore());
  for (let i = 0; i < n; i++) {
    await log.record({ action: 'RECORD_CREATE', actor: 'aeth1a', resource: 'record', resourceId: `r${i}`, success: true });
  }
  return log;
}

describe('merkleRootOfHashes', () => {
  it('a single leaf hashes with the leaf prefix (domain separation)', () => {
    expect(merkleRootOfHashes([h('a')])).toBe(leaf(h('a')).toString('hex'));
  });

  it('pairs leaves with the node prefix', () => {
    const expected = node(leaf(h('a')), leaf(h('b'))).toString('hex');
    expect(merkleRootOfHashes([h('a'), h('b')])).toBe(expected);
  });

  it('promotes an unpaired node unchanged (odd counts)', () => {
    const expected = node(node(leaf(h('a')), leaf(h('b'))), leaf(h('c'))).toString('hex');
    expect(merkleRootOfHashes([h('a'), h('b'), h('c')])).toBe(expected);
  });

  it('is order-sensitive', () => {
    expect(merkleRootOfHashes([h('a'), h('b')])).not.toBe(merkleRootOfHashes([h('b'), h('a')]));
  });

  it('rejects an empty leaf set — an empty segment is never anchored', () => {
    expect(() => merkleRootOfHashes([])).toThrow('empty');
  });

  it('rejects a leaf that is not a 32-byte hex hash', () => {
    expect(() => merkleRootOfHashes(['not-hex'])).toThrow('32-byte hex');
    expect(() => merkleRootOfHashes([h('a').slice(0, 32)])).toThrow('32-byte hex');
  });
});

describe('newAnchorSalt', () => {
  it('mints a 32-byte hex salt, unique per call', () => {
    const a = newAnchorSalt();
    const b = newAnchorSalt();
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(b).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toBe(b);
  });
});

describe('saltedCommitment', () => {
  it('is sha256(salt || root) over the raw bytes', () => {
    const salt = newAnchorSalt();
    const root = h('root');
    const expected = sha256(Buffer.concat([Buffer.from(salt, 'hex'), Buffer.from(root, 'hex')])).toString('hex');
    expect(saltedCommitment(salt, root)).toBe(expected);
  });

  it('different salts blind the same root to different commitments', () => {
    const root = h('root');
    expect(saltedCommitment(newAnchorSalt(), root)).not.toBe(saltedCommitment(newAnchorSalt(), root));
  });

  it('rejects a salt shorter than 16 bytes — the commitment must not be guessable', () => {
    expect(() => saltedCommitment('abcd', h('root'))).toThrow('16 bytes');
  });

  it('rejects a salt that is not valid hex', () => {
    expect(() => saltedCommitment('zz'.repeat(16), h('root'))).toThrow('hex');
  });

  it('rejects a root that is not a 32-byte hex hash', () => {
    expect(() => saltedCommitment(newAnchorSalt(), 'nope')).toThrow('32-byte hex');
  });
});

describe('verifySegmentCommitment (auditor helper)', () => {
  it('proves an exported segment matches its on-chain commitment', async () => {
    const log = await chainOf(4);
    const bundle = await log.exportSegment(1, 3);
    const salt = newAnchorSalt();
    const root = merkleRootOfHashes(bundle.entries.map((entry) => entry.hash));
    const commitment = saltedCommitment(salt, root);

    expect(verifySegmentCommitment(bundle, salt, commitment)).toEqual({ valid: true, merkleRoot: root });
  });

  it('rejects a tampered bundle before comparing commitments', async () => {
    const log = await chainOf(3);
    const bundle = await log.exportSegment();
    const salt = newAnchorSalt();
    const commitment = saltedCommitment(salt, merkleRootOfHashes(bundle.entries.map((entry) => entry.hash)));

    bundle.entries[1].actor = 'aeth1attacker';
    expect(verifySegmentCommitment(bundle, salt, commitment)).toEqual({ valid: false, reason: 'signature mismatch' });
  });

  it('rejects an empty segment — there is nothing to prove', async () => {
    const log = new PersistentAuditLog(new InMemoryAuditStore());
    const bundle = await log.exportSegment();
    expect(verifySegmentCommitment(bundle, newAnchorSalt(), h('anything'))).toEqual({
      valid: false,
      reason: 'empty segment',
    });
  });

  it('rejects the wrong salt — the commitment does not open', async () => {
    const log = await chainOf(2);
    const bundle = await log.exportSegment();
    const root = merkleRootOfHashes(bundle.entries.map((entry) => entry.hash));
    const commitment = saltedCommitment(newAnchorSalt(), root);

    const result = verifySegmentCommitment(bundle, newAnchorSalt(), commitment);
    expect(result).toEqual({ valid: false, reason: 'commitment mismatch', merkleRoot: root });
  });

  it('rejects a substituted segment — different entries, different root', async () => {
    const log = await chainOf(4);
    const anchored = await log.exportSegment(0, 1);
    const salt = newAnchorSalt();
    const commitment = saltedCommitment(salt, merkleRootOfHashes(anchored.entries.map((entry) => entry.hash)));

    const other = await log.exportSegment(2, 3);
    const result = verifySegmentCommitment(other, salt, commitment);
    expect(result).toEqual({
      valid: false,
      reason: 'commitment mismatch',
      merkleRoot: merkleRootOfHashes(other.entries.map((entry) => entry.hash)),
    });
  });

  it('reports invalid salts and commitments as verification failures, not crashes', async () => {
    const log = await chainOf(2);
    const bundle = await log.exportSegment();
    expect(verifySegmentCommitment(bundle, 'abcd', h('root'))).toEqual({
      valid: false,
      reason: expect.stringContaining('16 bytes'),
    });
  });

  it('a re-signed truncated bundle is still rejected by the export verifier', async () => {
    const log = await chainOf(3);
    const bundle = await log.exportSegment();
    const salt = newAnchorSalt();
    const commitment = saltedCommitment(salt, merkleRootOfHashes(bundle.entries.map((entry) => entry.hash)));

    bundle.entries.splice(1, 1);
    const resigned = buildAuditExport(bundle.entries, bundle.chainHead, bundle.exportedAt);
    expect(verifySegmentCommitment(resigned, salt, commitment)).toEqual({
      valid: false,
      reason: expect.stringContaining('broken linkage'),
    });
  });
});
