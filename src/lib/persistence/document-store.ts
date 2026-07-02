// ============================================================
// Shiora on Aethelred — Encrypted Document Storage Port
//
// A general-purpose, owner-scoped document store. Each document is persisted
// only as a sealed envelope (see src/lib/crypto/envelope.ts), so no storage
// driver ever sees plaintext. Used by every owner-scoped collection
// (access grants, consent records, …) behind a single, reusable interface.
// ============================================================

import type { SealedEnvelope, ShreddedEnvelope } from '@/lib/crypto/envelope';
import {
  type ResealScanPage,
  encodeCursor,
  decodeCursor,
} from './reseal-cursor';

/** A stored document: identity in the clear, payload sealed. */
export interface StoredDocument {
  /** Logical collection name, e.g. `access-grant` or `consent`. */
  collection: string;
  /** Owner scope (wallet address) the document belongs to. */
  ownerKey: string;
  /** Document id, unique within its collection. */
  id: string;
  /** Envelope-encrypted full document. */
  /** Envelope-encrypted payload, or a shred tombstone after crypto-erasure. */
  sealed: SealedEnvelope | ShreddedEnvelope;
  deleted: boolean;
  /** Monotonic version for optimistic concurrency (GAP-18); absent = 1. */
  version?: number;
  /** When the row was soft-deleted (ms), for retention purging (GAP-16). */
  deletedAt?: number;
}

export interface DocumentStorePort {
  /** Insert a new document or replace an existing one with the same id. */
  put(doc: StoredDocument): Promise<void>;
  findById(collection: string, ownerKey: string, id: string): Promise<StoredDocument | undefined>;
  findByOwner(collection: string, ownerKey: string): Promise<StoredDocument[]>;
  /**
   * Every document in a collection across all owners. For aggregate analytics
   * only — never expose individual documents from this to an owner.
   */
  listAll(collection: string): Promise<StoredDocument[]>;
  /**
   * Walk every document across all collections in stable (collection, id)
   * order for KEK re-sealing (GAP-14). Resumable via the opaque cursor.
   */
  scanForReseal(cursor: string | null, limit: number): Promise<ResealScanPage<StoredDocument>>;
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

  async listAll(collection: string): Promise<StoredDocument[]> {
    const prefix = `${collection}::`;
    const all: StoredDocument[] = [];
    this.byKey.forEach((docs, mapKey) => {
      if (mapKey.startsWith(prefix)) {
        docs.forEach((doc) => all.push({ ...doc }));
      }
    });
    return all;
  }

  async scanForReseal(
    cursor: string | null,
    limit: number,
  ): Promise<ResealScanPage<StoredDocument>> {
    const all: StoredDocument[] = [];
    this.byKey.forEach((docs) => docs.forEach((doc) => all.push({ ...doc })));
    all.sort((a, b) =>
      a.collection === b.collection
        ? a.id.localeCompare(b.id)
        : a.collection.localeCompare(b.collection));

    const start = cursor ? this.afterIndex(all, decodeCursor(cursor)) : 0;
    const page = all.slice(start, start + limit);
    const more = start + limit < all.length;
    const last = page[page.length - 1];
    return {
      rows: page,
      nextCursor: more && last ? encodeCursor([last.collection, last.id]) : null,
    };
  }

  private afterIndex(sorted: StoredDocument[], [collection, id]: string[]): number {
    const idx = sorted.findIndex((d) => d.collection === collection && d.id === id);
    return idx === -1 ? 0 : idx + 1;
  }
}
