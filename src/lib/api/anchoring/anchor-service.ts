// ============================================================
// Shiora on Aethelred — Anchor record service (audit Finding F5)
//
// The WORM, hash-linked series of anchors that have actually completed.
// Direct (synchronous) anchoring used to live here; it is replaced by the
// transactional outbox (anchor-outbox.ts), which now owns building,
// submitting, and confirming anchors. This service keeps two duties:
//
//   1. recordConfirmedAnchor() — the outbox's final step. Once a submission
//      is confirmed (or honestly recorded as local-only), the segment
//      commitment is appended here, hash-linked to the previous anchor, and
//      never updated or deleted (WORM).
//   2. listAnchors() / verifyAnchors() — the admin/auditor read path, which
//      re-verifies the series' internal linkage on every read.
//
// Payloads are versioned: version 1 records (pre-outbox) committed the raw
// audit head; version 2 records commit a salted segment commitment
// (sha256(salt || merkleRoot), see segment-commitment.ts) so nothing
// linkable ever reaches the chain. Both versions verify.
// ============================================================

import crypto from 'node:crypto';
import { randomUUID } from 'node:crypto';

import { getAuditLog } from '@/lib/api/audit-log';
import { GENESIS_HASH } from '@/lib/crypto/audit-chain';
import { EncryptedDocumentRepository } from '@/lib/persistence/encrypted-documents';
import { InMemoryDocumentStore, type DocumentStorePort } from '@/lib/persistence/document-store';
import { PgDocumentStore } from '@/lib/persistence/pg-document-store';
import { getPgClient } from '@/lib/persistence/sql-client';
import { shouldUsePostgres } from '@/lib/persistence/datastore-mode';
import type { AnchorReceipt } from './anchor-client';

const COLLECTION = 'anchor';
/** Single global series: the audit chain anchored is platform-wide, not per-owner. */
const GLOBAL_KEY = '__global__';

/** Pre-outbox payload: committed the raw audit head. Kept verifiable. */
export interface AuditHeadPayload {
  /** The audit-chain head hash that was anchored. */
  auditHead: string;
  /** Number of entries the head covered. */
  auditLength: number;
  createdAt: number;
  version: 1;
}

/** Outbox payload: commits a salted segment commitment, nothing linkable. */
export interface SegmentAnchorPayload {
  /** sha256(salt || merkleRoot) — the only value that reached the chain. */
  commitment: string;
  /** First audit-chain seq the segment covers (inclusive). */
  fromSeq: number;
  /** Last audit-chain seq the segment covers (inclusive). */
  toSeq: number;
  createdAt: number;
  version: 2;
}

/** What an anchor commits to. Versioned so the structure can evolve. */
export type AnchorPayload = AuditHeadPayload | SegmentAnchorPayload;

/** A WORM, hash-linked anchor record. */
export interface AnchorRecord {
  id: string;
  /** Position in the anchor series (0-based). */
  seq: number;
  /** Hash of the previous anchor (GENESIS_HASH for the first). */
  prevHash: string;
  /** SHA-256 over prevHash | seq | payload — links anchors into their own chain. */
  hash: string;
  payload: AnchorPayload;
  /** Where/how the anchor was submitted (on-chain or local). */
  receipt: AnchorReceipt;
}

/** What the outbox hands over once a submission is confirmed. */
export interface ConfirmedAnchorInput {
  commitment: string;
  fromSeq: number;
  toSeq: number;
  receipt: AnchorReceipt;
}

/** The result of re-verifying the anchor series' internal linkage. */
export interface AnchorVerification {
  valid: boolean;
  length: number;
  brokenAt?: number;
  reason?: string;
}

let repository: EncryptedDocumentRepository<AnchorRecord> | null = null;

function createStore(): DocumentStorePort {
  if (shouldUsePostgres()) {
    return new PgDocumentStore(getPgClient());
  }
  return new InMemoryDocumentStore();
}

function repo(): EncryptedDocumentRepository<AnchorRecord> {
  if (!repository) {
    repository = new EncryptedDocumentRepository<AnchorRecord>(
      createStore(),
      getAuditLog(),
      COLLECTION,
      { create: 'ANCHOR_CREATE', update: 'ANCHOR_CREATE' },
    );
  }
  return repository;
}

function anchorHash(prevHash: string, seq: number, payload: AnchorPayload): string {
  const fields = payload.version === 1
    ? [payload.auditHead, payload.auditLength]
    : [payload.commitment, payload.fromSeq, payload.toSeq];
  const preimage = [prevHash, seq, ...fields, payload.createdAt, payload.version].join('|');
  return crypto.createHash('sha256').update(preimage).digest('hex');
}

/** Anchors sorted oldest-first by sequence. */
async function anchorsAsc(): Promise<AnchorRecord[]> {
  const all = await repo().list(GLOBAL_KEY);
  return all.sort((a, b) => a.seq - b.seq);
}

/** The most recent anchor, or null when none have been recorded. */
export async function getLatestAnchor(): Promise<AnchorRecord | null> {
  const all = await anchorsAsc();
  return all.length === 0 ? null : all[all.length - 1];
}

/** Anchors most-recent first. */
export async function listAnchors(): Promise<AnchorRecord[]> {
  const all = await anchorsAsc();
  return all.reverse();
}

/**
 * Append the WORM record for a confirmed anchor — the outbox's final step,
 * called only after the network confirmed the submission (or for an honest
 * local-only receipt). `now` is injectable for deterministic tests.
 */
export async function recordConfirmedAnchor(
  input: ConfirmedAnchorInput,
  now: number = Date.now(),
): Promise<AnchorRecord> {
  const latest = await getLatestAnchor();
  const seq = latest ? latest.seq + 1 : 0;
  const prevHash = latest ? latest.hash : GENESIS_HASH;
  const payload: SegmentAnchorPayload = {
    commitment: input.commitment,
    fromSeq: input.fromSeq,
    toSeq: input.toSeq,
    createdAt: now,
    version: 2,
  };
  const record: AnchorRecord = {
    id: randomUUID(),
    seq,
    prevHash,
    hash: anchorHash(prevHash, seq, payload),
    payload,
    receipt: input.receipt,
  };
  await repo().create(GLOBAL_KEY, record);
  return record;
}

/** Pure re-verification of an anchor series' hash linkage (order-independent). */
export function verifyAnchorChain(records: AnchorRecord[]): AnchorVerification {
  const all = [...records].sort((a, b) => a.seq - b.seq);

  for (let i = 0; i < all.length; i += 1) {
    const record = all[i];
    const expectedPrev = i === 0 ? GENESIS_HASH : all[i - 1].hash;
    if (record.prevHash !== expectedPrev) {
      return { valid: false, length: all.length, brokenAt: record.seq, reason: 'prevHash mismatch' };
    }
    if (anchorHash(record.prevHash, record.seq, record.payload) !== record.hash) {
      return { valid: false, length: all.length, brokenAt: record.seq, reason: 'hash mismatch' };
    }
  }

  return { valid: true, length: all.length };
}

/** Re-verify the persisted anchor series independently of storage. */
export async function verifyAnchors(): Promise<AnchorVerification> {
  return verifyAnchorChain(await repo().list(GLOBAL_KEY));
}

/** Test-only: drop the cached repository so each test starts clean. */
export function __resetAnchorRepositoryForTests(): void {
  repository = null;
}
