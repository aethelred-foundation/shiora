// ============================================================
// Shiora on Aethelred — Anchor Outbox Store (transactional outbox)
//
// Durable job queue for audit-segment anchoring. Creating a row IS the
// segment cut: it fixes the [fromSeq, toSeq] slice of the audit chain and the
// off-chain salt in one atomic insert, so the job can never drift from the
// data it covers (the classic transactional-outbox property). The chain
// worker then drives each job queued → submitted → confirmed, with bounded
// retries through `failed` and a terminal `dead` letter — entirely
// asynchronously, so no L1 outage can ever touch a healthcare operation.
//
// One interface, two adapters chosen by environment (mirrors the challenge
// store): in-memory for dev/tests/single replica, Postgres for cross-instance
// production where a leased UPDATE ... RETURNING claim guarantees only one
// replica works a job. Rows are never pruned: the salt they hold is the only
// way to open the on-chain commitment, so the table is the auditor's
// off-chain record of what was anchored.
// ============================================================

import { getPgClient } from '@/lib/persistence/sql-client';
import { PgAnchorOutboxStore } from '@/lib/persistence/pg-anchor-outbox-store';
import { shouldUsePostgres } from '@/lib/persistence/datastore-mode';

export type AnchorJobState = 'queued' | 'submitted' | 'confirmed' | 'failed' | 'dead';

export interface AnchorJob {
  id: string;
  /** First audit-chain seq covered by this segment (inclusive). */
  fromSeq: number;
  /** Last audit-chain seq covered by this segment (inclusive). */
  toSeq: number;
  /** Off-chain salt (hex) blinding the on-chain commitment. Never anchored. */
  salt: string;
  /** Merkle root over the segment's entry hashes, once built. */
  merkleRoot: string | null;
  /** The anchored value: sha256(salt || merkleRoot), once built. */
  commitment: string | null;
  state: AnchorJobState;
  /** Failed processing attempts so far (bounds the retry loop). */
  attempts: number;
  /** Epoch-ms after which the job is due for (re)processing. */
  nextAttemptAt: number;
  /** Epoch-ms lease held by the replica currently working the job (0 = free). */
  leaseUntil: number;
  /** When the current submission was broadcast, or null before any. */
  submittedAt: number | null;
  /** Transaction hash (or local ref) from the anchor client. Never fabricated. */
  txRef: string | null;
  /** Submission target (RPC URL, or 'local'). */
  anchorTarget: string | null;
  /** 'on-chain' when broadcast to L1; 'local' when only recorded locally. */
  anchorStatus: 'on-chain' | 'local' | null;
  lastError: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface NewAnchorJob {
  id: string;
  fromSeq: number;
  toSeq: number;
  salt: string;
}

export interface AnchorSubmission {
  merkleRoot: string;
  commitment: string;
  txRef: string;
  anchorTarget: string;
  anchorStatus: 'on-chain' | 'local';
  /** When to poll for confirmation next. */
  nextAttemptAt: number;
}

export interface AnchorOutboxStore {
  /**
   * Insert a queued job covering [fromSeq, toSeq], due immediately. The first
   * writer per fromSeq wins; a racing duplicate cut returns null.
   */
  enqueue(job: NewAnchorJob, now: number): Promise<AnchorJob | null>;
  /** Highest toSeq across all jobs in any state, or null when none exist. */
  lastCoveredSeq(): Promise<number | null>;
  /**
   * Atomically claim up to `limit` due jobs (oldest segment first) under a
   * lease, so exactly one replica works each job at a time.
   */
  claimDue(now: number, leaseUntil: number, limit: number): Promise<AnchorJob[]>;
  /** Record a broadcast submission and schedule its confirmation poll. */
  markSubmitted(id: string, submission: AnchorSubmission, now: number): Promise<void>;
  /** Terminal success: the anchor is confirmed final. */
  markConfirmed(id: string, now: number): Promise<void>;
  /** Count a failed attempt and schedule the bounded retry. */
  markFailed(id: string, error: string, nextAttemptAt: number, now: number): Promise<void>;
  /** Dead-letter the job: retries exhausted, operator attention required. */
  markDead(id: string, error: string, now: number): Promise<void>;
  /** Move the next poll without consuming an attempt (confirmation pending). */
  reschedule(id: string, nextAttemptAt: number, now: number): Promise<void>;
  get(id: string): Promise<AnchorJob | null>;
  /** Jobs most-recent segment first, capped at `limit` (default 50). */
  list(limit?: number): Promise<AnchorJob[]>;
}

const CLAIMABLE_STATES: readonly AnchorJobState[] = ['queued', 'submitted', 'failed'];

/** In-memory {@link AnchorOutboxStore}. Single-instance only. */
export class InMemoryAnchorOutboxStore implements AnchorOutboxStore {
  private readonly jobs = new Map<string, AnchorJob>();

