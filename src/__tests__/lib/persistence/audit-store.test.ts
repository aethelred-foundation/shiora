/** @jest-environment node */

import { InMemoryAuditStore } from '@/lib/persistence/audit-store';
import { GENESIS_HASH, verifyAuditChain } from '@/lib/crypto/audit-chain';
import type { AuditEntry } from '@/lib/api/audit';

function base(actor: string): AuditEntry {
  return { action: 'RECORD_CREATE', actor, resource: 'record', resourceId: 'r1', success: true, timestamp: 't' };
}

describe('InMemoryAuditStore', () => {
  it('appends a linked, verifiable chain and lists it in order', async () => {
    const store = new InMemoryAuditStore();
    const a = await store.append(base('aeth1a'));
    const b = await store.append(base('aeth1b'));

    expect(a.seq).toBe(0);
    expect(a.prevHash).toBe(GENESIS_HASH);
    expect(b.seq).toBe(1);
    expect(b.prevHash).toBe(a.hash);

    const all = await store.list();
    expect(all.map((e) => e.seq)).toEqual([0, 1]);
    expect(verifyAuditChain(all).valid).toBe(true);
  });
});
