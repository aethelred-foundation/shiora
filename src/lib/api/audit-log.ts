// ============================================================
// Shiora on Aethelred — Persistent Audit Log
//
// A durable, tamper-evident audit trail shared across every service. Each
// mutation appends a SHA-256 hash-linked entry, verifiable end to end (HIPAA
// Security Rule §164.312(b) audit controls, §164.312(c)(1) integrity —
// COMPLIANCE.md C-AUD-1/2).
//
// Sequencing is delegated to the AuditStore: the Postgres store advances the
// chain head safely across processes via the `seq` primary key (C-AUD-3), so
// the log no longer relies on a per-process cached head.
// ============================================================

import {
  verifyAuditChain,
  type AuditRecorder,
  type ChainVerification,
  type ChainedAuditEntry,
} from '@/lib/crypto/audit-chain';
import { InMemoryAuditStore, type AuditStore } from '@/lib/persistence/audit-store';
import { PgAuditStore } from '@/lib/persistence/pg-audit-store';
import { getPgClient } from '@/lib/persistence/sql-client';
import type { AuditAction, AuditEntry } from '@/lib/api/audit';

export interface AuditFilter {
  actor?: string;
  action?: AuditAction;
  resource?: string;
  since?: string;
  limit?: number;
}

export class PersistentAuditLog implements AuditRecorder {
  constructor(private readonly store: AuditStore) {}

  /** Append a tamper-evident entry to the chain. */
  async record(entry: Omit<AuditEntry, 'timestamp'> & { timestamp?: string }): Promise<ChainedAuditEntry> {
    const base: AuditEntry = {
      ...entry,
      timestamp: entry.timestamp ?? new Date().toISOString(),
    };
    return this.store.append(base);
  }

  /** Query the trail (most recent first), with optional filters. */
  async list(filter: AuditFilter = {}): Promise<ChainedAuditEntry[]> {
    let entries = await this.store.list();
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
    return verifyAuditChain(await this.store.list());
  }
}

let instance: PersistentAuditLog | null = null;

function createStore(): AuditStore {
  if (process.env.DATABASE_URL) {
    return new PgAuditStore(getPgClient());
  }
  return new InMemoryAuditStore();
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