  async enqueue(job: NewAnchorJob, now: number): Promise<AnchorJob | null> {
    let duplicate = false;
    this.jobs.forEach((existing) => {
      if (existing.fromSeq === job.fromSeq) duplicate = true;
    });
    if (duplicate) {
      return null;
    }
    const created: AnchorJob = {
      ...job,
      merkleRoot: null,
      commitment: null,
      state: 'queued',
      attempts: 0,
      nextAttemptAt: now,
      leaseUntil: 0,
      submittedAt: null,
      txRef: null,
      anchorTarget: null,
      anchorStatus: null,
      lastError: null,
      createdAt: now,
      updatedAt: now,
    };
    this.jobs.set(job.id, created);
    return { ...created };
  }

  async lastCoveredSeq(): Promise<number | null> {
    let last: number | null = null;
    this.jobs.forEach((job) => {
      if (last === null || job.toSeq > last) {
        last = job.toSeq;
      }
    });
    return last;
  }

  async claimDue(now: number, leaseUntil: number, limit: number): Promise<AnchorJob[]> {
    const due = this.all()
      .filter((job) => CLAIMABLE_STATES.includes(job.state) && job.nextAttemptAt <= now && job.leaseUntil <= now)
      .sort((a, b) => a.fromSeq - b.fromSeq)
      .slice(0, limit);
    due.forEach((job) => {
      job.leaseUntil = leaseUntil;
      job.updatedAt = now;
    });
    return due.map((job) => ({ ...job }));
  }

  async markSubmitted(id: string, submission: AnchorSubmission, now: number): Promise<void> {
    this.update(id, (job) => {
      job.state = 'submitted';
      job.merkleRoot = submission.merkleRoot;
      job.commitment = submission.commitment;
      job.txRef = submission.txRef;
      job.anchorTarget = submission.anchorTarget;
      job.anchorStatus = submission.anchorStatus;
      job.submittedAt = now;
      job.nextAttemptAt = submission.nextAttemptAt;
    }, now);
  }

  async markConfirmed(id: string, now: number): Promise<void> {
    this.update(id, (job) => {
      job.state = 'confirmed';
    }, now);
  }

  async markFailed(id: string, error: string, nextAttemptAt: number, now: number): Promise<void> {
    this.update(id, (job) => {
      job.state = 'failed';
      job.attempts += 1;
      job.lastError = error;
      job.nextAttemptAt = nextAttemptAt;
    }, now);
  }

  async markDead(id: string, error: string, now: number): Promise<void> {
    this.update(id, (job) => {
      job.state = 'dead';
      job.attempts += 1; // the fatal attempt is still an attempt
      job.lastError = error;
    }, now);
  }

  async reschedule(id: string, nextAttemptAt: number, now: number): Promise<void> {
    this.update(id, (job) => {
      job.nextAttemptAt = nextAttemptAt;
    }, now);
  }

  async get(id: string): Promise<AnchorJob | null> {
    const job = this.jobs.get(id);
    return job ? { ...job } : null;
  }

  async list(limit = 50): Promise<AnchorJob[]> {
    return this.all()
      .sort((a, b) => b.fromSeq - a.fromSeq)
      .slice(0, limit)
      .map((job) => ({ ...job }));
  }

  private all(): AnchorJob[] {
    const jobs: AnchorJob[] = [];
    this.jobs.forEach((job) => jobs.push(job));
    return jobs;
  }

  private update(id: string, apply: (job: AnchorJob) => void, now: number): void {
    const job = this.jobs.get(id);
    if (!job) {
      return;
    }
    apply(job);
    job.leaseUntil = 0;
    job.updatedAt = now;
  }
}

let store: AnchorOutboxStore | null = null;

/** The process-wide anchor outbox store, selected by environment. */
export function getAnchorOutboxStore(): AnchorOutboxStore {
  if (!store) {
    store = shouldUsePostgres()
      ? new PgAnchorOutboxStore(getPgClient())
      : new InMemoryAnchorOutboxStore();
  }
  return store;
}

export function __resetAnchorOutboxStoreForTests(): void {
  store = null;
}
