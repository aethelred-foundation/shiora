// ============================================================
// Shiora on Aethelred — Audit Store Port
//
// Append-only storage for the tamper-evident audit chain. Splitting this out
// lets the persistent log run over an in-memory driver (single-process) or a
// Postgres driver that advances the chain head safely under concurrency.
//
// Audit entries are access/audit metadata (actor, action, resource), not PHI;
// the security requirement is integrity (the SHA-256 hash chain), satisfied by
// every driver. At-rest confidentiality in production is provided by database
// encryption (COMPLIANCE.md C-AUD-2/3).
// ============================================================

import {
  GENESIS_HASH,
  computeEntryHash,
  type ChainedAuditEntry,
} from '@/lib/crypto/audit-chain';
import type { AuditEntry } from '@/lib/api/audit';

export interface AuditStore {
  /** Append a base entry to the chain head and return its chained form. */
  append(base: AuditEntry): Promise<ChainedAuditEntry>;
  /** All entries in sequence order. */
  list(): Promise<ChainedAuditEntry[]>;
}

/** In-memory {@link AuditStore}. Appends are atomic within a single process. */
export class InMemoryAuditStore implements AuditStore {
  private readonly entries: ChainedAuditEntry[] = [];

  async append(base: AuditEntry): Promise<ChainedAuditEntry> {
    const seq = this.entries.length;
    const prevHash = seq === 0 ? GENESIS_HASH : this.entries[seq - 1].hash;
    const hash = computeEntryHash(prevHash, seq, base);

    const chained: ChainedAuditEntry = { ...base, seq, prevHash, hash };
    this.entries.push(chained);
    return chained;
  }

  async list(): Promise<ChainedAuditEntry[]> {
    return this.entries.map((entry) => ({ ...entry }));
  }
}
