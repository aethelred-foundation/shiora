// ============================================================
// Shiora on Aethelred — Encrypted Document Storage Port
//
// A general-purpose, owner-scoped document store. Each document is persisted
// only as a sealed envelope (see src/lib/crypto/envelope.ts), so no storage
// driver ever sees plaintext. Used by every owner-scoped collection
// (access grants, consent records, …) behind a single, reusable interface.
// ============================================================

import type { SealedEnvelope } from '@/lib/crypto/envelope';

/** A stored document: identity in the clear, payload sealed. */
export interface StoredDocument {
  /** Logical collection name, e.g. `access-grant` or `consent`. */
  collection: string;
  /** Owner scope (wallet address) the document belongs to. */
  ownerKey: string;
  /** Document id, unique within its collection. */
  id: string;
  /** Envelope-encrypted full document. */
  sealed: SealedEnvelope;
  deleted: boolean;
}

export interface DocumentStorePort {
  /** Insert a new document or replace an existing one with the same id. */
  put(doc: StoredDocument): Promise<void>;
  findById(collection: string, ownerKey: string, id: string): Promise<StoredDocument | undefined>;
  findByOwner(collection: string, ownerKey: string): Promise<StoredDocument[]>;
}

/**
 * In-memory {@link DocumentStorePort}. Default driver in development/test and
 * the reference implementation the Postgres adapter is checked against. Newest
 * documents are returned first.
 */
export class InMemoryDocumentStore implements DocumentStorePort {
  private readonly byKey = new Map<string, StoredDocument[]>();

  private key(collection: string, ownerKey: string): string {
    return `${collection}::${ownerKey}`;
  }

  async put(doc: StoredDocument): Promise<void> {
    const mapKey = this.key(doc.collection, doc.ownerKey);
    const list = this.byKey.get(mapKey) ?? [];
    const index = list.findIndex((entry) => entry.id === doc.id);
    if (index === -1) {
      list.unshift({ ...doc });
    } else {
      list[index] = { ...doc };
    }
    this.byKey.set(mapKey, list);
  }

  async findById(
    collection: string,
    ownerKey: string,
    id: string,
  ): Promise<StoredDocument | undefined> {
    const doc = (this.byKey.get(this.key(collection, ownerKey)) ?? []).find(
      (entry) => entry.id === id,
    );
    return doc ? { ...doc } : undefined;
  }

  async findByOwner(collection: string, ownerKey: string): Promise<StoredDocument[]> {
    return (this.byKey.get(this.key(collection, ownerKey)) ?? []).map((entry) => ({ ...entry }));
  }
}
