/** @jest-environment node */

import { PgAnchorOutboxStore } from '@/lib/persistence/pg-anchor-outbox-store';
import type { SqlClient } from '@/lib/persistence/sql-client';

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

const NOW = 1_700_000_000_000;

/** A raw anchor_outbox row as Postgres returns it (bigints as strings). */
function row(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'job-1',
    from_seq: '0',
    to_seq: '4',
    salt: 'ab'.repeat(32),
    merkle_root: null,
    commitment: null,
    state: 'queued',
    attempts: '0',
    next_attempt_at: String(NOW),
    lease_until: '0',
    submitted_at: null,
    tx_ref: null,
    anchor_target: null,
    anchor_status: null,
    last_error: null,
    created_at: String(NOW),
    updated_at: String(NOW),
    ...overrides,
  };
}

describe('PgAnchorOutboxStore', () => {
  it('migrates the anchor_outbox table and its indexes', async () => {
    const client = new FakeSqlClient();
    await new PgAnchorOutboxStore(client).migrate();
    expect(client.calls).toHaveLength(3);
    expect(client.calls[0].text).toContain('CREATE TABLE IF NOT EXISTS anchor_outbox');
    expect(client.calls[1].text).toContain('idx_anchor_outbox_due');
    expect(client.calls[2].text).toContain('idx_anchor_outbox_from_seq');
  });

  it('enqueues with ON CONFLICT (from_seq) DO NOTHING so the first segment cut wins', async () => {
    const client = new FakeSqlClient();
    client.enqueue([row()]);
    const job = await new PgAnchorOutboxStore(client).enqueue(
      { id: 'job-1', fromSeq: 0, toSeq: 4, salt: 'ab'.repeat(32) },
      NOW,
    );
    expect(client.calls[0].text).toContain('INSERT INTO anchor_outbox');
    expect(client.calls[0].text).toContain('ON CONFLICT (from_seq) DO NOTHING');
    expect(client.calls[0].params).toEqual(['job-1', 0, 4, 'ab'.repeat(32), NOW]);
    expect(job).toMatchObject({ id: 'job-1', fromSeq: 0, toSeq: 4, state: 'queued', attempts: 0, leaseUntil: 0 });
  });

  it('returns null when a racing replica already cut the segment', async () => {
    const client = new FakeSqlClient();
    expect(
      await new PgAnchorOutboxStore(client).enqueue({ id: 'job-2', fromSeq: 0, toSeq: 9, salt: 'cd'.repeat(32) }, NOW),
    ).toBeNull();
  });

  it('reads the highest covered segment end', async () => {
    const client = new FakeSqlClient();
    client.enqueue([{ last_seq: '17' }]);
    expect(await new PgAnchorOutboxStore(client).lastCoveredSeq()).toBe(17);
    expect(client.calls[0].text).toContain('MAX(to_seq)');
  });

  it('reports no covered segments as null', async () => {
    const client = new FakeSqlClient();
    client.enqueue([{ last_seq: null }]);
    expect(await new PgAnchorOutboxStore(client).lastCoveredSeq()).toBeNull();
  });

  it('claims due jobs atomically via FOR UPDATE SKIP LOCKED and a lease write', async () => {
    const client = new FakeSqlClient();
    client.enqueue([row({ lease_until: String(NOW + 60_000) })]);
    const claimed = await new PgAnchorOutboxStore(client).claimDue(NOW, NOW + 60_000, 5);

    const { text, params } = client.calls[0];
    expect(text).toContain('UPDATE anchor_outbox');
    expect(text).toContain("state IN ('queued', 'submitted', 'failed')");
    expect(text).toContain('FOR UPDATE SKIP LOCKED');
    expect(text).toContain('RETURNING');
    expect(params).toEqual([NOW, NOW + 60_000, 5]);
    expect(claimed).toHaveLength(1);
    expect(claimed[0]).toMatchObject({ id: 'job-1', leaseUntil: NOW + 60_000 });
  });

  it('returns a claimed batch ordered oldest segment first', async () => {
    const client = new FakeSqlClient();
    client.enqueue([row({ id: 'job-2', from_seq: '5', to_seq: '9' }), row()]);
    const claimed = await new PgAnchorOutboxStore(client).claimDue(NOW, NOW + 60_000, 5);
    expect(claimed.map((job) => job.id)).toEqual(['job-1', 'job-2']);
  });

  it('maps a fully-populated row to camelCase numbers', async () => {
    const client = new FakeSqlClient();
    client.enqueue([row({
      state: 'submitted',
      attempts: '2',
      merkle_root: 'aa'.repeat(32),
      commitment: 'bb'.repeat(32),
      tx_ref: '0xabc',
      anchor_target: 'https://l1.example/rpc',
      anchor_status: 'on-chain',
      submitted_at: String(NOW + 1),
      last_error: 'was retried',
    })]);
    const [job] = await new PgAnchorOutboxStore(client).claimDue(NOW, NOW + 1, 1);
    expect(job).toEqual({
      id: 'job-1',
      fromSeq: 0,
      toSeq: 4,
      salt: 'ab'.repeat(32),
      merkleRoot: 'aa'.repeat(32),
      commitment: 'bb'.repeat(32),
      state: 'submitted',
      attempts: 2,
      nextAttemptAt: NOW,
      leaseUntil: 0,
      submittedAt: NOW + 1,
      txRef: '0xabc',
      anchorTarget: 'https://l1.example/rpc',
      anchorStatus: 'on-chain',
      lastError: 'was retried',
      createdAt: NOW,
      updatedAt: NOW,
    });
  });

  it('markSubmitted persists the build + receipt and releases the lease', async () => {
    const client = new FakeSqlClient();
    await new PgAnchorOutboxStore(client).markSubmitted('job-1', {
      merkleRoot: 'aa'.repeat(32),
      commitment: 'bb'.repeat(32),
      txRef: '0xabc',
      anchorTarget: 'https://l1.example/rpc',
      anchorStatus: 'on-chain',
      nextAttemptAt: NOW + 60_000,
    }, NOW);

    const { text, params } = client.calls[0];
    expect(text).toContain("SET state = 'submitted'");
    expect(text).toContain('lease_until = 0');
    expect(params).toEqual([
      'job-1', 'aa'.repeat(32), 'bb'.repeat(32), '0xabc', 'https://l1.example/rpc', 'on-chain', NOW + 60_000, NOW,
    ]);
  });

  it('markConfirmed finalises the job', async () => {
    const client = new FakeSqlClient();
    await new PgAnchorOutboxStore(client).markConfirmed('job-1', NOW);
    expect(client.calls[0].text).toContain("SET state = 'confirmed'");
    expect(client.calls[0].params).toEqual(['job-1', NOW]);
  });

  it('markFailed counts the attempt and schedules the retry', async () => {
    const client = new FakeSqlClient();
    await new PgAnchorOutboxStore(client).markFailed('job-1', 'rpc down', NOW + 120_000, NOW);
    const { text, params } = client.calls[0];
    expect(text).toContain("SET state = 'failed'");
    expect(text).toContain('attempts = attempts + 1');
    expect(params).toEqual(['job-1', 'rpc down', NOW + 120_000, NOW]);
  });

  it('markDead dead-letters the job', async () => {
    const client = new FakeSqlClient();
    await new PgAnchorOutboxStore(client).markDead('job-1', 'attempts exhausted', NOW);
    expect(client.calls[0].text).toContain("SET state = 'dead'");
    expect(client.calls[0].params).toEqual(['job-1', 'attempts exhausted', NOW]);
  });

  it('reschedule only moves the next poll and releases the lease', async () => {
    const client = new FakeSqlClient();
    await new PgAnchorOutboxStore(client).reschedule('job-1', NOW + 90_000, NOW);
    const { text, params } = client.calls[0];
    expect(text).toContain('next_attempt_at = $2');
    expect(text).not.toContain('attempts = attempts + 1');
    expect(params).toEqual(['job-1', NOW + 90_000, NOW]);
  });

  it('gets a job by id, or null when unknown', async () => {
    const client = new FakeSqlClient();
    client.enqueue([row()]);
    const store = new PgAnchorOutboxStore(client);
    expect((await store.get('job-1'))!.id).toBe('job-1');
    expect(await store.get('ghost')).toBeNull();
  });

  it('lists jobs most-recent segment first with a bounded limit', async () => {
    const client = new FakeSqlClient();
    client.enqueue([row({ id: 'job-2', from_seq: '5', to_seq: '9' }), row()]);
    const jobs = await new PgAnchorOutboxStore(client).list(2);
    expect(client.calls[0].text).toContain('ORDER BY from_seq DESC');
    expect(client.calls[0].params).toEqual([2]);
    expect(jobs.map((job) => job.id)).toEqual(['job-2', 'job-1']);
  });

  it('list defaults its limit', async () => {
    const client = new FakeSqlClient();
    client.enqueue([]);
    await new PgAnchorOutboxStore(client).list();
    expect(client.calls[0].params).toEqual([50]);
  });
});
