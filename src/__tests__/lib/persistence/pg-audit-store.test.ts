/** @jest-environment node */

import { PgAuditStore } from '@/lib/persistence/pg-audit-store';
import { verifyAuditChain } from '@/lib/crypto/audit-chain';
import type { SqlClient } from '@/lib/persistence/sql-client';
import type { AuditEntry } from '@/lib/api/audit';

interface Row { seq: number; prev_hash: string; hash: string; entry: AuditEntry }

/** A fake SqlClient that simulates the audit_chain table. */
class FakeAuditClient implements SqlClient {
  readonly rows: Row[] = [];
  readonly calls: string[] = [];
  /** Number of upcoming INSERTs to reject with a unique violation. */
  failInserts = 0;
  /** A specific error to throw on the next INSERT (for non-retryable errors). */
  insertError?: Error;

  async query<T = Record<string, unknown>>(text: string, params?: unknown[]) {
    this.calls.push(text);
    if (text.includes('CREATE TABLE')) {
      return { rows: [] as T[] };
    }
    if (text.startsWith('SELECT seq, hash FROM audit_chain ORDER BY seq DESC')) {
      const head = this.rows[this.rows.length - 1];
      return { rows: (head ? [{ seq: head.seq, hash: head.hash }] : []) as T[] };
    }
    if (text.startsWith('SELECT seq, prev_hash, hash, entry')) {
      return { rows: [...this.rows].sort((a, b) => a.seq - b.seq) as T[] };
    }
    // INSERT
    if (this.insertError) {
      const err = this.insertError;
      this.insertError = undefined;
      throw err;
    }
    if (this.failInserts > 0) {
      this.failInserts -= 1;
      throw Object.assign(new Error('duplicate key'), { code: '23505' });
    }
    const [seq, prev_hash, hash, entryJson] = params as [number, string, string, string];
    this.rows.push({ seq, prev_hash, hash, entry: JSON.parse(entryJson) });
    return { rows: [] as T[] };
  }
}

function base(actor: string): AuditEntry {
  return { action: 'RECORD_CREATE', actor, resource: 'record', resourceId: 'r1', success: true, timestamp: 't' };
}

describe('PgAuditStore', () => {
  it('migrates the audit_chain table', async () => {
    const client = new FakeAuditClient();
    await new PgAuditStore(client).migrate();
    expect(client.calls[0]).toContain('CREATE TABLE IF NOT EXISTS audit_chain');
  });

  it('appends a verifiable chain (genesis, then linked)', async () => {
    const client = new FakeAuditClient();
    const store = new PgAuditStore(client);
    const a = await store.append(base('aeth1a'));
    const b = await store.append(base('aeth1b'));

    expect(a.seq).toBe(0);
    expect(b.seq).toBe(1);
    expect(b.prevHash).toBe(a.hash);
    expect(verifyAuditChain(await store.list()).valid).toBe(true);
  });

  it('retries on a unique violation when a sequence is contended', async () => {
    const client = new FakeAuditClient();
    const store = new PgAuditStore(client);
    await store.append(base('aeth1a')); // seq 0
    client.failInserts = 1; // the next INSERT conflicts once, then succeeds
    const b = await store.append(base('aeth1b'));

    expect(b.seq).toBe(1);
    expect(await store.list()).toHaveLength(2);
  });

  it('rethrows a non-unique-violation error', async () => {
    const client = new FakeAuditClient();
    client.insertError = Object.assign(new Error('relation missing'), { code: '42P01' });
    await expect(new PgAuditStore(client).append(base('aeth1a'))).rejects.toThrow('relation missing');
  });

  it('throws after exhausting retries under sustained contention', async () => {
    const client = new FakeAuditClient();
    client.failInserts = 1000; // always conflicts
    await expect(new PgAuditStore(client).append(base('aeth1a'))).rejects.toThrow(/maximum retries/);
  });
});
