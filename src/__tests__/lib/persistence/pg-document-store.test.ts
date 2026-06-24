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

function storedDoc(): StoredDocument {
  return {
    collection: COLLECTION,
    ownerKey: OWNER,
    id: 'doc-1',
    sealed: sealJson({ id: 'doc-1', v: 1 }, `${COLLECTION}:${OWNER}:doc-1`),
    deleted: false,
  };
}

function docRow() {
  return {
    collection: COLLECTION,
    owner_key: OWNER,
    id: 'doc-1',
    sealed: sealJson({ id: 'doc-1', v: 1 }, `${COLLECTION}:${OWNER}:doc-1`),
    deleted: false,
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
    await new PgDocumentStore(client).put(storedDoc());
    const { text, params } = client.calls[0];
    expect(text).toContain('INSERT INTO documents');
    expect(text).toContain('ON CONFLICT (collection, id) DO UPDATE SET');
    expect(params).toHaveLength(5);
    expect(typeof params![3]).toBe('string');
  });

  it('finds a document by collection, owner, and id', async () => {
    const client = new FakeSqlClient();
    client.enqueue([docRow()]);
    const found = await new PgDocumentStore(client).findById(COLLECTION, OWNER, 'doc-1');
    expect(found?.id).toBe('doc-1');
    expect(found?.ownerKey).toBe(OWNER);
    expect(client.calls[0].params).toEqual([COLLECTION, OWNER, 'doc-1']);
  });

  it('returns undefined when no document matches', async () => {
    const client = new FakeSqlClient();
    expect(await new PgDocumentStore(client).findById(COLLECTION, OWNER, 'nope')).toBeUndefined();
  });

  it('lists an owner\'s documents ordered by recency', async () => {
    const client = new FakeSqlClient();
    client.enqueue([docRow(), { ...docRow(), id: 'doc-2' }]);
    const docs = await new PgDocumentStore(client).findByOwner(COLLECTION, OWNER);
    expect(docs.map((d) => d.id)).toEqual(['doc-1', 'doc-2']);
    expect(client.calls[0].text).toContain('ORDER BY created_at DESC');
  });

  it('listAll returns every document in a collection across owners', async () => {
    const client = new FakeSqlClient();
    client.enqueue([docRow(), { ...docRow(), owner_key: 'other', id: 'doc-2' }]);
    const docs = await new PgDocumentStore(client).listAll(COLLECTION);
    expect(docs.map((d) => d.id)).toEqual(['doc-1', 'doc-2']);
    expect(client.calls[0].params).toEqual([COLLECTION]);
    expect(client.calls[0].text).toContain('WHERE collection=$1');
  });
});
