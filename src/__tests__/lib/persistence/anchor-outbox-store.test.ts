/** @jest-environment node */

import {
  InMemoryAnchorOutboxStore,
  getAnchorOutboxStore,
  __resetAnchorOutboxStoreForTests,
  type AnchorOutboxStore,
} from '@/lib/persistence/anchor-outbox-store';
import { PgAnchorOutboxStore } from '@/lib/persistence/pg-anchor-outbox-store';

const NOW = 1_700_000_000_000;

function makeStore(): AnchorOutboxStore {
  return new InMemoryAnchorOutboxStore();
}

async function seeded(store: AnchorOutboxStore, id = 'job-1', fromSeq = 0, toSeq = 4) {
  return store.enqueue({ id, fromSeq, toSeq, salt: 'ab'.repeat(32) }, NOW);
}

describe('InMemoryAnchorOutboxStore', () => {
  it('enqueues a queued job covering the segment, due immediately', async () => {
    const store = makeStore();
    const job = await seeded(store);
    expect(job).toMatchObject({
      id: 'job-1',
      fromSeq: 0,
      toSeq: 4,
      salt: 'ab'.repeat(32),
      state: 'queued',
      attempts: 0,
      nextAttemptAt: NOW,
      leaseUntil: 0,
      merkleRoot: null,
      commitment: null,
      txRef: null,
      submittedAt: null,
      lastError: null,
      createdAt: NOW,
      updatedAt: NOW,
    });
  });

  it('first writer wins per segment start — a racing duplicate cut is dropped', async () => {
    const store = makeStore();
    await seeded(store, 'job-1', 0, 4);
    expect(await store.enqueue({ id: 'job-2', fromSeq: 0, toSeq: 9, salt: 'cd'.repeat(32) }, NOW)).toBeNull();
    expect(await store.get('job-2')).toBeNull();
  });

  it('lastCoveredSeq reports the highest segment end across all jobs, in any state', async () => {
    const store = makeStore();
    expect(await store.lastCoveredSeq()).toBeNull();
    await seeded(store, 'job-2', 5, 7);
    await seeded(store, 'job-1', 0, 4); // inserted later, covers an earlier slice
    await store.markDead('job-2', 'gave up', NOW);
    expect(await store.lastCoveredSeq()).toBe(7);
  });

  it('claims due jobs atomically under a lease so a second claimer gets nothing', async () => {
    const store = makeStore();
    await seeded(store);
    const claimed = await store.claimDue(NOW, NOW + 60_000, 10);
    expect(claimed.map((job) => job.id)).toEqual(['job-1']);
    expect(await store.claimDue(NOW + 1, NOW + 60_000, 10)).toEqual([]);
  });

  it('a claim expires with its lease and the job becomes claimable again', async () => {
    const store = makeStore();
    await seeded(store);
    await store.claimDue(NOW, NOW + 60_000, 10);
    const reclaimed = await store.claimDue(NOW + 60_000, NOW + 120_000, 10);
    expect(reclaimed.map((job) => job.id)).toEqual(['job-1']);
  });

  it('claims oldest segments first and honours the batch limit', async () => {
    const store = makeStore();
    await seeded(store, 'job-2', 5, 9);
    await seeded(store, 'job-1', 0, 4);
    const claimed = await store.claimDue(NOW, NOW + 60_000, 1);
    expect(claimed.map((job) => job.id)).toEqual(['job-1']);
  });

  it('does not claim jobs that are not yet due, confirmed, or dead', async () => {
    const store = makeStore();
    await seeded(store, 'job-1', 0, 1);
    await seeded(store, 'job-2', 2, 3);
    await seeded(store, 'job-3', 4, 5);
    await seeded(store, 'job-4', 6, 7);
    await store.markConfirmed('job-1', NOW);
    await store.markDead('job-2', 'gave up', NOW);
    await store.markFailed('job-3', 'rpc down', NOW + 60_000, NOW); // retry scheduled in the future
    const claimed = await store.claimDue(NOW, NOW + 30_000, 10);
    expect(claimed.map((job) => job.id)).toEqual(['job-4']);
  });

  it('markSubmitted records the build + receipt and schedules the confirmation poll', async () => {
    const store = makeStore();
    await seeded(store);
    await store.claimDue(NOW, NOW + 60_000, 10);
    await store.markSubmitted('job-1', {
      merkleRoot: 'aa'.repeat(32),
      commitment: 'bb'.repeat(32),
      txRef: '0xdeadbeef',
      anchorTarget: 'https://l1.example/rpc',
      anchorStatus: 'on-chain',
      nextAttemptAt: NOW + 60_000,
    }, NOW + 1);

    const job = await store.get('job-1');
    expect(job).toMatchObject({
      state: 'submitted',
      merkleRoot: 'aa'.repeat(32),
      commitment: 'bb'.repeat(32),
      txRef: '0xdeadbeef',
      anchorTarget: 'https://l1.example/rpc',
      anchorStatus: 'on-chain',
      submittedAt: NOW + 1,
      nextAttemptAt: NOW + 60_000,
      leaseUntil: 0,
      updatedAt: NOW + 1,
    });
  });

  it('markConfirmed is terminal and clears the lease', async () => {
    const store = makeStore();
    await seeded(store);
    await store.claimDue(NOW, NOW + 60_000, 10);
    await store.markConfirmed('job-1', NOW + 2);
    expect(await store.get('job-1')).toMatchObject({ state: 'confirmed', leaseUntil: 0, updatedAt: NOW + 2 });
  });

  it('markFailed counts the attempt, records the error, and schedules the retry', async () => {
    const store = makeStore();
    await seeded(store);
    await store.markFailed('job-1', 'L1 RPC unreachable', NOW + 120_000, NOW + 3);
    expect(await store.get('job-1')).toMatchObject({
      state: 'failed',
      attempts: 1,
      lastError: 'L1 RPC unreachable',
      nextAttemptAt: NOW + 120_000,
      leaseUntil: 0,
    });
  });

  it('markDead dead-letters the job with the final error', async () => {
    const store = makeStore();
    await seeded(store);
    await store.markDead('job-1', 'attempts exhausted', NOW + 4);
    expect(await store.get('job-1')).toMatchObject({ state: 'dead', lastError: 'attempts exhausted', leaseUntil: 0 });
  });

  it('reschedule moves the next poll without changing state or attempts', async () => {
    const store = makeStore();
    await seeded(store);
    await store.claimDue(NOW, NOW + 60_000, 10);
    await store.reschedule('job-1', NOW + 90_000, NOW + 5);
    expect(await store.get('job-1')).toMatchObject({
      state: 'queued',
      attempts: 0,
      nextAttemptAt: NOW + 90_000,
      leaseUntil: 0,
    });
  });

  it('mark operations on an unknown job are safe no-ops', async () => {
    const store = makeStore();
    await expect(store.markSubmitted('ghost', {
      merkleRoot: 'aa'.repeat(32),
      commitment: 'bb'.repeat(32),
      txRef: '0x1',
      anchorTarget: 'local',
      anchorStatus: 'local',
      nextAttemptAt: NOW,
    }, NOW)).resolves.toBeUndefined();
    await expect(store.markConfirmed('ghost', NOW)).resolves.toBeUndefined();
    await expect(store.markFailed('ghost', 'err', NOW, NOW)).resolves.toBeUndefined();
    await expect(store.markDead('ghost', 'err', NOW)).resolves.toBeUndefined();
    await expect(store.reschedule('ghost', NOW, NOW)).resolves.toBeUndefined();
    expect(await store.get('ghost')).toBeNull();
  });

  it('lists jobs most-recent segment first, capped by the limit', async () => {
    const store = makeStore();
    await seeded(store, 'job-1', 0, 4);
    await seeded(store, 'job-2', 5, 9);
    await seeded(store, 'job-3', 10, 14);
    expect((await store.list(2)).map((job) => job.id)).toEqual(['job-3', 'job-2']);
    expect((await store.list()).map((job) => job.id)).toEqual(['job-3', 'job-2', 'job-1']);
  });

  it('returns defensive copies — mutating a result does not corrupt the store', async () => {
    const store = makeStore();
    const job = await seeded(store);
    job!.state = 'confirmed';
    expect((await store.get('job-1'))!.state).toBe('queued');
  });
});

describe('getAnchorOutboxStore', () => {
  const originalDbUrl = process.env.DATABASE_URL;

  afterEach(() => {
    if (originalDbUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDbUrl;
    __resetAnchorOutboxStoreForTests();
  });

  it('uses the in-memory store without DATABASE_URL and caches the instance', () => {
    delete process.env.DATABASE_URL;
    __resetAnchorOutboxStoreForTests();
    const store = getAnchorOutboxStore();
    expect(store).toBeInstanceOf(InMemoryAnchorOutboxStore);
    expect(getAnchorOutboxStore()).toBe(store);
  });

  it('uses the Postgres store when DATABASE_URL is configured', () => {
    process.env.DATABASE_URL = 'postgres://user:pass@localhost:5432/shiora';
    __resetAnchorOutboxStoreForTests();
    expect(getAnchorOutboxStore()).toBeInstanceOf(PgAnchorOutboxStore);
  });
});
