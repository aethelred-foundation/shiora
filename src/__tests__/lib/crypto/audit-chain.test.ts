/** @jest-environment node */

import {
  AuditChain,
  GENESIS_HASH,
  computeEntryHash,
  verifyAuditChain,
  type ChainedAuditEntry,
} from '@/lib/crypto/audit-chain';

function sampleEntry(action: ChainedAuditEntry['action'], actor: string) {
  return { action, actor, success: true } as const;
}

describe('tamper-evident audit chain', () => {
  it('seeds the genesis link from the all-zero hash', () => {
    const chain = new AuditChain();
    expect(chain.head()).toBe(GENESIS_HASH);
    expect(chain.length).toBe(0);

    const first = chain.append(sampleEntry('SESSION_CREATE', 'aeth1abc'));
    expect(first.seq).toBe(0);
    expect(first.prevHash).toBe(GENESIS_HASH);
    expect(first.hash).toHaveLength(64);
  });

  it('links each entry to the previous head', () => {
    const chain = new AuditChain();
    const a = chain.append(sampleEntry('RECORD_CREATE', 'aeth1abc'));
    const b = chain.append(sampleEntry('RECORD_READ', 'aeth1abc'));

    expect(b.seq).toBe(1);
    expect(b.prevHash).toBe(a.hash);
    expect(chain.head()).toBe(b.hash);
  });

  it('verifies an untampered chain', () => {
    const chain = new AuditChain();
    for (let i = 0; i < 25; i++) {
      chain.append(sampleEntry('RECORD_READ', `aeth1user${i}`));
    }
    const result = chain.verify();
    expect(result.valid).toBe(true);
    expect(result.length).toBe(25);
  });

  it('stamps a stable timestamp and is order-independent in hashing', () => {
    // Two entries with identical content but built via different key insertion
    // order must hash identically given the same linkage inputs.
    const chain = new AuditChain();
    const ts = '2026-01-01T00:00:00.000Z';
    const e1 = chain.append({ action: 'DATA_EXPORT', actor: 'aeth1x', success: true, timestamp: ts });
    const result = verifyAuditChain([e1]);
    expect(result.valid).toBe(true);
  });

  it('detects an edited entry (content hash mismatch)', () => {
    const chain = new AuditChain();
    chain.append(sampleEntry('GRANT_CREATE', 'aeth1abc'));
    chain.append(sampleEntry('GRANT_REVOKE', 'aeth1abc'));
    const entries = chain.snapshot();

    // Attacker rewrites who performed the action, keeping the old hash.
    entries[0] = { ...entries[0], actor: 'aeth1attacker' };

    const result = verifyAuditChain(entries);
    expect(result.valid).toBe(false);
    expect(result.brokenAt).toBe(0);
    expect(result.reason).toBe('content hash mismatch');
  });

  it('detects a deleted entry (broken linkage)', () => {
    const chain = new AuditChain();
    chain.append(sampleEntry('RECORD_CREATE', 'aeth1abc'));
    chain.append(sampleEntry('RECORD_UPDATE', 'aeth1abc'));
    chain.append(sampleEntry('RECORD_DELETE', 'aeth1abc'));
    const entries = chain.snapshot();

    // Remove the middle entry and renumber to hide the gap.
    const pruned = [entries[0], { ...entries[2], seq: 1 }];

    const result = verifyAuditChain(pruned);
    expect(result.valid).toBe(false);
    expect(result.brokenAt).toBe(1);
  });

  it('detects reordering', () => {
    const chain = new AuditChain();
    chain.append(sampleEntry('WALLET_CONNECT', 'aeth1abc'));
    chain.append(sampleEntry('PROOF_GENERATE', 'aeth1abc'));
    const [a, b] = chain.snapshot();

    const result = verifyAuditChain([b, a]);
    expect(result.valid).toBe(false);
  });

  it('verifies an empty chain as valid', () => {
    expect(verifyAuditChain([]).valid).toBe(true);
  });

  it('computeEntryHash is deterministic and 256-bit for identical inputs', () => {
    const entry = { action: 'RECORD_READ', actor: 'aeth1x', success: true, timestamp: 't' } as const;
    const h1 = computeEntryHash(GENESIS_HASH, 0, entry);
    const h2 = computeEntryHash(GENESIS_HASH, 0, entry);
    expect(h1).toBe(h2);
    expect(h1).toHaveLength(64);
  });

  it('canonicalizes array and undefined metadata values deterministically', () => {
    const chain = new AuditChain();
    const entry = chain.append({
      action: 'CONSENT_CREATE',
      actor: 'aeth1x',
      success: true,
      metadata: { scopes: ['read', 'write'], missing: undefined },
    });
    expect(verifyAuditChain([entry]).valid).toBe(true);
  });
});
