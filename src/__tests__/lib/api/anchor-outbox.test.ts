/** @jest-environment node */

import { getAuditLog, PersistentAuditLog, __resetAuditLogForTests } from '@/lib/api/audit-log';
import { __resetAnchorClientForTests } from '@/lib/api/anchoring/anchor-client';
import { listAnchors, __resetAnchorRepositoryForTests } from '@/lib/api/anchoring/anchor-service';
import {
  ANCHOR_BATCH_LIMIT,
  ANCHOR_CONFIRMATION_POLL_MS,
  ANCHOR_CONFIRMATION_TIMEOUT_MS,
  ANCHOR_LEASE_MS,
  ANCHOR_MAX_ATTEMPTS,
  ANCHOR_RETRY_BASE_MS,
  ANCHOR_RETRY_MAX_MS,
  enqueueAnchorJob,
  listAnchorJobs,
  retryDelayMs,
  runAnchorOutbox,
  verifyAnchorJob,
} from '@/lib/api/anchoring/anchor-outbox';
import {
  merkleRootOfHashes,
  saltedCommitment,
} from '@/lib/api/anchoring/segment-commitment';
import { __resetAnchorOutboxStoreForTests } from '@/lib/persistence/anchor-outbox-store';
import { __resetDerivedSecretsForTests } from '@/lib/crypto/derived-secrets';

const T0 = 1_700_000_000_000;
const L1_ENVS = ['SHIORA_L1_RPC_URL', 'SHIORA_L1_ANCHOR_FROM', 'SHIORA_L1_ANCHOR_TO'];
const realFetch = global.fetch;

function configureL1(): void {
  process.env.SHIORA_L1_RPC_URL = 'https://l1.example/rpc';
  process.env.SHIORA_L1_ANCHOR_FROM = '0xfrom';
  process.env.SHIORA_L1_ANCHOR_TO = '0xto';
}

async function seedAudit(n: number): Promise<void> {
  for (let i = 0; i < n; i++) {
    await getAuditLog().record({
      action: 'RECORD_CREATE',
      actor: 'aeth1clinician',
      resource: 'record',
      resourceId: `r${i}`,
      success: true,
    });
  }
}

/**
 * An L1 node double: answers eth_sendTransaction with sequential hashes and
 * eth_getTransactionReceipt from a settable receipt.
 */
function mockL1Node(): { receipt: { value: unknown }; head: { value: string }; sent: string[] } {
  // head defaults deep enough that any success receipt at block 1 clears the
  // finality-confirmation depth (§6); tests that need a shallow tx lower it.
  const state = { receipt: { value: null as unknown }, head: { value: '0x100' }, sent: [] as string[] };
  let txCounter = 0;
  global.fetch = jest.fn(async (_url, init) => {
    const request = JSON.parse((init as { body: string }).body);
    if (request.method === 'eth_sendTransaction') {
      state.sent.push(request.params[0].data);
      txCounter += 1;
      return { ok: true, status: 200, json: async () => ({ result: `0xtx${txCounter}` }) };
    }
    if (request.method === 'eth_blockNumber') {
      return { ok: true, status: 200, json: async () => ({ result: state.head.value }) };
    }
    return { ok: true, status: 200, json: async () => ({ result: state.receipt.value }) };
  }) as unknown as typeof fetch;
  return state;
}

let logSpy: jest.SpyInstance;
let warnSpy: jest.SpyInstance;
let errorSpy: jest.SpyInstance;

beforeEach(() => {
  logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  L1_ENVS.forEach((k) => delete process.env[k]);
  global.fetch = realFetch;
  __resetAuditLogForTests();
  __resetAnchorOutboxStoreForTests();
  __resetAnchorClientForTests();
  __resetAnchorRepositoryForTests();
  __resetDerivedSecretsForTests();
  jest.restoreAllMocks();
});

describe('enqueueAnchorJob (segment cut)', () => {
  it('cuts one job covering the whole unanchored chain, due immediately', async () => {
    await seedAudit(3);
    const job = await enqueueAnchorJob(T0);
    expect(job).toMatchObject({ fromSeq: 0, toSeq: 2, state: 'queued', nextAttemptAt: T0 });
    expect(job!.salt).toMatch(/^[0-9a-f]{64}$/);
  });

  it('cuts nothing from an empty chain (clock defaults to now)', async () => {
    expect(await enqueueAnchorJob()).toBeNull();
  });

  it('cuts nothing when every entry is already covered', async () => {
    await seedAudit(2);
    await enqueueAnchorJob(T0);
    expect(await enqueueAnchorJob(T0 + 1)).toBeNull();
  });

  it('cuts the next segment immediately after the last covered entry, with a fresh salt', async () => {
    await seedAudit(3);
    const first = await enqueueAnchorJob(T0);
    await seedAudit(2);
    const second = await enqueueAnchorJob(T0 + 1);
    expect(second).toMatchObject({ fromSeq: 3, toSeq: 4 });
    expect(second!.salt).not.toBe(first!.salt);
  });
});

