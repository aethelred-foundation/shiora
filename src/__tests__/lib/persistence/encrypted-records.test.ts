/** @jest-environment node */

import { AuditChain } from '@/lib/crypto/audit-chain';
import { isSealed, isShredded, shredEnvelope } from '@/lib/crypto/envelope';
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

  describe('cryptoShred (GDPR erasure, GAP-13)', () => {
    it('destroys the PHI DEK so label/description/tags are unrecoverable', async () => {
      const { store, repo } = newRepo();
      await repo.create(OWNER, makeRecord());

      expect(await repo.cryptoShred(OWNER, 'rec-1')).toBe(true);

      const row = await store.findById(OWNER, 'rec-1');
      expect(isShredded(row!.sealedPhi)).toBe(true);
      expect(JSON.stringify(row!.sealedPhi)).not.toContain('BRCA1');
      expect(row!.deleted).toBe(true);
      expect(await repo.get(OWNER, 'rec-1')).toBeUndefined();
    });

    it('shreds an already soft-deleted record and is idempotent', async () => {
      const { repo } = newRepo();
      await repo.create(OWNER, makeRecord());
      await repo.softDelete(OWNER, 'rec-1');

      expect(await repo.cryptoShred(OWNER, 'rec-1')).toBe(true);
      expect(await repo.cryptoShred(OWNER, 'rec-1')).toBe(false); // already shredded
      expect(await repo.cryptoShred(OWNER, 'nope')).toBe(false); // never existed
    });

    it('a shredded row surfaced to a reader throws rather than leaking', async () => {
      const { store, repo } = newRepo();
      await repo.create(OWNER, makeRecord());
      const row = await store.findById(OWNER, 'rec-1');
      // Force a shredded-but-visible row (should never happen in practice).
      await store.put({ ...row!, sealedPhi: shredEnvelope(), deleted: false });
      await expect(repo.get(OWNER, 'rec-1')).rejects.toThrow(/crypto-shredded/);
    });
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

  describe('optimistic concurrency (GAP-18)', () => {
    it('assigns version 1 on create and bumps on update', async () => {
      const { repo } = newRepo();
      await repo.create(OWNER, makeRecord());
      expect(await repo.version(OWNER, 'rec-1')).toBe(1);
      await repo.update(OWNER, 'rec-1', { status: 'Pinned' });
      expect(await repo.version(OWNER, 'rec-1')).toBe(2);
    });

    it('version returns undefined for a missing or deleted record', async () => {
      const { repo } = newRepo();
      expect(await repo.version(OWNER, 'nope')).toBeUndefined();
      await repo.create(OWNER, makeRecord());
      await repo.softDelete(OWNER, 'rec-1');
      expect(await repo.version(OWNER, 'rec-1')).toBeUndefined();
    });

    it('rejects a stale expectedVersion, allows the matching one', async () => {
      const { repo } = newRepo();
      await repo.create(OWNER, makeRecord());
      const ok = await repo.update(OWNER, 'rec-1', { provider: 'Dr. New' }, 1);
      expect(ok!.provider).toBe('Dr. New');
      await expect(repo.update(OWNER, 'rec-1', { provider: 'X' }, 1)).rejects.toMatchObject({
        name: 'OptimisticLockError', expected: 1, actual: 2,
      });
    });
  });

  describe('blind-index tag search (GAP-15)', () => {
    it('finds records by exact tag without exposing the tag in cleartext', async () => {
      const { store, repo } = newRepo();
      await repo.create(OWNER, makeRecord({ id: 'r1', tags: ['genomics', 'oncology'] }));
      await repo.create(OWNER, makeRecord({ id: 'r2', tags: ['cardiology'] }));

      // The stored row carries opaque blind tokens, not the plaintext tags.
      const row = await store.findById(OWNER, 'r1');
      expect(row!.blindTags!.length).toBe(2);
      expect(JSON.stringify(row!.blindTags)).not.toContain('genomics');

      // Search matches by exact (normalized) tag, without decrypting.
      expect((await repo.findByTag(OWNER, 'genomics')).map((r) => r.id)).toEqual(['r1']);
      expect((await repo.findByTag(OWNER, 'GENOMICS')).map((r) => r.id)).toEqual(['r1']); // case-insensitive
      expect((await repo.findByTag(OWNER, 'cardiology')).map((r) => r.id)).toEqual(['r2']);
      expect(await repo.findByTag(OWNER, 'nonexistent')).toEqual([]);
    });

    it('excludes soft-deleted records and scopes to the owner', async () => {
      const { repo } = newRepo();
      await repo.create(OWNER, makeRecord({ id: 'r1', tags: ['shared'] }));
      await repo.create(OTHER, makeRecord({ id: 'r2', tags: ['shared'] }));
      await repo.softDelete(OWNER, 'r1');
      expect(await repo.findByTag(OWNER, 'shared')).toEqual([]); // deleted excluded
      expect((await repo.findByTag(OTHER, 'shared')).map((r) => r.id)).toEqual(['r2']);
    });

    it('re-indexes blind tags when tags change on update', async () => {
      const { repo } = newRepo();
      await repo.create(OWNER, makeRecord({ id: 'r1', tags: ['old-tag'] }));
      await repo.update(OWNER, 'r1', { tags: ['new-tag'] });
      expect(await repo.findByTag(OWNER, 'old-tag')).toEqual([]);
      expect((await repo.findByTag(OWNER, 'new-tag')).map((r) => r.id)).toEqual(['r1']);
    });

    it('treats a record with no blindTags as unmatched (legacy row)', async () => {
      const { store, repo } = newRepo();
      await repo.create(OWNER, makeRecord({ id: 'r1', tags: ['x'] }));
      const row = await store.findById(OWNER, 'r1');
      await store.put({ ...row!, blindTags: undefined }); // simulate a pre-GAP-15 row
      expect(await repo.findByTag(OWNER, 'x')).toEqual([]);
    });
  });

  describe('scanForReseal cursor resumption (GAP-14)', () => {
    it('resumes after the cursor id, and restarts when that id no longer exists', async () => {
      const { store, repo } = newRepo();
      await repo.create(OWNER, makeRecord({ id: 'a' }));
      await repo.create(OWNER, makeRecord({ id: 'b' }));
      const { encodeCursor } = await import('@/lib/persistence/reseal-cursor');

      // A cursor at an existing id resumes strictly after it (afterIndex → idx + 1).
      const afterA = await store.scanForReseal(encodeCursor(['a']), 10);
      expect(afterA.rows.map((r) => r.id)).toEqual(['b']);

      // A cursor at an id purged since it was issued restarts from the top
      // (afterIndex → 0) rather than silently skipping the remaining rows.
      const afterGhost = await store.scanForReseal(encodeCursor(['zzz']), 10);
      expect(afterGhost.rows.map((r) => r.id)).toEqual(['a', 'b']);
    });
  });
});
