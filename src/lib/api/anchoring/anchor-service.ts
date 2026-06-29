// ============================================================
// Shiora on Aethelred — Anchor service (audit Finding F5)
//
// Periodically commits the tamper-evident audit head to an external anchor so a
// single operator can no longer rewrite history wholesale undetected. Each call:
//   1. reads the current audit-chain head (hash + length),
//   2. builds an AnchorRecord linked to the previous anchor (its own WORM chain),
//   3. broadcasts the anchor hash through the AnchorClient seam (L1 when
//      configured, else recorded locally), and
//   4. persists the record append-only (never updated/deleted -> WORM).
//
// Anchors are a single global series (the audit chain is platform-wide), stored
// under one global key, and independently verifiable via verifyAnchors().
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
import { getAnchorClient, type AnchorReceipt } from './anchor-client';

const COLLECTION = 'anchor';
/** Single global series: the audit chain anchored is platform-wide, not per-owner. */
const GLOBAL_KEY = '__global__';

/** What an anchor commits to. Versioned so the structure can evolve. */
export interface AnchorPayload {
  /** The audit-chain head hash being anchored. */
  auditHead: string;
  /** Number of entries the head covers. */
  auditLength: number;
  createdAt: number;
  version: 1;
}

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
  const preimage = [
    prevHash,
    seq,
    payload.auditHead,
    payload.auditLength,
    payload.createdAt,
    payload.version,
  ].join('|');
  return crypto.createHash('sha256').update(preimage).digest('hex');
}

/** Anchors sorted oldest-first by sequence. */
async function anchorsAsc(): Promise<AnchorRecord[]> {
  const all = await repo().list(GLOBAL_KEY);
  return all.sort((a, b) => a.seq - b.seq);
}

/** The most recent anchor, or null when none have been created. */
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
 * Create the next anchor over the current audit head and submit it through the
 * configured AnchorClient. `now` is injectable for deterministic tests.
 */
export async function createAnchor(now: number = Date.now()): Promise<AnchorRecord> {
  const head = await getAuditLog().head();
  const latest = await getLatestAnchor();

  const seq = latest ? latest.seq + 1 : 0;
  const prevHash = latest ? latest.hash : GENESIS_HASH;
  const payload: AnchorPayload = {
    auditHead: head.hash,
    auditLength: head.length,
    createdAt: now,
    version: 1,
  };
  const hash = anchorHash(prevHash, seq, payload);
  const receipt = await getAnchorClient().submit(hash);

  const record: AnchorRecord = { id: randomUUID(), seq, prevHash, hash, payload, receipt };
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