describe('runAnchorOutbox with the local client (no L1 configured)', () => {
  it('cuts, builds, records locally, and confirms in one pass — honestly marked local', async () => {
    await seedAudit(3);
    const report = await runAnchorOutbox(T0);
    expect(report).toEqual({
      cut: 1, processed: 1, submitted: 0, confirmed: 1, pending: 0, retried: 0, dead: 0, errors: 0,
    });

    const [job] = await listAnchorJobs();
    expect(job.state).toBe('confirmed');
    expect(job.anchorStatus).toBe('local');
    expect(job.anchorTarget).toBe('local');
    expect(job.txRef).toBe(`local:${job.commitment}`);

    // Confirmation also lands in the WORM anchor series (audit finding F5).
    const [anchor] = await listAnchors();
    expect(anchor.payload).toMatchObject({
      version: 2,
      commitment: job.commitment,
      fromSeq: job.fromSeq,
      toSeq: job.toSeq,
    });
  });

  it('anchors the salted commitment of the segment Merkle root — never the root itself', async () => {
    await seedAudit(4);
    await runAnchorOutbox(T0);

    const [job] = await listAnchorJobs();
    const bundle = await getAuditLog().exportSegment(job.fromSeq, job.toSeq);
    const root = merkleRootOfHashes(bundle.entries.map((entry) => entry.hash));
    expect(job.merkleRoot).toBe(root);
    expect(job.commitment).toBe(saltedCommitment(job.salt, root));
    expect(job.commitment).not.toBe(root);
  });

  it('does nothing when there is nothing to anchor (clock defaults to now)', async () => {
    const report = await runAnchorOutbox();
    expect(report).toEqual({
      cut: 0, processed: 0, submitted: 0, confirmed: 0, pending: 0, retried: 0, dead: 0, errors: 0,
    });
  });
});

