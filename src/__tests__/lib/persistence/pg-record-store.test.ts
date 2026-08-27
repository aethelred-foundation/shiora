/** @jest-environment node */

import { sealJson } from '@/lib/crypto/envelope';
import { PgRecordStore } from '@/lib/persistence/pg-record-store';
import { MIGRATIONS } from '@/lib/persistence/schema';
import type { SqlClient } from '@/lib/persistence/sql-client';
import type { StoredRecord } from '@/lib/persistence/record-store';

class FakeSqlClient implements SqlClient {
  readonly calls: { text: string; params?: unknown[] }[] = [];
  private readonly queue: unknown[][] = [];

  enqueue(rows: unknown[]): void {
    this.queue.push(rows);
  }

  async query<T = Record<string, unknown>>(text: string, params?: unknown[]) {
    this.calls.push({ text, params });
    return { rows: (this.queue.shift() ?? []) as T[] };
  }
}

const OWNER = 'aeth1owner000000000000000000000000000000';

async function sealedRow() {
  // Postgres returns bigint columns as strings; mirror that to exercise Number().
  return {
    id: 'rec-1',
    owner_address: OWNER,
    type: 'lab-result',
    date: '1700000000000',
    upload_date: '1700000100000',
    cid: 'bafy',
    tx_hash: '0xabc',
    attestation: 'att',
    size: 2048,
    provider: 'Dr. Rivera',
    status: 'Verified' as const,
    ipfs_nodes: 3,
    block_height: '2847400',
    encryption: 'AES-256-GCM',
    sealed_phi: await sealJson({ label: 'BRCA1', description: 'd', tags: ['g'] }, `${OWNER}:rec-1`),
    deleted: false,
    deleted_at: 1700000000000,
    blind_tags: ['tok1', 'tok2'],
  };
}

async function storedRecord(): Promise<StoredRecord> {
  return {
    id: 'rec-1',
    ownerAddress: OWNER,
    type: 'lab-result',
    date: 1_700_000_000_000,
    uploadDate: 1_700_000_100_000,
    cid: 'bafy',
    txHash: '0xabc',
    attestation: 'att',
    size: 2048,
    provider: 'Dr. Rivera',
    status: 'Verified',
    ipfsNodes: 3,
    blockHeight: 2_847_400,
    encryption: 'AES-256-GCM',
    sealedPhi: await sealJson({ label: 'BRCA1', description: 'd', tags: ['g'] }, `${OWNER}:rec-1`),
    deleted: false,
  };
}

describe('PgRecordStore', () => {
  it('runs every migration statement', async () => {
    const client = new FakeSqlClient();
    await new PgRecordStore(client).migrate();
    expect(client.calls).toHaveLength(MIGRATIONS.length);
    expect(client.calls[0].text).toContain('CREATE TABLE IF NOT EXISTS health_records');
  });

  it('upserts a record with the PHI serialized as JSON', async () => {
    const client = new FakeSqlClient();
    await new PgRecordStore(client).put(await storedRecord());

    expect(client.calls).toHaveLength(1);
    const { text, params } = client.calls[0];
    expect(text).toContain('INSERT INTO health_records');
    expect(text).toContain('ON CONFLICT (id) DO UPDATE SET');
    expect(params).toHaveLength(19);
    expect(params![0]).toBe('rec-1');
    // sealed_phi (param 15) must be a JSON string, not a live object.
    expect(typeof params![14]).toBe('string');
    expect(params![16]).toBe(1); // version
    expect(params![17]).toBeNull(); // deleted_at
    expect(params![18]).toEqual([]); // blind_tags default
  });

  it('finds a record by id and maps bigint columns to numbers', async () => {
    const client = new FakeSqlClient();
    client.enqueue([await sealedRow()]);

    const row = await new PgRecordStore(client).findById(OWNER, 'rec-1');
    expect(row?.id).toBe('rec-1');
    expect(row?.date).toBe(1_700_000_000_000);
    expect(typeof row?.date).toBe('number');
    expect(row?.blockHeight).toBe(2_847_400);
    expect(row?.deletedAt).toBe(1_700_000_000_000); // mapped from deleted_at
    expect(row?.blindTags).toEqual(['tok1', 'tok2']); // mapped from blind_tags
    expect(client.calls[0].params).toEqual([OWNER, 'rec-1']);
  });

  it('omits deletedAt when deleted_at is null', async () => {
    const client = new FakeSqlClient();
    client.enqueue([{ ...await sealedRow(), deleted_at: null, blind_tags: null }]);
    const row = await new PgRecordStore(client).findById(OWNER, 'rec-1');
    expect(row?.deletedAt).toBeUndefined();
    expect(row?.blindTags).toBeUndefined();
  });

  it('returns undefined when no record matches', async () => {
    const client = new FakeSqlClient();
    const row = await new PgRecordStore(client).findById(OWNER, 'missing');
    expect(row).toBeUndefined();
  });

  it('lists an owner\'s records ordered by the query', async () => {
    const client = new FakeSqlClient();
    client.enqueue([await sealedRow(), { ...await sealedRow(), id: 'rec-2' }]);

    const rows = await new PgRecordStore(client).findByOwner(OWNER);
    expect(rows.map((r) => r.id)).toEqual(['rec-1', 'rec-2']);
    expect(client.calls[0].text).toContain('ORDER BY created_at DESC');
  });

  describe('scanForReseal (GAP-14)', () => {
    it('scans from the start and reports a next cursor when the page is full', async () => {
      const client = new FakeSqlClient();
      const store = new PgRecordStore(client);
      client.enqueue([await sealedRow(), { ...await sealedRow(), id: 'rec-2' }]);

      const page = await store.scanForReseal(null, 2);
      expect(page.rows.map((r) => r.id)).toEqual(['rec-1', 'rec-2']);
      expect(page.nextCursor).not.toBeNull();
      expect(client.calls[0].text).toContain('ORDER BY id');
      expect(client.calls[0].params).toEqual(['', 2]);
    });

    it('decodes the cursor into an id bound and stops when the page is short', async () => {
      const client = new FakeSqlClient();
      const store = new PgRecordStore(client);
      const { encodeCursor } = await import('@/lib/persistence/reseal-cursor');
      client.enqueue([await sealedRow()]);

      const page = await store.scanForReseal(encodeCursor(['rec-0']), 5);
      expect(page.rows).toHaveLength(1);
      expect(page.nextCursor).toBeNull();
      expect(client.calls[0].params).toEqual(['rec-0', 5]);
    });
  });
});
