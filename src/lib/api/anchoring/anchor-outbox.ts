// ============================================================
// Shiora on Aethelred — Anchor outbox service (consultant pre-pilot)
//
// Replaces direct (synchronous) anchoring with a transactional outbox. The
// flow, end to end:
//
//   1. CUT — enqueueAnchorJob() fixes the next unanchored audit-chain slice
//      [fromSeq, toSeq] and its off-chain salt in ONE atomic insert; the row
//      is the segment. First replica wins; duplicates are dropped.
//   2. BUILD — the worker exports the segment as a signed bundle
//      (audit-export), Merkle-roots its entry hashes, and derives the only
//      value that ever reaches the chain: sha256(salt || root). No subject
//      addresses, no guessable scope hashes.
//   3. SUBMIT / CONFIRM — the commitment goes through the AnchorClient seam.
//      A job is 'submitted' until the network returns a success receipt and
//      only then 'confirmed' — an unconfirmed anchor is never reported as
//      anchored, and a transaction hash is never fabricated.
//   4. RETRY / DEAD-LETTER — every failure schedules a bounded exponential
//      retry; an exhausted job dead-letters loudly for the operator.
//
// runAnchorOutbox() is driven by the store-maintenance scheduler and is
// strictly fail-soft: it never throws, so an RPC outage, an empty relayer, or
// a rejection can never affect a healthcare operation. The config-lint
// mainnet gate (src/lib/api/config-lint.ts) remains the sole authority over
// which chains SHIORA_L1_RPC_URL may name.
// ============================================================

import { randomUUID } from 'node:crypto';

import { getAuditLog } from '@/lib/api/audit-log';
import { getAnchorClient, type AnchorConfirmation } from '@/lib/api/anchoring/anchor-client';
import { recordConfirmedAnchor } from '@/lib/api/anchoring/anchor-service';
import {
  merkleRootOfHashes,
  newAnchorSalt,
  saltedCommitment,
  verifySegmentCommitment,
  type SegmentCommitmentVerification,
} from '@/lib/api/anchoring/segment-commitment';
import {
  getAnchorOutboxStore,
  type AnchorJob,
  type AnchorOutboxStore,
} from '@/lib/persistence/anchor-outbox-store';
import { createLogger } from '@/lib/observability/logger';
import { counter } from '@/lib/observability/metrics';

const log = createLogger({ subsystem: 'anchoring' });

const outcomesTotal = counter(
  'shiora_anchor_outbox_outcomes_total',
  'Anchor outbox job outcomes per processing pass, by outcome',
);

/** Failed attempts a job may accumulate before it dead-letters. */
export const ANCHOR_MAX_ATTEMPTS = 8;
/** How long one replica holds a claimed job before others may reclaim it. */
export const ANCHOR_LEASE_MS = 5 * 60 * 1000;
/** First retry delay; doubles per failed attempt. */
export const ANCHOR_RETRY_BASE_MS = 60 * 1000;
/** Retry delay ceiling. */
export const ANCHOR_RETRY_MAX_MS = 60 * 60 * 1000;
/** How soon after submission to poll for the receipt. */
export const ANCHOR_CONFIRMATION_POLL_MS = 60 * 1000;
/** How long a submission may stay unconfirmed before it is retried afresh. */
export const ANCHOR_CONFIRMATION_TIMEOUT_MS = 30 * 60 * 1000;
/** Jobs processed per pass. */
export const ANCHOR_BATCH_LIMIT = 10;

/** Backoff before retry number `attempts` (1-based), capped at the ceiling. */
export function retryDelayMs(attempts: number): number {
  return Math.min(ANCHOR_RETRY_BASE_MS * 2 ** (attempts - 1), ANCHOR_RETRY_MAX_MS);
}

