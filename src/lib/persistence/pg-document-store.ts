// ============================================================
// Shiora on Aethelred — Postgres Document Store
//
// Production DocumentStorePort backed by Postgres. Documents are persisted only
// as a sealed envelope in the JSONB `sealed` column; reads are scoped by
// (collection, owner_key). One table serves every owner-scoped collection.
// ============================================================

import type { SealedEnvelope, ShreddedEnvelope } from '@/lib/crypto/envelope';
import { DOCUMENTS_DDL, DOCUMENTS_OWNER_INDEX_DDL } from './schema';
import type { DocumentStorePort, StoredDocument } from './document-store';
import { type ResealScanPage, encodeCursor, decodeCursor } from './reseal-cursor';
import type { SqlClient } from './sql-client';

interface DocumentRow {
  collection: string;
  owner_key: string;
  id: string;
  sealed: SealedEnvelope | ShreddedEnvelope;
  deleted: boolean;
}

function rowToDocument(row: DocumentRow): StoredDocument {
  return {
    collection: row.collection,
    ownerKey: row.owner_key,
    id: row.id,
    sealed: row.sealed,
    deleted: row.deleted,
  };
}

export class PgDocumentStore implements DocumentStorePort {
  constructor(private readonly client: SqlClient) {}

  /** Create the documents table and its index. Idempotent. */
  async migrate(): Promise<void> {
    await this.client.query(DOCUMENTS_DDL);
    await this.client.query(DOCUMENTS_OWNER_INDEX_DDL);
  }

  async put(doc: StoredDocument): Promise<void> {
    await this.client.query(
      `INSERT INTO documents (collection, owner_key, id, sealed, deleted, updated_at)
       VALUES ($1,$2,$3,$4::jsonb,$5, now())
       ON CONFLICT (collection, id) DO UPDATE SET
         owner_key=EXCLUDED.owner_key, sealed=EXCLUDED.sealed,
         deleted=EXCLUDED.deleted, updated_at=now()`,
      [doc.collection, doc.ownerKey, doc.id, JSON.stringify(doc.sealed), doc.deleted],
    );
  }

  async findById(
    collection: string,
    ownerKey: string,
    id: string,
  ): Promise<StoredDocument | undefined> {
    const { rows } = await this.client.query<DocumentRow>(
      `SELECT collection, owner_key, id, sealed, deleted FROM documents
       WHERE collection=$1 AND owner_key=$2 AND id=$3`,
      [collection, ownerKey, id],
    );
    const row = rows[0];
    return row ? rowToDocument(row) : undefined;
  }

  async findByOwner(collection: string, ownerKey: string): Promise<StoredDocument[]> {
    const { rows } = await this.client.query<DocumentRow>(
      `SELECT collection, owner_key, id, sealed, deleted FROM documents
       WHERE collection=$1 AND owner_key=$2
       ORDER BY created_at DESC`,
      [collection, ownerKey],
    );
    return rows.map(rowToDocument);
  }

  async listAll(collection: string): Promise<StoredDocument[]> {
    const { rows } = await this.client.query<DocumentRow>(
      `SELECT collection, owner_key, id, sealed, deleted FROM documents
       WHERE collection=$1
       ORDER BY created_at DESC`,
      [collection],
    );
    return rows.map(rowToDocument);
  }

  async scanForReseal(
    cursor: string | null,
    limit: number,
  ): Promise<ResealScanPage<StoredDocument>> {
    const [c, i] = cursor ? decodeCursor(cursor) : ['', ''];
    const { rows } = await this.client.query<DocumentRow>(
      `SELECT collection, owner_key, id, sealed, deleted FROM documents
       WHERE ($1 = '' OR (collection, id) > ($1, $2))
       ORDER BY collection, id
       LIMIT $3`,
      [c, i, limit],
    );
    const docs = rows.map(rowToDocument);
    const last = docs[docs.length - 1];
    return {
      rows: docs,
      nextCursor: docs.length === limit && last ? encodeCursor([last.collection, last.id]) : null,
    };
  }
}
