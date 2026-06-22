// ============================================================
// Shiora on Aethelred — Encrypted Health Record Repository
//
// The policy layer between the API and storage. It seals PHI at rest with
// envelope encryption, binds each record's ciphertext to its
// `owner:recordId` context (AAD), and appends a tamper-evident entry to the
// audit chain on every mutation. Storage is abstracted behind RecordStorePort,
// so the same logic runs over the in-memory driver (dev/test) or Postgres
// (production) without change.
//
// This is the drop-in replacement for the seeded `src/lib/api/store.ts` record
// functions; the data it returns is real, owner-scoped, and encrypted at rest
// rather than generated from a fixed seed.
// ============================================================

import { AuditChain } from '@/lib/crypto/audit-chain';
import { openJson, sealJson } from '@/lib/crypto/envelope';
import type { MockHealthRecord } from '@/lib/api/mock-data';
import type { RecordStorePort, StoredRecord } from './record-store';

/** The subset of a record that is PHI and therefore encrypted at rest. */
interface SealedPhiPayload {
  label: string;
  description: string;
  tags: string[];
}

/** Fields a caller may change on an existing record. */
export interface RecordUpdate {
  label?: string;
  description?: string;
  tags?: string[];
  status?: StoredRecord['status'];
  provider?: string;
}

/** Bind a record's ciphertext to its owner and id (defeats substitution). */
function phiAad(ownerAddress: string, id: string): string {
  return `${ownerAddress}:${id}`;
}

export class EncryptedRecordRepository {
  constructor(
    private readonly store: RecordStorePort,
    private readonly audit: AuditChain,
  ) {}

  /** Encrypt and persist a new health record. */
  async create(ownerAddress: string, record: MockHealthRecord): Promise<MockHealthRecord> {
    const row: StoredRecord = {
      id: record.id,
      ownerAddress,
      type: record.type,
      date: record.date,
      uploadDate: record.uploadDate,
      cid: record.cid,
      txHash: record.txHash,
      attestation: record.attestation,
      size: record.size,
      provider: record.provider,
      status: record.status,
      ipfsNodes: record.ipfsNodes,
      blockHeight: record.blockHeight,
      encryption: 'AES-256-GCM',
      sealedPhi: this.sealPhi(ownerAddress, record.id, {
        label: record.label,
        description: record.description,
        tags: record.tags,
      }),
      deleted: false,
    };

    await this.store.put(row);
    this.record('RECORD_CREATE', ownerAddress, record.id);
    return this.toRecord(row);
  }

  /** Fetch a single record, decrypting its PHI. */
  async get(ownerAddress: string, id: string): Promise<MockHealthRecord | undefined> {
    const row = await this.store.findById(ownerAddress, id);
    if (!row || row.deleted) {
      return undefined;
    }
    this.record('RECORD_READ', ownerAddress, id);
    return this.toRecord(row);
  }

  /** List an owner's non-deleted records, decrypting each. */
  async list(ownerAddress: string): Promise<MockHealthRecord[]> {
    const rows = await this.store.findByOwner(ownerAddress);
    return rows.filter((row) => !row.deleted).map((row) => this.toRecord(row));
  }

  /** Apply changes, re-sealing PHI when any PHI field is touched. */
  async update(
    ownerAddress: string,
    id: string,
    updates: RecordUpdate,
  ): Promise<MockHealthRecord | undefined> {
    const existing = await this.store.findById(ownerAddress, id);
    if (!existing || existing.deleted) {
      return undefined;
    }

    const next: StoredRecord = { ...existing };

    if (updates.status !== undefined) {
      next.status = updates.status;
    }
    if (updates.provider !== undefined) {
      next.provider = updates.provider;
    }

    const phiChanged = updates.label !== undefined
      || updates.description !== undefined
      || updates.tags !== undefined;

    if (phiChanged) {
      const current = this.openPhi(existing);
      next.sealedPhi = this.sealPhi(ownerAddress, id, {
        label: updates.label ?? current.label,
        description: updates.description ?? current.description,
        tags: updates.tags ?? current.tags,
      });
    }

    await this.store.put(next);
    this.record('RECORD_UPDATE', ownerAddress, id);
    return this.toRecord(next);
  }

  /** Soft-delete a record (retained, but excluded from reads). */
  async softDelete(ownerAddress: string, id: string): Promise<MockHealthRecord | undefined> {
    const existing = await this.store.findById(ownerAddress, id);
    if (!existing || existing.deleted) {
      return undefined;
    }

    const next: StoredRecord = { ...existing, deleted: true };
    await this.store.put(next);
    this.record('RECORD_DELETE', ownerAddress, id);
    return this.toRecord(next);
  }

  // -- internals -----------------------------------------------------------

  private sealPhi(ownerAddress: string, id: string, phi: SealedPhiPayload) {
    return sealJson<SealedPhiPayload>(phi, phiAad(ownerAddress, id));
  }

  private openPhi(row: StoredRecord): SealedPhiPayload {
    return openJson<SealedPhiPayload>(row.sealedPhi, phiAad(row.ownerAddress, row.id));
  }

  private record(action: 'RECORD_CREATE' | 'RECORD_READ' | 'RECORD_UPDATE' | 'RECORD_DELETE', actor: string, resourceId: string): void {
    this.audit.append({ action, actor, resource: 'record', resourceId, success: true });
  }

  private toRecord(row: StoredRecord): MockHealthRecord {
    const phi = this.openPhi(row);
    return {
      id: row.id,
      type: row.type,
      label: phi.label,
      description: phi.description,
      date: row.date,
      uploadDate: row.uploadDate,
      encrypted: true,
      encryption: row.encryption,
      cid: row.cid,
      txHash: row.txHash,
      attestation: row.attestation,
      size: row.size,
      provider: row.provider,
      status: row.status,
      ipfsNodes: row.ipfsNodes,
      tags: phi.tags,
      deleted: row.deleted,
      ownerAddress: row.ownerAddress,
      blockHeight: row.blockHeight,
    };
  }
}
