/** @jest-environment node */

import { sealJson } from '@/lib/crypto/envelope';
import { PgDocumentStore } from '@/lib/persistence/pg-document-store';
import type { SqlClient } from '@/lib/persistence/sql-client';
import type { StoredDocument } from '@/lib/persistence/document-store';

class FakeSqlClient implements SqlClient {
  readonly calls: { text: string; params?: unknown[] }[] = [];
  private readonly queue: unknown[][] = [];

  enqueue(rows: unknown[]): void {
    this.queue.push(rows);
  }

  async query<T = Record<string, unknown>>(text: string, params?: unknown[]) {
    this.calls.push({ text, params });
    return { rows: (this.queue.shift() ?? []) as T[] };
  }
}

const COLLECTION = 'access-grant';
const OWNER = 'aeth1owner';

async function storedDoc(): Promise<StoredDocument> {
  // No version field → put() must fall back to version 1.
  return {
    collection: COLLECTION,
    ownerKey: OWNER,
    id: 'doc-1',
    sealed: await sealJson({ id: 'doc-1', v: 1 }, `${COLLECTION}:${OWNER}:doc-1`),
    deleted: false,
  };
}

async function docRow() {
  return {
    collection: COLLECTION,
    owner_key: OWNER,
    id: 'doc-1',
    sealed: await sealJson({ id: 'doc-1', v: 1 }, `${COLLECTION}:${OWNER}:doc-1`),
    deleted: true,
    version: 1,
    deleted_at: 1700000000000,
  };
}

describe('PgDocumentStore', () => {
  it('migrates the documents table and its index', async () => {
    const client = new FakeSqlClient();
    await new PgDocumentStore(client).migrate();
    expect(client.calls).toHaveLength(2);
    expect(client.calls[0].text).toContain('CREATE TABLE IF NOT EXISTS documents');
    expect(client.calls[1].text).toContain('idx_documents_owner');
  });

  it('upserts a document with the sealed payload serialized as JSON', async () => {
    const client = new FakeSqlClient();
    await new PgDocumentStore(client).put(await storedDoc());
    const { text, params } = client.calls[0];
    expect(text).toContain('INSERT INTO documents');
    expect(text).toContain('ON CONFLICT (collection, id) DO UPDATE SET');
    expect(params).toHaveLength(7);
    expect(typeof params![3]).toBe('string');
    expect(params![5]).toBe(1); // version
    expect(params![6]).toBeNull(); // deleted_at (not set → null)
  });

  it('finds a document by collection, owner, and id', async () => {
    const client = new FakeSqlClient();
    client.enqueue([await docRow()]);
    const found = await new PgDocumentStore(client).findById(COLLECTION, OWNER, 'doc-1');
    expect(found?.id).toBe('doc-1');
    expect(found?.ownerKey).toBe(OWNER);
    expect(found?.deletedAt).toBe(1700000000000); // mapped from deleted_at
    expect(client.calls[0].params).toEqual([COLLECTION, OWNER, 'doc-1']);
  });

  it('returns undefined when no document matches', async () => {
    const client = new FakeSqlClient();
    expect(await new PgDocumentStore(client).findById(COLLECTION, OWNER, 'nope')).toBeUndefined();
  });

  it('omits deletedAt when the row was never soft-deleted (deleted_at null)', async () => {
    const client = new FakeSqlClient();
    client.enqueue([{ ...await docRow(), deleted: false, deleted_at: null }]);
    const found = await new PgDocumentStore(client).findById(COLLECTION, OWNER, 'doc-1');
    expect(found).toBeDefined();
    expect(found?.deletedAt).toBeUndefined();
  });

  it('lists an owner\'s documents ordered by recency', async () => {
    const client = new FakeSqlClient();
    client.enqueue([await docRow(), { ...await docRow(), id: 'doc-2' }]);
    const docs = await new PgDocumentStore(client).findByOwner(COLLECTION, OWNER);
    expect(docs.map((d) => d.id)).toEqual(['doc-1', 'doc-2']);
    expect(client.calls[0].text).toContain('ORDER BY created_at DESC');
  });

  it('listAll returns every document in a collection across owners', async () => {
    const client = new FakeSqlClient();
    client.enqueue([await docRow(), { ...await docRow(), owner_key: 'other', id: 'doc-2' }]);
    const docs = await new PgDocumentStore(client).listAll(COLLECTION);
    expect(docs.map((d) => d.id)).toEqual(['doc-1', 'doc-2']);
    expect(client.calls[0].params).toEqual([COLLECTION]);
    expect(client.calls[0].text).toContain('WHERE collection=$1');
  });

  describe('scanForReseal (GAP-14)', () => {
    it('scans from the start with no cursor and reports a next cursor when full', async () => {
      const client = new FakeSqlClient();
      const store = new PgDocumentStore(client);
      const rows = await Promise.all(Array.from({ length: 2 }, async (_, i) => ({
        collection: 'c', owner_key: OWNER, id: `d${i}`,
        sealed: await sealJson({ id: `d${i}` }, `c:${OWNER}:d${i}`), deleted: false,
      })));
      client.enqueue(rows);

      const page = await store.scanForReseal(null, 2);
      expect(page.rows).toHaveLength(2);
      expect(page.nextCursor).not.toBeNull(); // page was full → more may remain
      const call = client.calls[0];
      expect(call.text).toContain('ORDER BY collection, id');
      expect(call.params).toEqual(['', '', 2]); // empty cursor sentinel
    });

    it('decodes the cursor into (collection, id) bounds and stops when short', async () => {
      const client = new FakeSqlClient();
      const store = new PgDocumentStore(client);
      const { encodeCursor } = await import('@/lib/persistence/reseal-cursor');
      client.enqueue([{
        collection: 'c', owner_key: OWNER, id: 'last',
        sealed: await sealJson({ id: 'last' }, `c:${OWNER}:last`), deleted: false,
      }]);

      const page = await store.scanForReseal(encodeCursor(['c', 'd0']), 5);
      expect(page.rows).toHaveLength(1);
      expect(page.nextCursor).toBeNull(); // fewer than limit → exhausted
      expect(client.calls[0].params).toEqual(['c', 'd0', 5]);
    });
  });
});
