// ============================================================
// Shiora on Aethelred — Persistent Audit Log
//
// A durable, tamper-evident audit trail shared across every service. Each
// mutation appends a SHA-256 hash-linked entry that is sealed and persisted to
// the document store, so the trail survives restarts and is verifiable end to
// end (HIPAA Security Rule §164.312(b) audit controls, §164.312(c)(1)
// integrity — COMPLIANCE.md C-AUD-1/2).
//
// The chain head is cached in process and hydrated once from the store, so
// appends are O(1) after the first. For multi-process Postgres deployments the
// head should instead be advanced under a transaction/sequence — tracked as
// C-AUD-3 (durable + L1-anchored).
// ============================================================

import {
  GENESIS_HASH,
  computeEntryHash,
  verifyAuditChain,
  type AuditRecorder,
  type ChainVerification,
  type ChainedAuditEntry,
} from '@/lib/crypto/audit-chain';
import { openJson, sealJson } from '@/lib/crypto/envelope';
import { InMemoryDocumentStore, type DocumentStorePort } from '@/lib/persistence/document-store';
import { PgDocumentStore } from '@/lib/persistence/pg-document-store';
import { getPgClient } from '@/lib/persistence/sql-client';
import type { AuditAction, AuditEntry } from '@/lib/api/audit';

const COLLECTION = 'audit-log';
const GLOBAL_KEY = '__global__';

function aad(id: string): string {
  return `${COLLECTION}:${GLOBAL_KEY}:${id}`;
}

function idForSeq(seq: number): string {
  return String(seq).padStart(12, '0');
}

export interface AuditFilter {
  actor?: string;
  action?: AuditAction;
  resource?: string;
  since?: string;
  limit?: number;
}

export class PersistentAuditLog implements AuditRecorder {
  private head = GENESIS_HASH;
  private seq = 0;
  private hydrated = false;

  constructor(private readonly store: DocumentStorePort) {}

  private async readAll(): Promise<ChainedAuditEntry[]> {
    const rows = await this.store.findByOwner(COLLECTION, GLOBAL_KEY);
    return rows
      .map((row) => openJson<ChainedAuditEntry>(row.sealed, aad(row.id)))
      .sort((a, b) => a.seq - b.seq);
  }

  private async hydrate(): Promise<void> {
    if (this.hydrated) return;
    const entries = await this.readAll();
    if (entries.length > 0) {
      this.head = entries[entries.length - 1].hash;
      this.seq = entries.length;
    }
    this.hydrated = true;
  }

  /** Append a tamper-evident entry and persist it. */
  async record(entry: Omit<AuditEntry, 'timestamp'> & { timestamp?: string }): Promise<ChainedAuditEntry> {
    await this.hydrate();

    const base: AuditEntry = {
      ...entry,
      timestamp: entry.timestamp ?? new Date().toISOString(),
    };
    const seq = this.seq;
    const prevHash = this.head;
    const hash = computeEntryHash(prevHash, seq, base);
    const chained: ChainedAuditEntry = { ...base, seq, prevHash, hash };

    const id = idForSeq(seq);
    await this.store.put({
      collection: COLLECTION,
      ownerKey: GLOBAL_KEY,
      id,
      sealed: sealJson(chained, aad(id)),
      deleted: false,
    });
    this.head = hash;
    this.seq = seq + 1;
    return chained;
  }

  /** Query the trail (most recent first), with optional filters. */
  async list(filter: AuditFilter = {}): Promise<ChainedAuditEntry[]> {
    let entries = await this.readAll();
    if (filter.actor) {
      entries = entries.filter((entry) => entry.actor === filter.actor);
    }
    if (filter.action) {
      entries = entries.filter((entry) => entry.action === filter.action);
    }
    if (filter.resource) {
      entries = entries.filter((entry) => entry.resource === filter.resource);
    }
    if (filter.since) {
      const since = new Date(filter.since).getTime();
      entries = entries.filter((entry) => new Date(entry.timestamp).getTime() >= since);
    }
    entries.reverse();
    return entries.slice(0, filter.limit ?? 100);
  }

  /** Verify the persisted chain has not been tampered with. */
  async verify(): Promise<ChainVerification> {
    return verifyAuditChain(await this.readAll());
  }
}

let instance: PersistentAuditLog | null = null;

function createStore(): DocumentStorePort {
  if (process.env.DATABASE_URL) {
    return new PgDocumentStore(getPgClient());
  }
  return new InMemoryDocumentStore();
}

/** The process-wide audit log shared by every service. */
export function getAuditLog(): PersistentAuditLog {
  if (!instance) {
    instance = new PersistentAuditLog(createStore());
  }
  return instance;
}

/** Test-only: reset the singleton so each test starts from empty state. */
export function __resetAuditLogForTests(): void {
  instance = null;
}