export interface AnchorOutboxRunReport {
  /** Segments cut (a job row created) this pass. */
  cut: number;
  /** Jobs claimed and worked this pass. */
  processed: number;
  /** Broadcast this pass, now awaiting confirmation. */
  submitted: number;
  /** Reached terminal confirmation this pass. */
  confirmed: number;
  /** Confirmation still pending; poll rescheduled without consuming a retry. */
  pending: number;
  /** Failed attempts scheduled for a bounded retry. */
  retried: number;
  /** Dead-lettered this pass (retry budget exhausted). */
  dead: number;
  /** Unexpected pipeline errors, contained (fail-soft). */
  errors: number;
}

/**
 * Cut the next audit segment: one job row covering everything appended since
 * the last cut. Returns null when there is nothing new to anchor or a racing
 * replica already cut the segment.
 */
export async function enqueueAnchorJob(now: number = Date.now()): Promise<AnchorJob | null> {
  const store = getAnchorOutboxStore();
  const head = await getAuditLog().head();
  const last = await store.lastCoveredSeq();
  const fromSeq = last === null ? 0 : last + 1;
  const toSeq = head.length - 1;
  if (toSeq < fromSeq) {
    return null;
  }
  return store.enqueue({ id: randomUUID(), fromSeq, toSeq, salt: newAnchorSalt() }, now);
}

/** Recent anchor jobs, most-recent segment first. */
export async function listAnchorJobs(limit?: number): Promise<AnchorJob[]> {
  return getAnchorOutboxStore().list(limit);
}

/**
 * One fail-soft pass of the outbox: cut the next segment if the chain has
 * grown, then claim and work every due job. Never throws — anchoring problems
 * are recorded on the jobs and in the report, never surfaced to callers.
 */
export async function runAnchorOutbox(now: number = Date.now()): Promise<AnchorOutboxRunReport> {
  const report: AnchorOutboxRunReport = {
    cut: 0, processed: 0, submitted: 0, confirmed: 0, pending: 0, retried: 0, dead: 0, errors: 0,
  };
  try {
    const store = getAnchorOutboxStore();
    if (await enqueueAnchorJob(now)) {
      report.cut = 1;
    }
    const claimed = await store.claimDue(now, now + ANCHOR_LEASE_MS, ANCHOR_BATCH_LIMIT);
    for (const job of claimed) {
      report.processed += 1;
      await processJob(store, job, now, report);
    }
  } catch (err) {
    report.errors += 1;
    outcomesTotal.inc({ outcome: 'error' });
    log.error('anchor outbox pass failed', { err });
  }
  return report;
}

/** Work one claimed job. Every failure lands in recordFailure — nothing throws. */
async function processJob(
  store: AnchorOutboxStore,
  job: AnchorJob,
  now: number,
  report: AnchorOutboxRunReport,
): Promise<void> {
  try {
    if (job.state === 'submitted') {
      await checkConfirmation(store, job, now, report);
      return;
    }
    await buildAndSubmit(store, job, now, report);
  } catch (err) {
    await recordFailure(store, job, (err as Error).message, now, report);
  }
}

/** Export the signed segment, derive the salted commitment, and broadcast it. */
async function buildAndSubmit(
  store: AnchorOutboxStore,
  job: AnchorJob,
  now: number,
  report: AnchorOutboxRunReport,
): Promise<void> {
  const bundle = await getAuditLog().exportSegment(job.fromSeq, job.toSeq);
  if (bundle.count !== job.toSeq - job.fromSeq + 1) {
    throw new Error(
      `audit segment [${job.fromSeq}, ${job.toSeq}] is incomplete: expected `
      + `${job.toSeq - job.fromSeq + 1} entries, found ${bundle.count}.`,
    );
  }
  const merkleRoot = merkleRootOfHashes(bundle.entries.map((entry) => entry.hash));
  const commitment = saltedCommitment(job.salt, merkleRoot);
  const receipt = await getAnchorClient().submit(commitment);

  await store.markSubmitted(job.id, {
    merkleRoot,
    commitment,
    txRef: receipt.ref,
    anchorTarget: receipt.target,
    anchorStatus: receipt.status,
    nextAttemptAt: now + ANCHOR_CONFIRMATION_POLL_MS,
  }, now);

  if (receipt.status === 'local') {
    // Recorded locally, not broadcast — final immediately, and honestly
    // labelled 'local' so it is never mistaken for an on-chain anchor.
    // The WORM record lands before the state flips: a job only reads
    // 'confirmed' once its durable anchor record exists.
    await recordConfirmedAnchor({ commitment, fromSeq: job.fromSeq, toSeq: job.toSeq, receipt }, now);
    await store.markConfirmed(job.id, now);
    report.confirmed += 1;
    outcomesTotal.inc({ outcome: 'confirmed_local' });
    return;
  }
  report.submitted += 1;
  outcomesTotal.inc({ outcome: 'submitted' });
}

