/** @jest-environment node */

import { AuditChain } from '@/lib/crypto/audit-chain';
import { isSealed, sealJson } from '@/lib/crypto/envelope';
import { EncryptedDocumentRepository } from '@/lib/persistence/encrypted-documents';
import { InMemoryDocumentStore } from '@/lib/persistence/document-store';

interface Doc {
  id: string;
  secret: string;
  count: number;
}

const OWNER = 'aeth1owner';
const COLLECTION = 'test-doc';

function newRepo() {
  const store = new InMemoryDocumentStore();
  const audit = new AuditChain();
  const repo = new EncryptedDocumentRepository<Doc>(store, audit, COLLECTION, {
    create: 'GRANT_CREATE',
    update: 'GRANT_UPDATE',
  });
  return { store, audit, repo };
}

function aad(id: string): string {
  return `${COLLECTION}:${OWNER}:${id}`;
}

describe('EncryptedDocumentRepository', () => {
  it('encrypts the document at rest and decrypts on read', async () => {
    const { store, repo } = newRepo();
    const created = await repo.create(OWNER, { id: 'd1', secret: 'TOP-SECRET-PHI', count: 3 });
    expect(created.secret).toBe('TOP-SECRET-PHI');

    const row = await store.findById(COLLECTION, OWNER, 'd1');
    expect(isSealed(row!.sealed)).toBe(true);
    expect(JSON.stringify(row!.sealed)).not.toContain('TOP-SECRET-PHI');

    expect((await repo.get(OWNER, 'd1'))?.secret).toBe('TOP-SECRET-PHI');
  });

  it('lists an owner\'s non-deleted documents', async () => {
    const { store, repo } = newRepo();
    await repo.create(OWNER, { id: 'd1', secret: 's1', count: 1 });
    await repo.create(OWNER, { id: 'd2', secret: 's2', count: 2 });
    // Inject a pre-deleted document directly into the store.
    await store.put({
      collection: COLLECTION, ownerKey: OWNER, id: 'd3',
      sealed: sealJson({ id: 'd3', secret: 's3', count: 3 }, aad('d3')), deleted: true,
    });

    const ids = (await repo.list(OWNER)).map((d) => d.id);
    expect(ids).toEqual(['d2', 'd1']);
  });

  it('returns undefined when getting a missing or deleted document', async () => {
    const { store, repo } = newRepo();
    expect(await repo.get(OWNER, 'nope')).toBeUndefined();

    await store.put({
      collection: COLLECTION, ownerKey: OWNER, id: 'dead',
      sealed: sealJson({ id: 'dead', secret: 'x', count: 0 }, aad('dead')), deleted: true,
    });
    expect(await repo.get(OWNER, 'dead')).toBeUndefined();
  });

  it('merges a patch and re-seals on update', async () => {
    const { repo } = newRepo();
    await repo.create(OWNER, { id: 'd1', secret: 'orig', count: 1 });

    const updated = await repo.update(OWNER, 'd1', { count: 9 });
    expect(updated).toEqual({ id: 'd1', secret: 'orig', count: 9 });

    const reread = await repo.get(OWNER, 'd1');
    expect(reread?.count).toBe(9);
  });

  it('returns undefined when updating a missing or deleted document', async () => {
    const { store, repo } = newRepo();
    expect(await repo.update(OWNER, 'nope', { count: 1 })).toBeUndefined();

    await store.put({
      collection: COLLECTION, ownerKey: OWNER, id: 'dead',
      sealed: sealJson({ id: 'dead', secret: 'x', count: 0 }, aad('dead')), deleted: true,
    });
    expect(await repo.update(OWNER, 'dead', { count: 2 })).toBeUndefined();
  });

  it('writes a tamper-evident audit entry per mutation', async () => {
    const { audit, repo } = newRepo();
    await repo.create(OWNER, { id: 'd1', secret: 's', count: 1 });
    await repo.update(OWNER, 'd1', { count: 2 });

    expect(audit.snapshot().map((e) => e.action)).toEqual(['GRANT_CREATE', 'GRANT_UPDATE']);
    expect(audit.verify().valid).toBe(true);
  });

  it('binds ciphertext to its collection:owner:id context', async () => {
    const { store, repo } = newRepo();
    await repo.create(OWNER, { id: 'd1', secret: 's', count: 1 });
    // A document sealed under a different owner cannot be read as this owner.
    const otherSealed = sealJson({ id: 'd1', secret: 's', count: 1 }, `${COLLECTION}:attacker:d1`);
    await store.put({ collection: COLLECTION, ownerKey: OWNER, id: 'd1', sealed: otherSealed, deleted: false });
    await expect(repo.get(OWNER, 'd1')).rejects.toThrow();
  });
});