describe('runAnchorOutbox against a JSON-RPC L1', () => {
  it('submits sha256(salt || root) as calldata and holds at submitted until the receipt lands', async () => {
    configureL1();
    const node = mockL1Node();
    await seedAudit(3);

    const report = await runAnchorOutbox(T0);
    expect(report).toMatchObject({ cut: 1, processed: 1, submitted: 1, confirmed: 0 });

    const [job] = await listAnchorJobs();
    expect(job.state).toBe('submitted');
    expect(job.txRef).toBe('0xtx1');
    expect(job.anchorStatus).toBe('on-chain');
    expect(node.sent).toEqual([`0x${job.commitment}`]);
    // The salt and the raw Merkle root never travel to the chain.
    expect(node.sent[0]).not.toContain(job.salt);
    expect(node.sent[0]).not.toContain(job.merkleRoot);
  });

  it('confirms a submitted job once the receipt reports success', async () => {
    configureL1();
    const node = mockL1Node();
    await seedAudit(2);
    await runAnchorOutbox(T0);

    node.receipt.value = { status: '0x1', blockNumber: '0x1' };
    const report = await runAnchorOutbox(T0 + ANCHOR_CONFIRMATION_POLL_MS);
    expect(report).toMatchObject({ processed: 1, confirmed: 1 });

    const [job] = await listAnchorJobs();
    expect(job.state).toBe('confirmed');

    // Only now — with the receipt in hand — does the WORM series record it.
    const [anchor] = await listAnchors();
    expect(anchor.payload).toMatchObject({ version: 2, commitment: job.commitment });
    expect(anchor.receipt).toMatchObject({ ref: '0xtx1', status: 'on-chain' });
  });

  it('records nothing in the WORM series while a submission is unconfirmed', async () => {
    configureL1();
    mockL1Node();
    await seedAudit(2);
    await runAnchorOutbox(T0);
    expect(await listAnchors()).toEqual([]);
  });

  it('keeps polling an unconfirmed submission without consuming attempts', async () => {
    configureL1();
    mockL1Node(); // receipt stays null → pending
    await seedAudit(2);
    await runAnchorOutbox(T0);

    const report = await runAnchorOutbox(T0 + ANCHOR_CONFIRMATION_POLL_MS);
    expect(report).toMatchObject({ processed: 1, pending: 1, confirmed: 0, retried: 0 });

    const [job] = await listAnchorJobs();
    expect(job.state).toBe('submitted');
    expect(job.attempts).toBe(0);
    expect(job.nextAttemptAt).toBe(T0 + 2 * ANCHOR_CONFIRMATION_POLL_MS);
  });

  it('counts a failure and resubmits when confirmation times out', async () => {
    configureL1();
    const node = mockL1Node();
    await seedAudit(2);
    await runAnchorOutbox(T0);

    const timedOut = T0 + ANCHOR_CONFIRMATION_TIMEOUT_MS;
    const report = await runAnchorOutbox(timedOut);
    expect(report).toMatchObject({ retried: 1 });

    let [job] = await listAnchorJobs();
    expect(job.state).toBe('failed');
    expect(job.attempts).toBe(1);
    expect(job.lastError).toContain('confirmation timeout');

    // The retry rebuilds and broadcasts a fresh transaction.
    await runAnchorOutbox(job.nextAttemptAt);
    [job] = await listAnchorJobs();
    expect(job.state).toBe('submitted');
    expect(job.txRef).toBe('0xtx2');
    expect(node.sent).toHaveLength(2);
  });

  it('counts a failure and resubmits when the transaction reverted on-chain', async () => {
    configureL1();
    const node = mockL1Node();
    await seedAudit(2);
    await runAnchorOutbox(T0);

    node.receipt.value = { status: '0x0' };
    const report = await runAnchorOutbox(T0 + ANCHOR_CONFIRMATION_POLL_MS);
    expect(report).toMatchObject({ retried: 1 });

    const [job] = await listAnchorJobs();
    expect(job.state).toBe('failed');
    expect(job.lastError).toContain('failed on-chain');
  });

  it('treats a transport failure during confirmation as still pending, not as failure', async () => {
    configureL1();
    mockL1Node();
    await seedAudit(2);
    await runAnchorOutbox(T0);

    global.fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED')) as unknown as typeof fetch;
    const report = await runAnchorOutbox(T0 + ANCHOR_CONFIRMATION_POLL_MS);
    expect(report).toMatchObject({ pending: 1, retried: 0 });
    const [job] = await listAnchorJobs();
    expect(job.state).toBe('submitted');
    expect(job.attempts).toBe(0);
  });

  it('never fabricates a transaction hash — a submission without a hash is a failure', async () => {
    configureL1();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    }) as unknown as typeof fetch;
    await seedAudit(2);

    const report = await runAnchorOutbox(T0);
    expect(report).toMatchObject({ retried: 1, submitted: 0, confirmed: 0 });

    const [job] = await listAnchorJobs();
    expect(job.state).toBe('failed');
    expect(job.txRef).toBeNull();
    expect(job.lastError).toContain('no transaction hash');
  });

  it('an RPC outage schedules a bounded retry with exponential backoff', async () => {
    configureL1();
    global.fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED')) as unknown as typeof fetch;
    await seedAudit(2);

    const report = await runAnchorOutbox(T0);
    expect(report).toMatchObject({ cut: 1, processed: 1, retried: 1, errors: 0 });

    const [job] = await listAnchorJobs();
    expect(job.state).toBe('failed');
    expect(job.attempts).toBe(1);
    expect(job.lastError).toContain('unreachable');
    expect(job.nextAttemptAt).toBe(T0 + retryDelayMs(1));
    expect(warnSpy).toHaveBeenCalled();
  });

  it('claims under a bounded lease and batch size', async () => {
    configureL1();
    mockL1Node();
    await seedAudit(2);
    // The claim window and per-pass batch are deliberate, finite bounds: a
    // crashed replica frees its job within the lease, and one pass can never
    // monopolise the worker.
    expect(ANCHOR_LEASE_MS).toBe(5 * 60 * 1000);
    expect(ANCHOR_BATCH_LIMIT).toBe(10);
    await runAnchorOutbox(T0);
    const [job] = await listAnchorJobs();
    expect(job.state).toBe('submitted');
  });

  it('dead-letters a job after the retry budget is exhausted — never silently drops it', async () => {
    configureL1();
    global.fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED')) as unknown as typeof fetch;
    await seedAudit(2);

    let now = T0;
    let lastReport = await runAnchorOutbox(now);
    for (let attempt = 2; attempt <= ANCHOR_MAX_ATTEMPTS; attempt++) {
      now = (await listAnchorJobs())[0].nextAttemptAt;
      lastReport = await runAnchorOutbox(now);
    }

    expect(lastReport).toMatchObject({ dead: 1, retried: 0 });
    const [job] = await listAnchorJobs();
    expect(job.state).toBe('dead');
    expect(job.attempts).toBe(ANCHOR_MAX_ATTEMPTS);
    // A dead segment stays covered: no duplicate job is cut for it.
    expect(await enqueueAnchorJob(now + 1)).toBeNull();
  });

  it('processes a backlog of due jobs in one pass', async () => {
    configureL1();
    global.fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED')) as unknown as typeof fetch;
    await seedAudit(3);
    await runAnchorOutbox(T0); // job 1 cut, submission fails

    const retryAt = (await listAnchorJobs())[0].nextAttemptAt;
    await seedAudit(2);
    const node = mockL1Node(); // RPC is back
    const report = await runAnchorOutbox(retryAt);

    expect(report).toMatchObject({ cut: 1, processed: 2, submitted: 2 });
    expect(node.sent).toHaveLength(2);
    const jobs = await listAnchorJobs();
    expect(jobs.map((job) => job.state)).toEqual(['submitted', 'submitted']);
  });

  it('fails the job rather than anchoring when the durable chain is missing segment entries', async () => {
    configureL1();
    mockL1Node();
    await seedAudit(3);
    const bundle = await getAuditLog().exportSegment(0, 1); // 2 of the 3 entries
    jest.spyOn(PersistentAuditLog.prototype, 'exportSegment').mockResolvedValueOnce(bundle);

    const report = await runAnchorOutbox(T0);
    expect(report).toMatchObject({ retried: 1, submitted: 0 });
    expect((await listAnchorJobs())[0].lastError).toContain('incomplete');
  });
});

