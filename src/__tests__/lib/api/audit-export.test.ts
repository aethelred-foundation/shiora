/** @jest-environment node */

import { PersistentAuditLog } from '@/lib/api/audit-log';
import { InMemoryAuditStore } from '@/lib/persistence/audit-store';
import { buildAuditExport, verifyAuditExport } from '@/lib/api/audit-export';
import { __resetDerivedSecretsForTests } from '@/lib/crypto/derived-secrets';

afterEach(() => __resetDerivedSecretsForTests());

async function chainOf(n: number): Promise<PersistentAuditLog> {
  const log = new PersistentAuditLog(new InMemoryAuditStore());
  for (let i = 0; i < n; i++) {
    await log.record({ action: 'RECORD_CREATE', actor: 'aeth1a', resource: 'record', resourceId: `r${i}`, success: true });
  }
  return log;
}

describe('audit WORM export (GAP-28)', () => {
  it('exports the whole chain, signed and self-verifiable', async () => {
    const log = await chainOf(4);
    const bundle = await log.exportSegment();

    expect(bundle.count).toBe(4);
    expect(bundle.fromSeq).toBe(0);
    expect(bundle.toSeq).toBe(3);
    expect(bundle.chainHead.length).toBe(4);
    expect(bundle.signature).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(verifyAuditExport(bundle)).toEqual({ valid: true });
  });

  it('exports a contiguous sub-segment that still verifies', async () => {
    const log = await chainOf(6);
    const bundle = await log.exportSegment(2, 4);
    expect(bundle.entries.map((e) => e.seq)).toEqual([2, 3, 4]);
    expect(bundle.chainHead.length).toBe(6); // head is the whole chain
    expect(verifyAuditExport(bundle)).toEqual({ valid: true });
  });

  it('exports an empty bundle for an empty chain', async () => {
    const log = new PersistentAuditLog(new InMemoryAuditStore());
    const bundle = await log.exportSegment();
    expect(bundle.count).toBe(0);
    expect(bundle.toSeq).toBe(-1);
    expect(verifyAuditExport(bundle)).toEqual({ valid: true });
  });

  it('a post-signing tamper is caught by the signature before anything else', async () => {
    const log = await chainOf(3);
    const bundle = await log.exportSegment();
    bundle.entries[1].actor = 'aeth1attacker'; // rewrite after signing
    expect(verifyAuditExport(bundle)).toEqual({ valid: false, reason: 'signature mismatch' });
  });

  it('detects a validly-signed bundle whose entry content no longer matches its hash', async () => {
    const log = await chainOf(3);
    const bundle = await log.exportSegment();
    // Corrupt content but keep the (now stale) hash, THEN re-sign so the
    // signature is valid — only the internal hash check can catch this.
    bundle.entries[1].actor = 'aeth1attacker';
    const resigned = buildAuditExport(bundle.entries, bundle.chainHead, bundle.exportedAt);
    expect(verifyAuditExport(resigned)).toEqual({ valid: false, reason: expect.stringContaining('content hash mismatch') });
  });

  it('detects a re-signed-but-relinked forgery (broken linkage)', async () => {
    const log = await chainOf(3);
    const bundle = await log.exportSegment();
    bundle.entries.splice(1, 1); // drop the middle entry
    const resigned = buildAuditExport(bundle.entries, bundle.chainHead, bundle.exportedAt);
    expect(verifyAuditExport(resigned)).toEqual({ valid: false, reason: expect.stringContaining('broken linkage') });
  });

  it('detects a non-contiguous sequence whose linkage was forged to match', async () => {
    const log = await chainOf(2); // seq 0,1
    const bundle = await log.exportSegment();
    const [e0, e1] = bundle.entries;
    // A third entry re-pointed to link after e1 (linkage passes) but reusing
    // e1's seq — so the seq check, not linkage, must catch it.
    const dupe = { ...e1, prevHash: e1.hash };
    const forged = buildAuditExport([e0, e1, dupe], bundle.chainHead, bundle.exportedAt);
    expect(verifyAuditExport(forged)).toEqual({ valid: false, reason: expect.stringContaining('non-contiguous') });
  });

  it('detects a tampered signature', async () => {
    const log = await chainOf(2);
    const bundle = await log.exportSegment();
    bundle.signature = bundle.signature.slice(0, -2) + 'xx';
    expect(verifyAuditExport(bundle)).toEqual({ valid: false, reason: 'signature mismatch' });
  });
});
