/** @jest-environment node */

import { PgChallengeStore } from '@/lib/persistence/pg-challenge-store';
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

const OWNER = 'aeth1owner';

describe('PgChallengeStore', () => {
  it('migrates the webauthn_challenges table and its index', async () => {
    const client = new FakeSqlClient();
    await new PgChallengeStore(client).migrate();
    expect(client.calls).toHaveLength(2);
    expect(client.calls[0].text).toContain('CREATE TABLE IF NOT EXISTS webauthn_challenges');
    expect(client.calls[1].text).toContain('idx_webauthn_challenges_expiry');
  });

  it('upserts the (owner, ceremony) slot so a new ceremony replaces the pending one', async () => {
    const client = new FakeSqlClient();
    await new PgChallengeStore(client).put(OWNER, 'registration', 'chal', 12345);
    const { text, params } = client.calls[0];
    expect(text).toContain('INSERT INTO webauthn_challenges');
    expect(text).toContain('ON CONFLICT (owner_key, ceremony)');
    expect(text).toContain('DO UPDATE SET challenge = EXCLUDED.challenge');
    expect(params).toEqual([OWNER, 'registration', 'chal', 12345]);
  });

  it('consumes via atomic DELETE ... RETURNING and returns the live challenge', async () => {
    const client = new FakeSqlClient();
    client.enqueue([{ challenge: 'chal', expires_at: String(Date.now() + 60_000) }]);
    const taken = await new PgChallengeStore(client).take(OWNER, 'authentication');
    expect(taken).toBe('chal');
    expect(client.calls[0].text).toContain('DELETE FROM webauthn_challenges');
    expect(client.calls[0].text).toContain('RETURNING challenge, expires_at');
    expect(client.calls[0].params).toEqual([OWNER, 'authentication']);
  });

  it('returns null when nothing is pending or a racer consumed it first', async () => {
    const client = new FakeSqlClient();
    expect(await new PgChallengeStore(client).take(OWNER, 'registration')).toBeNull();
  });

  it('returns null for an expired slot (consumed, fail-closed)', async () => {
    const client = new FakeSqlClient();
    client.enqueue([{ challenge: 'stale', expires_at: Date.now() - 1 }]);
    expect(await new PgChallengeStore(client).take(OWNER, 'registration')).toBeNull();
  });

  it('prunes expired slots and reports the count', async () => {
    const client = new FakeSqlClient();
    client.enqueue([{ pruned: '4' }]);
    expect(await new PgChallengeStore(client).prune(1_000_000)).toBe(4);
    expect(client.calls[0].text).toContain('DELETE FROM webauthn_challenges WHERE expires_at < $1');
    expect(client.calls[0].params).toEqual([1_000_000]);
  });

  it('prune defaults its cutoff to now', async () => {
    const client = new FakeSqlClient();
    client.enqueue([{ pruned: 0 }]);
    const before = Date.now();
    await new PgChallengeStore(client).prune();
    expect(Number(client.calls[0].params![0])).toBeGreaterThanOrEqual(before);
  });
});
