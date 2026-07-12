// ============================================================
// Shiora on Aethelred — Postgres Anchor Outbox Store
//
// Cross-instance transactional outbox for audit-segment anchoring. Two
// properties make it safe across replicas, restarts, and failovers:
//
//   1. Segment cuts are first-writer-wins: the unique index on from_seq plus
//      ON CONFLICT DO NOTHING means two replicas cutting the same segment
//      produce exactly one job.
//   2. Claims are leased: the claim is one UPDATE over a FOR UPDATE SKIP
//      LOCKED subselect, so exactly one replica works a due job, and a
//      crashed worker's job becomes claimable again when its lease lapses.
//
// Rows are never pruned — each holds the off-chain salt that opens its
// on-chain commitment, which auditors need for as long as the segment matters.
// ============================================================

import type { SqlClient } from './sql-client';
import type {
  AnchorJob,
  AnchorOutboxStore,
  AnchorSubmission,
  NewAnchorJob,
} from './anchor-outbox-store';
import {
  ANCHOR_OUTBOX_DDL,
  ANCHOR_OUTBOX_DUE_INDEX_DDL,
  ANCHOR_OUTBOX_SEGMENT_INDEX_DDL,
} from './schema';

/** A raw anchor_outbox row (Postgres returns bigints as strings). */
interface AnchorOutboxRow {
  id: string;
  from_seq: string | number;
  to_seq: string | number;
  salt: string;
  merkle_root: string | null;
  commitment: string | null;
  state: AnchorJob['state'];
  attempts: string | number;
  next_attempt_at: string | number;
  lease_until: string | number;
  submitted_at: string | number | null;
  tx_ref: string | null;
  anchor_target: string | null;
  anchor_status: AnchorJob['anchorStatus'];
  last_error: string | null;
  created_at: string | number;
  updated_at: string | number;
}

const RETURNING_COLUMNS = `id, from_seq, to_seq, salt, merkle_root, commitment, state, attempts,
       next_attempt_at, lease_until, submitted_at, tx_ref, anchor_target, anchor_status,
       last_error, created_at, updated_at`;

function toJob(row: AnchorOutboxRow): AnchorJob {
  return {
    id: row.id,
    fromSeq: Number(row.from_seq),
    toSeq: Number(row.to_seq),
    salt: row.salt,
    merkleRoot: row.merkle_root,
    commitment: row.commitment,
    state: row.state,
    attempts: Number(row.attempts),
    nextAttemptAt: Number(row.next_attempt_at),
    leaseUntil: Number(row.lease_until),
    submittedAt: row.submitted_at === null ? null : Number(row.submitted_at),
    txRef: row.tx_ref,
    anchorTarget: row.anchor_target,
    anchorStatus: row.anchor_status,
    lastError: row.last_error,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

export class PgAnchorOutboxStore implements AnchorOutboxStore {
  constructor(private readonly client: SqlClient) {}

  /** Create the anchor_outbox table and supporting indexes if absent. */
  async migrate(): Promise<void> {
    await this.client.query(ANCHOR_OUTBOX_DDL);
    await this.client.query(ANCHOR_OUTBOX_DUE_INDEX_DDL);
    await this.client.query(ANCHOR_OUTBOX_SEGMENT_INDEX_DDL);
  }

  async enqueue(job: NewAnchorJob, now: number): Promise<AnchorJob | null> {
    const { rows } = await this.client.query<AnchorOutboxRow>(
      `INSERT INTO anchor_outbox (id, from_seq, to_seq, salt, state, attempts,
                                  next_attempt_at, lease_until, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 'queued', 0, $5, 0, $5, $5)
       ON CONFLICT (from_seq) DO NOTHING
       RETURNING ${RETURNING_COLUMNS}`,
      [job.id, job.fromSeq, job.toSeq, job.salt, now],
    );
    return rows.length === 0 ? null : toJob(rows[0]);
  }

  async lastCoveredSeq(): Promise<number | null> {
    const { rows } = await this.client.query<{ last_seq: string | number | null }>(
      'SELECT MAX(to_seq) AS last_seq FROM anchor_outbox',
    );
    return rows[0].last_seq === null ? null : Number(rows[0].last_seq);
  }

  async claimDue(now: number, leaseUntil: number, limit: number): Promise<AnchorJob[]> {
    const { rows } = await this.client.query<AnchorOutboxRow>(
      `UPDATE anchor_outbox
          SET lease_until = $2, updated_at = $1
        WHERE id IN (
          SELECT id FROM anchor_outbox
           WHERE state IN ('queued', 'submitted', 'failed')
             AND next_attempt_at <= $1
             AND lease_until <= $1
           ORDER BY from_seq
           LIMIT $3
           FOR UPDATE SKIP LOCKED)
       RETURNING ${RETURNING_COLUMNS}`,
      [now, leaseUntil, limit],
    );
    return rows.map(toJob).sort((a, b) => a.fromSeq - b.fromSeq);
  }

  async markSubmitted(id: string, submission: AnchorSubmission, now: number): Promise<void> {
    await this.client.query(
      `UPDATE anchor_outbox
          SET state = 'submitted', merkle_root = $2, commitment = $3, tx_ref = $4,
              anchor_target = $5, anchor_status = $6, submitted_at = $8,
              next_attempt_at = $7, lease_until = 0, updated_at = $8
        WHERE id = $1`,
      [
        id,
        submission.merkleRoot,
        submission.commitment,
        submission.txRef,
        submission.anchorTarget,
        submission.anchorStatus,
        submission.nextAttemptAt,
        now,
      ],
    );
  }

  async markConfirmed(id: string, now: number): Promise<void> {
    await this.client.query(
      `UPDATE anchor_outbox
          SET state = 'confirmed', lease_until = 0, updated_at = $2
        WHERE id = $1`,
      [id, now],
    );
  }

  async markFailed(id: string, error: string, nextAttemptAt: number, now: number): Promise<void> {
    await this.client.query(
      `UPDATE anchor_outbox
          SET state = 'failed', attempts = attempts + 1, last_error = $2,
              next_attempt_at = $3, lease_until = 0, updated_at = $4
        WHERE id = $1`,
      [id, error, nextAttemptAt, now],
    );
  }

  async markDead(id: string, error: string, now: number): Promise<void> {
    await this.client.query(
      `UPDATE anchor_outbox
          SET state = 'dead', last_error = $2, lease_until = 0, updated_at = $3
        WHERE id = $1`,
      [id, error, now],
    );
  }

  async reschedule(id: string, nextAttemptAt: number, now: number): Promise<void> {
    await this.client.query(
      `UPDATE anchor_outbox
          SET next_attempt_at = $2, lease_until = 0, updated_at = $3
        WHERE id = $1`,
      [id, nextAttemptAt, now],
    );
  }

  async get(id: string): Promise<AnchorJob | null> {
    const { rows } = await this.client.query<AnchorOutboxRow>(
      `SELECT ${RETURNING_COLUMNS} FROM anchor_outbox WHERE id = $1`,
      [id],
    );
    return rows.length === 0 ? null : toJob(rows[0]);
  }

  async list(limit = 50): Promise<AnchorJob[]> {
    const { rows } = await this.client.query<AnchorOutboxRow>(
      `SELECT ${RETURNING_COLUMNS} FROM anchor_outbox ORDER BY from_seq DESC LIMIT $1`,
      [limit],
    );
    return rows.map(toJob);
  }
}
