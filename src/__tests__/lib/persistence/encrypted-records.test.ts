/** @jest-environment node */

import { AuditChain } from '@/lib/crypto/audit-chain';
import { isSealed } from '@/lib/crypto/envelope';
import { EncryptedRecordRepository } from '@/lib/persistence/encrypted-records';
import { InMemoryRecordStore } from '@/lib/persistence/record-store';
import type { MockHealthRecord } from '@/lib/api/mock-data';

const OWNER = 'aeth1owner000000000000000000000000000000';
const OTHER = 'aeth1other000000000000000000000000000000';

function makeRecord(overrides: Partial<MockHealthRecord> = {}): MockHealthRecord {
  return {
    id: 'rec-1',
    type: 'lab-result',
    label: 'BRCA1 panel',
    description: 'Hereditary breast cancer gene panel — pathogenic variant noted',
    date: 1_700_000_000_000,
    uploadDate: 1_700_000_100_000,
    encrypted: false,
    encryption: 'none',
    cid: 'bafy-cid',
    txHash: '0xabc',
    attestation: 'att-1',
    size: 2048,
    provider: 'Dr. Rivera',
    status: 'Verified',
    ipfsNodes: 3,
    tags: ['genomics', 'oncology'],
    deleted: false,
    ownerAddress: OWNER,
    blockHeight: 100,
    ...overrides,
  };
}

function newRepo() {
  const store = new InMemoryRecordStore();
  const audit = new AuditChain();
  const repo = new EncryptedRecordRepository(store, audit);
  return { store, audit, repo };
}

describe('EncryptedRecordRepository', () => {
  it('encrypts PHI at rest and decrypts on read', async () => {
    const { store, repo } = newRepo();
    const created = await repo.create(OWNER, makeRecord());

    // Returned record is decrypted and flagged as encrypted-at-rest.
    expect(created.label).toBe('BRCA1 panel');
    expect(created.encrypted).toBe(true);
    expect(created.encryption).toBe('AES-256-GCM');

    // The stored row holds a sealed envelope, not plaintext PHI.
    const row = await store.findById(OWNER, 'rec-1');
    expect(row).toBeDefined();
    expect(isSealed(row!.sealedPhi)).toBe(true);
    const serialized = JSON.stringify(row!.sealedPhi);
    expect(serialized).not.toContain('BRCA1');
    expect(serialized).not.toContain('oncology');

    const fetched = await repo.get(OWNER, 'rec-1');
    expect(fetched?.label).toBe('BRCA1 panel');
    expect(fetched?.tags).toEqual(['genomics', 'oncology']);
  });

  it('scopes reads to the owner', async () => {
    const { repo } = newRepo();
    await repo.create(OWNER, makeRecord());
    expect(await repo.get(OTHER, 'rec-1')).toBeUndefined();
    expect(await repo.list(OTHER)).toEqual([]);
  });

  it('lists only non-deleted records', async () => {
    const { repo } = newRepo();
    await repo.create(OWNER, makeRecord({ id: 'rec-1' }));
    await repo.create(OWNER, makeRecord({ id: 'rec-2', label: 'Lipid panel' }));
    await repo.softDelete(OWNER, 'rec-2');

    const list = await repo.list(OWNER);
    expect(list.map((r) => r.id)).toEqual(['rec-1']);
  });

  it('returns undefined when getting a missing or deleted record', async () => {
    const { repo } = newRepo();
    expect(await repo.get(OWNER, 'nope')).toBeUndefined();

    await repo.create(OWNER, makeRecord());
    await repo.softDelete(OWNER, 'rec-1');
    expect(await repo.get(OWNER, 'rec-1')).toBeUndefined();
  });

  it('updates metadata without touching PHI', async () => {
    const { repo } = newRepo();
    await repo.create(OWNER, makeRecord());

    const updated = await repo.update(OWNER, 'rec-1', { status: 'Pinned', provider: 'Dr. Chen' });
    expect(updated?.status).toBe('Pinned');
    expect(updated?.provider).toBe('Dr. Chen');
    expect(updated?.label).toBe('BRCA1 panel'); // PHI untouched
  });

  it('re-seals PHI when a single PHI field changes (others fall back)', async () => {
    const { repo } = newRepo();
    await repo.create(OWNER, makeRecord());

    const updated = await repo.update(OWNER, 'rec-1', { label: 'BRCA1/2 panel' });
    expect(updated?.label).toBe('BRCA1/2 panel');
    expect(updated?.description).toContain('Hereditary'); // fell back
    expect(updated?.tags).toEqual(['genomics', 'oncology']); // fell back

    const reread = await repo.get(OWNER, 'rec-1');
    expect(reread?.label).toBe('BRCA1/2 panel');
  });

  it('re-seals PHI when description and tags change (label falls back)', async () => {
    const { repo } = newRepo();
    await repo.create(OWNER, makeRecord());

    const updated = await repo.update(OWNER, 'rec-1', {
      description: 'Updated interpretation',
      tags: ['genomics'],
    });
    expect(updated?.label).toBe('BRCA1 panel'); // fell back
    expect(updated?.description).toBe('Updated interpretation');
    expect(updated?.tags).toEqual(['genomics']);
  });

  it('returns undefined when updating a missing or deleted record', async () => {
    const { repo } = newRepo();
    expect(await repo.update(OWNER, 'nope', { status: 'Pinned' })).toBeUndefined();

    await repo.create(OWNER, makeRecord());
    await repo.softDelete(OWNER, 'rec-1');
    expect(await repo.update(OWNER, 'rec-1', { status: 'Pinned' })).toBeUndefined();
  });

  it('soft-deletes a record and is idempotent against missing/deleted ids', async () => {
    const { repo } = newRepo();
    expect(await repo.softDelete(OWNER, 'nope')).toBeUndefined();

    await repo.create(OWNER, makeRecord());
    const deleted = await repo.softDelete(OWNER, 'rec-1');
    expect(deleted?.deleted).toBe(true);

    expect(await repo.softDelete(OWNER, 'rec-1')).toBeUndefined(); // already deleted
  });

  it('writes a tamper-evident audit entry for every mutation', async () => {
    const { audit, repo } = newRepo();
    await repo.create(OWNER, makeRecord());
    await repo.get(OWNER, 'rec-1');
    await repo.update(OWNER, 'rec-1', { status: 'Pinned' });
    await repo.softDelete(OWNER, 'rec-1');

    const entries = audit.snapshot();
    expect(entries.map((e) => e.action)).toEqual([
      'RECORD_CREATE',
      'RECORD_READ',
      'RECORD_UPDATE',
      'RECORD_DELETE',
    ]);
    expect(audit.verify().valid).toBe(true);
  });
});
