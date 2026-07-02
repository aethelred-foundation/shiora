// ============================================================
// Shiora on Aethelred — Health Record Storage Port
//
// Defines the narrow persistence interface the encrypted record repository
// depends on, plus an in-memory implementation. The Postgres adapter
// (`pg-record-store.ts`) implements the same port; because both sides speak
// `StoredRecord` — whose PHI is already a sealed envelope — the database layer
// never sees plaintext health information.
// ============================================================

import type { SealedEnvelope, ShreddedEnvelope } from '@/lib/crypto/envelope';
import {
  type ResealScanPage,
  encodeCursor,
  decodeCursor,
} from './reseal-cursor';

/**
 * A persisted health record. Identifying/operational metadata is stored in the
 * clear (it is needed for indexing and access control); the PHI payload
 * (`label`, `description`, `tags`) lives only inside `sealedPhi`.
 */
export interface StoredRecord {
  id: string;
  ownerAddress: string;
  type: string;
  date: number;
  uploadDate: number;
  cid: string;
  txHash: string;
  attestation: string;
  size: number;
  provider: string;
  status: 'Verified' | 'Pinning' | 'Pinned' | 'Processing';
  ipfsNodes: number;
  blockHeight: number;
  encryption: string;
  /** Envelope-encrypted `{ label, description, tags }`. */
  /** Envelope-encrypted payload, or a shred tombstone after crypto-erasure. */
  sealedPhi: SealedEnvelope | ShreddedEnvelope;
  deleted: boolean;
}

/**
 * The persistence contract. Intentionally minimal: insert-or-replace by
 * `(ownerAddress, id)`, plus owner-scoped reads. All access is owner-scoped so
 * a caller cannot read another owner's rows through this port.
 */
export interface RecordStorePort {
  /** Insert a new row or replace an existing one with the same id. */
  put(row: StoredRecord): Promise<void>;
  findById(ownerAddress: string, id: string): Promise<StoredRecord | undefined>;
  findByOwner(ownerAddress: string): Promise<StoredRecord[]>;
  /**
   * Walk every record in stable id order for KEK re-sealing (GAP-14).
   * Resumable via the opaque cursor.
   */
  scanForReseal(cursor: string | null, limit: number): Promise<ResealScanPage<StoredRecord>>;
}

/**
 * In-memory {@link RecordStorePort}. Used as the default driver in
 * development/test and as the reference implementation the Postgres adapter is
 * checked against. Newest rows are returned first, matching the existing API.
 */
export class InMemoryRecordStore implements RecordStorePort {
  private readonly byOwner = new Map<string, StoredRecord[]>();

  async put(row: StoredRecord): Promise<void> {
    const list = this.byOwner.get(row.ownerAddress) ?? [];
    const index = list.findIndex((entry) => entry.id === row.id);
    if (index === -1) {
      list.unshift({ ...row });
    } else {
      list[index] = { ...row };
    }
    this.byOwner.set(row.ownerAddress, list);
  }

  async findById(ownerAddress: string, id: string): Promise<StoredRecord | undefined> {
    const row = (this.byOwner.get(ownerAddress) ?? []).find((entry) => entry.id === id);
    return row ? { ...row } : undefined;
  }

  async findByOwner(ownerAddress: string): Promise<StoredRecord[]> {
    return (this.byOwner.get(ownerAddress) ?? []).map((entry) => ({ ...entry }));
  }

  async scanForReseal(
    cursor: string | null,
    limit: number,
  ): Promise<ResealScanPage<StoredRecord>> {
    const all: StoredRecord[] = [];
    this.byOwner.forEach((rows) => rows.forEach((row) => all.push({ ...row })));
    all.sort((a, b) => a.id.localeCompare(b.id));

    const start = cursor ? this.afterIndex(all, decodeCursor(cursor)[0]) : 0;
    const page = all.slice(start, start + limit);
    const more = start + limit < all.length;
    const last = page[page.length - 1];
    return {
      rows: page,
      nextCursor: more && last ? encodeCursor([last.id]) : null,
    };
  }

  private afterIndex(sorted: StoredRecord[], id: string): number {
    const idx = sorted.findIndex((r) => r.id === id);
    return idx === -1 ? 0 : idx + 1;
  }
}
