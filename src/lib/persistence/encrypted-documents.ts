// ============================================================
// Shiora on Aethelred — Encrypted Document Repository
//
// Generic policy layer over DocumentStorePort: seals each document at rest
// with envelope encryption (AAD-bound to collection:owner:id), decrypts on
// read, and appends a tamper-evident audit entry on every mutation. One class
// serves every owner-scoped collection (access grants, consent, …).
// ============================================================

import { type AuditAction, type AuditRecorder } from '@/lib/crypto/audit-chain';
import { openJson, sealJson } from '@/lib/crypto/envelope';
import type { DocumentStorePort, StoredDocument } from './document-store';

/** Audit action names emitted for a collection's mutations. */
export interface DocumentAuditActions {
  create: AuditAction;
  update: AuditAction;
}

export class EncryptedDocumentRepository<T extends { id: string }> {
  constructor(
    private readonly store: DocumentStorePort,
    private readonly audit: AuditRecorder,
    private readonly collection: string,
    private readonly actions: DocumentAuditActions,
  ) {}

  /**
   * Encrypt and persist a new document, returning it unchanged. `actor` records
   * who performed the write in the audit chain — defaults to the collection
   * owner, but a write made on the owner's record by another party (e.g. a
   * provider authoring a clinical note about a patient) should pass the acting
   * party so the audit trail attributes it truthfully.
   */
  async create(ownerKey: string, document: T, actor: string = ownerKey): Promise<T> {
    await this.persist(ownerKey, document);
    await this.record(this.actions.create, actor, document.id);
    return document;
  }

  /** Fetch and decrypt a single document. */
  async get(ownerKey: string, id: string): Promise<T | undefined> {
    const row = await this.store.findById(this.collection, ownerKey, id);
    if (!row || row.deleted) {
      return undefined;
    }
    return this.open(ownerKey, row);
  }

  /** List and decrypt all of an owner's non-deleted documents. */
  async list(ownerKey: string): Promise<T[]> {
    const rows = await this.store.findByOwner(this.collection, ownerKey);
    return rows.filter((row) => !row.deleted).map((row) => this.open(ownerKey, row));
  }

  /**
   * List and decrypt every non-deleted document across all owners. For
   * aggregate analytics only — callers must not return individual documents.
   */
  async listAll(): Promise<T[]> {
    const rows = await this.store.listAll(this.collection);
    return rows.filter((row) => !row.deleted).map((row) => this.open(row.ownerKey, row));
  }

  /**
   * Merge a patch into an existing document and re-seal it. `actor` records who
   * performed the write (defaults to the owner; pass the acting party for a
   * write made on the owner's record by someone else).
   */
  async update(
    ownerKey: string,
    id: string,
    patch: Partial<T>,
    actor: string = ownerKey,
  ): Promise<T | undefined> {
    const row = await this.store.findById(this.collection, ownerKey, id);
    if (!row || row.deleted) {
      return undefined;
    }

    const current = this.open(ownerKey, row);
    const next = { ...current, ...patch, id: current.id } as T;
    await this.persist(ownerKey, next);
    await this.record(this.actions.update, actor, id);
    return next;
  }

  /**
   * Soft-delete a document so it no longer appears in get/list. Returns false
   * when it does not exist or is already deleted. Used for right-to-erasure.
   */
  async softDelete(ownerKey: string, id: string): Promise<boolean> {
    const row = await this.store.findById(this.collection, ownerKey, id);
    if (!row || row.deleted) {
      return false;
    }
    await this.store.put({ ...row, deleted: true });
    await this.record(this.actions.update, ownerKey, id);
    return true;
  }

  // -- internals -----------------------------------------------------------

  private aad(ownerKey: string, id: string): string {
    return `${this.collection}:${ownerKey}:${id}`;
  }

  private async persist(ownerKey: string, document: T): Promise<void> {
    const sealed = sealJson<T>(document, this.aad(ownerKey, document.id));
    await this.store.put({
      collection: this.collection,
      ownerKey,
      id: document.id,
      sealed,
      deleted: false,
    });
  }

  private open(ownerKey: string, row: StoredDocument): T {
    return openJson<T>(row.sealed, this.aad(ownerKey, row.id));
  }

  private async record(action: AuditAction, actor: string, resourceId: string): Promise<void> {
    await this.audit.record({
      action,
      actor,
      resource: this.collection,
      resourceId,
      success: true,
    });
  }
}
