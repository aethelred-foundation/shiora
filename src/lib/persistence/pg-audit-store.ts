// ============================================================
// Shiora on Aethelred — Postgres Audit Store
//
// Concurrency-safe append to the tamper-evident audit chain. The `audit_chain`
// table makes `seq` a PRIMARY KEY, so two processes that read the same head and
// try to write the same next sequence cannot both succeed — the loser hits a
// unique-violation and retries against the new head. This advances the chain
// head correctly across processes without a shared in-memory cache
// (COMPLIANCE.md C-AUD-3).
// ============================================================

import {
  GENESIS_HASH,
  computeEntryHash,
  type ChainedAuditEntry,
} from '@/lib/crypto/audit-chain';
import type { AuditEntry } from '@/lib/api/audit';
import { AUDIT_CHAIN_DDL } from './schema';
import type { AuditStore } from './audit-store';
import type { SqlClient } from './sql-client';

const UNIQUE_VIOLATION = '23505';
const MAX_RETRIES = 25;

interface HeadRow {
  seq: string | number;
  hash: string;
}

interface EntryRow {
  seq: string | number;
  prev_hash: string;
  hash: string;
  entry: AuditEntry;
}

export class PgAuditStore implements AuditStore {
  constructor(private readonly client: SqlClient) {}

  /** Create the audit_chain table. Idempotent. */
  async migrate(): Promise<void> {
    await this.client.query(AUDIT_CHAIN_DDL);
  }

  async append(base: AuditEntry): Promise<ChainedAuditEntry> {
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const { rows } = await this.client.query<HeadRow>(
        'SELECT seq, hash FROM audit_chain ORDER BY seq DESC LIMIT 1',
      );
      const head = rows[0];
      const seq = head ? Number(head.seq) + 1 : 0;
      const prevHash = head ? head.hash : GENESIS_HASH;
      const hash = computeEntryHash(prevHash, seq, base);

      try {
        await this.client.query(
          'INSERT INTO audit_chain (seq, prev_hash, hash, entry) VALUES ($1,$2,$3,$4::jsonb)',
          [seq, prevHash, hash, JSON.stringify(base)],
        );
        return { ...base, seq, prevHash, hash };
      } catch (err) {
        // Another process claimed this sequence — re-read the head and retry.
        if ((err as { code?: string }).code === UNIQUE_VIOLATION) {
          continue;
        }
        throw err;
      }
    }
    throw new Error('Audit append failed after maximum retries due to contention.');
  }

  async list(): Promise<ChainedAuditEntry[]> {
    const { rows } = await this.client.query<EntryRow>(
      'SELECT seq, prev_hash, hash, entry FROM audit_chain ORDER BY seq ASC',
    );
    return rows.map((row) => ({
      ...row.entry,
      seq: Number(row.seq),
      prevHash: row.prev_hash,
      hash: row.hash,
    }));
  }
}