describe('fail-soft guarantees', () => {
  it('a total anchoring outage never surfaces to callers or blocks audit writes', async () => {
    configureL1();
    global.fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED')) as unknown as typeof fetch;
    await seedAudit(3);

    await expect(runAnchorOutbox(T0)).resolves.toMatchObject({ retried: 1 });

    // The healthcare-facing write path is untouched by the dead RPC.
    await expect(seedAudit(1)).resolves.toBeUndefined();
    expect((await getAuditLog().head()).length).toBe(4);
  });

  it('even an unexpected pipeline error is contained and reported, not thrown', async () => {
    await seedAudit(2);
    jest.spyOn(PersistentAuditLog.prototype, 'head').mockRejectedValue(new Error('datastore offline'));

    const report = await runAnchorOutbox(T0);
    expect(report.errors).toBe(1);
    expect(errorSpy).toHaveBeenCalled();
  });
});

describe('retryDelayMs', () => {
  it('doubles from the base and caps at the maximum', () => {
    expect(retryDelayMs(1)).toBe(ANCHOR_RETRY_BASE_MS);
    expect(retryDelayMs(2)).toBe(2 * ANCHOR_RETRY_BASE_MS);
    expect(retryDelayMs(20)).toBe(ANCHOR_RETRY_MAX_MS);
  });
});

describe('verifyAnchorJob (auditor helper)', () => {
  it('proves a confirmed job’s segment against its stored commitment', async () => {
    await seedAudit(3);
    await runAnchorOutbox(T0);
    const [job] = await listAnchorJobs();

    const result = await verifyAnchorJob(job.id);
    expect(result).toEqual({ valid: true, merkleRoot: job.merkleRoot });
  });

  it('rejects an unknown job', async () => {
    expect(await verifyAnchorJob('ghost')).toEqual({ valid: false, reason: 'unknown job' });
  });

  it('reports a job whose commitment has not been built yet', async () => {
    await seedAudit(2);
    const job = await enqueueAnchorJob(T0);
    expect(await verifyAnchorJob(job!.id)).toEqual({ valid: false, reason: 'commitment not yet built' });
  });
});

describe('listAnchorJobs', () => {
  it('returns jobs most-recent segment first; segments stay contiguous across passes', async () => {
    await seedAudit(2);
    await runAnchorOutbox(T0); // covers seqs 0-1; confirming appends the ANCHOR_CREATE entry at seq 2
    await seedAudit(2); // seqs 3-4
    await runAnchorOutbox(T0 + 1);

    const jobs = await listAnchorJobs();
    // The second segment picks up exactly where the first ended — including
    // the anchoring pipeline's own audit entry, which is part of the chain.
    expect(jobs.map((job) => [job.fromSeq, job.toSeq])).toEqual([[2, 4], [0, 1]]);
  });
});
