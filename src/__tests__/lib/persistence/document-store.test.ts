/** @jest-environment node */

import { sealJson } from '@/lib/crypto/envelope';
import { InMemoryDocumentStore, type StoredDocument } from '@/lib/persistence/document-store';

function doc(id: string, deleted = false): StoredDocument {
  return {
    collection: 'c',
    ownerKey: 'owner',
    id,
    sealed: sealJson({ id, v: 1 }, `c:owner:${id}`),
    deleted,
  };
}

describe('InMemoryDocumentStore', () => {
  it('inserts and retrieves a document by id', async () => {
    const store = new InMemoryDocumentStore();
    await store.put(doc('a'));
    expect((await store.findById('c', 'owner', 'a'))?.id).toBe('a');
  });

  it('replaces a document with the same id', async () => {
    const store = new InMemoryDocumentStore();
    await store.put(doc('a', false));
    await store.put(doc('a', true));
    const found = await store.findById('c', 'owner', 'a');
    expect(found?.deleted).toBe(true);
    expect(await store.findByOwner('c', 'owner')).toHaveLength(1);
  });

  it('returns undefined for a missing document', async () => {
    const store = new InMemoryDocumentStore();
    expect(await store.findById('c', 'owner', 'missing')).toBeUndefined();
  });

  it('lists newest-first and scopes by collection + owner', async () => {
    const store = new InMemoryDocumentStore();
    await store.put(doc('a'));
    await store.put(doc('b'));
    const list = await store.findByOwner('c', 'owner');
    expect(list.map((d) => d.id)).toEqual(['b', 'a']);
    expect(await store.findByOwner('c', 'other')).toEqual([]);
  });

  it('listAll returns every document in a collection across owners, excluding others', async () => {
    const store = new InMemoryDocumentStore();
    await store.put({ collection: 'a', ownerKey: 'o1', id: '1', sealed: sealJson({ id: '1' }, 'a:o1:1'), deleted: false });
    await store.put({ collection: 'a', ownerKey: 'o2', id: '2', sealed: sealJson({ id: '2' }, 'a:o2:2'), deleted: false });
    await store.put({ collection: 'b', ownerKey: 'o1', id: '3', sealed: sealJson({ id: '3' }, 'b:o1:3'), deleted: false });

    expect((await store.listAll('a')).map((d) => d.id).sort()).toEqual(['1', '2']);
    expect(await store.listAll('b')).toHaveLength(1);
  });
});
