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
  GENESIS_HASH,
  verifyAuditChain,
  type AuditRecorder,
  type ChainVerification,
  type ChainedAuditEntry,
} from '@/lib/crypto/audit-chain';
import { InMemoryAuditStore, type AuditStore } from '@/lib/persistence/audit-store';
import { PgAuditStore } from '@/lib/persistence/pg-audit-store';
import { getPgClient } from '@/lib/persistence/sql-client';
import type { AuditAction, AuditEntry } from '@/lib/api/audit';
import { shouldUsePostgres } from '@/lib/persistence/datastore-mode';
import { pageByCursor, type CursorPage } from '@/lib/api/cursor-pagination';
import { buildAuditExport, type AuditExportBundle } from '@/lib/api/audit-export';

export interface AuditFilter {
  actor?: string;
  subject?: string; // the data subject the action concerns (e.g. the patient)
  /** Exclude entries by this actor (e.g. the subject's own actions in an access log). */
  excludeActor?: string;
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
    const entries = await this.filtered(filter);
    return entries.slice(0, filter.limit ?? 100);
  }

  /**
   * Cursor-paginated query (GAP-20). Pages by the append-only `seq` so results
   * stay consistent as the log grows. Returns the page plus an opaque
   * `nextCursor` (null when exhausted).
   */
  async listPage(
    filter: AuditFilter = {},
    cursor?: string,
    limit = 100,
  ): Promise<CursorPage<ChainedAuditEntry>> {
    const entries = await this.filtered(filter);
    return pageByCursor(entries, (entry) => entry.seq, limit, cursor);
  }

  /** Apply every filter and return the matches most-recent-first (by seq). */
  private async filtered(filter: AuditFilter): Promise<ChainedAuditEntry[]> {
    let entries = await this.store.list();
    if (filter.actor) {
      entries = entries.filter((entry) => entry.actor === filter.actor);
    }
    if (filter.subject) {
      entries = entries.filter((entry) => entry.subject === filter.subject);
    }
    if (filter.excludeActor) {
      entries = entries.filter((entry) => entry.actor !== filter.excludeActor);
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
    entries.reverse(); // most recent (highest seq) first
    return entries;
  }

  /** Verify the persisted chain has not been tampered with. */
  async verify(): Promise<ChainVerification> {
    return verifyAuditChain(await this.store.list());
  }

  /**
   * Export a contiguous chain segment [from, to] (by seq, both inclusive) as a
   * signed WORM bundle for off-platform retention (GAP-28). Omitting the bounds
   * exports the whole chain.
   */
  async exportSegment(from?: number, to?: number): Promise<AuditExportBundle> {
    const all = await this.store.list(); // ascending by seq
    const lo = from ?? 0;
    const hi = to ?? (all.length === 0 ? 0 : all[all.length - 1].seq);
    const segment = all.filter((entry) => entry.seq >= lo && entry.seq <= hi);
    const chainHead = {
      hash: all.length === 0 ? GENESIS_HASH : all[all.length - 1].hash,
      length: all.length,
    };
    return buildAuditExport(segment, chainHead);
  }

  /**
   * The current chain head hash and length — the value committed to an external
   * anchor (WORM mirror and/or L1) so the whole log becomes verifiable against a
   * record outside the operator's control.
   */
  async head(): Promise<{ hash: string; length: number }> {
    const entries = await this.store.list();
    return {
      hash: entries.length === 0 ? GENESIS_HASH : entries[entries.length - 1].hash,
      length: entries.length,
    };
  }
}

let instance: PersistentAuditLog | null = null;

function createStore(): AuditStore {
  if (shouldUsePostgres()) {
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