/** Poll the network for the receipt of a submitted job. */
async function checkConfirmation(
  store: AnchorOutboxStore,
  job: AnchorJob,
  now: number,
  report: AnchorOutboxRunReport,
): Promise<void> {
  let confirmation: AnchorConfirmation;
  try {
    confirmation = await getAnchorClient().confirm(String(job.txRef));
  } catch {
    // Could not ask the network — indistinguishable from pending; the
    // confirmation timeout below keeps this bounded.
    confirmation = 'pending';
  }

  if (confirmation === 'confirmed') {
    // WORM record first, then the state flip — see the local path above. A
    // crash in between re-runs this branch; a duplicated series entry is
    // harmless, a confirmed job without its record would not be.
    await recordConfirmedAnchor({
      commitment: String(job.commitment),
      fromSeq: job.fromSeq,
      toSeq: job.toSeq,
      receipt: {
        ref: String(job.txRef),
        status: 'on-chain',
        target: String(job.anchorTarget),
        submittedAt: Number(job.submittedAt),
      },
    }, now);
    await store.markConfirmed(job.id, now);
    report.confirmed += 1;
    outcomesTotal.inc({ outcome: 'confirmed' });
    return;
  }
  if (confirmation === 'failed') {
    await recordFailure(store, job, `transaction ${job.txRef} failed on-chain.`, now, report);
    return;
  }
  if (now - Number(job.submittedAt) >= ANCHOR_CONFIRMATION_TIMEOUT_MS) {
    await recordFailure(store, job, `confirmation timeout for ${job.txRef}; resubmitting.`, now, report);
    return;
  }
  await store.reschedule(job.id, now + ANCHOR_CONFIRMATION_POLL_MS, now);
  report.pending += 1;
  outcomesTotal.inc({ outcome: 'pending' });
}

/** Count a failed attempt: bounded retry with backoff, then dead-letter. */
async function recordFailure(
  store: AnchorOutboxStore,
  job: AnchorJob,
  error: string,
  now: number,
  report: AnchorOutboxRunReport,
): Promise<void> {
  const attempts = job.attempts + 1;
  if (attempts >= ANCHOR_MAX_ATTEMPTS) {
    await store.markDead(job.id, error, now);
    report.dead += 1;
    outcomesTotal.inc({ outcome: 'dead' });
    log.error('anchor job dead-lettered', { jobId: job.id, fromSeq: job.fromSeq, toSeq: job.toSeq, attempts, error });
    return;
  }
  await store.markFailed(job.id, error, now + retryDelayMs(attempts), now);
  report.retried += 1;
  outcomesTotal.inc({ outcome: 'retried' });
  log.warn('anchor job attempt failed; retry scheduled', { jobId: job.id, attempts, error });
}

/**
 * Auditor helper: re-export a job's segment from the live chain and prove it
 * against the commitment that was (or will be) anchored for that job.
 */
export async function verifyAnchorJob(id: string): Promise<SegmentCommitmentVerification> {
  const job = await getAnchorOutboxStore().get(id);
  if (!job) {
    return { valid: false, reason: 'unknown job' };
  }
  if (!job.commitment) {
    return { valid: false, reason: 'commitment not yet built' };
  }
  const bundle = await getAuditLog().exportSegment(job.fromSeq, job.toSeq);
  return verifySegmentCommitment(bundle, job.salt, job.commitment);
}
