// ============================================================
// Shiora on Aethelred — Tamper-Evident Audit Chain
//
// Provides an append-only, hash-linked audit log that satisfies the audit
// controls and integrity requirements of HIPAA Security Rule §164.312(b)
// (audit controls) and §164.312(c)(1) (integrity).
//
// Each entry carries the SHA-256 hash of (previous entry's hash ‖ this
// entry's canonical content). Because every link commits to the entire
// history before it, ANY retroactive edit, deletion, or reordering changes
// the recomputed hash and is detected by `verifyAuditChain`. This is the same
// cryptographic primitive a blockchain uses for integrity — a hash chain —
// without the distributed-consensus layer. It is therefore described honestly
// as "tamper-evident," not "on-chain." Anchoring the chain head periodically
// to the Aethelred L1 (so a single operator cannot rewrite history wholesale)
// is the planned next step — see docs/COMPLIANCE.md → control C-AUD-3.
// ============================================================

import crypto from 'node:crypto';

import type { AuditAction, AuditEntry } from '@/lib/api/audit';

/** The all-zero hash that seeds the genesis link of a fresh chain. */
export const GENESIS_HASH = '0'.repeat(64);

/** An {@link AuditEntry} extended with its position and hash linkage. */
export interface ChainedAuditEntry extends AuditEntry {
  /** Monotonic sequence number, starting at 0 for the genesis entry. */
  seq: number;
  /** Hash of the entry immediately before this one (GENESIS_HASH for seq 0). */
  prevHash: string;
  /** SHA-256 over `prevHash` ‖ canonical(content). */
  hash: string;
}

/** The result of verifying a chain's integrity. */
export interface ChainVerification {
  valid: boolean;
  /** Number of entries checked. */
  length: number;
  /** Sequence number of the first broken link, when `valid` is false. */
  brokenAt?: number;
  /** Human-readable reason for the break, when `valid` is false. */
  reason?: string;
}

/**
 * Deterministically serialize an entry's content with sorted keys so the hash
 * is stable regardless of property insertion order. The linkage fields
 * (`seq`, `prevHash`, `hash`) are excluded — `seq` and `prevHash` are folded
 * into the hash preimage separately, and `hash` is the output itself.
 */
function canonicalize(entry: AuditEntry): string {
  return stableStringify(entry as unknown as Record<string, unknown>);
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value) ?? 'null';
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  const body = keys
    .map((key) => `${JSON.stringify(key)}:${stableStringify(obj[key])}`)
    .join(',');
  return `{${body}}`;
}

/** Compute the hash that links `entry` (at `seq`) onto `prevHash`. */
export function computeEntryHash(
  prevHash: string,
  seq: number,
  entry: AuditEntry,
): string {
  return crypto
    .createHash('sha256')
    .update(`${prevHash}|${seq}|${canonicalize(entry)}`)
    .digest('hex');
}

/**
 * An in-memory tamper-evident audit chain. In production the appended entries
 * are mirrored to an append-only external sink (e.g. an object-lock/WORM
 * bucket) and the head hash is anchored on-chain; this class is the
 * authoritative in-process implementation of the linking + verification logic.
 */
export class AuditChain {
  private readonly entries: ChainedAuditEntry[] = [];

  /** Append a new audit entry and return its chained form. */
  append(entry: Omit<AuditEntry, 'timestamp'> & { timestamp?: string }): ChainedAuditEntry {
    const base: AuditEntry = {
      ...entry,
      timestamp: entry.timestamp ?? new Date().toISOString(),
    };

    const seq = this.entries.length;
    const prevHash = seq === 0 ? GENESIS_HASH : this.entries[seq - 1].hash;
    const hash = computeEntryHash(prevHash, seq, base);

    const chained: ChainedAuditEntry = { ...base, seq, prevHash, hash };
    this.entries.push(chained);
    return chained;
  }

  /** The hash at the head of the chain (GENESIS_HASH when empty). */
  head(): string {
    return this.entries.length === 0
      ? GENESIS_HASH
      : this.entries[this.entries.length - 1].hash;
  }

  /** Number of entries in the chain. */
  get length(): number {
    return this.entries.length;
  }

  /** A defensive copy of the chain. */
  snapshot(): ChainedAuditEntry[] {
    return this.entries.map((entry) => ({ ...entry }));
  }

  /** Verify this chain's own entries. */
  verify(): ChainVerification {
    return verifyAuditChain(this.entries);
  }
}

/**
 * Recompute every link and confirm the chain has not been tampered with.
 * Detects edited content, deleted/inserted entries, reordering, and broken
 * `prevHash` linkage.
 */
export function verifyAuditChain(entries: ChainedAuditEntry[]): ChainVerification {
  let prevHash = GENESIS_HASH;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];

    if (entry.seq !== i) {
      return { valid: false, length: entries.length, brokenAt: i, reason: 'sequence mismatch' };
    }
    if (entry.prevHash !== prevHash) {
      return { valid: false, length: entries.length, brokenAt: i, reason: 'broken linkage' };
    }

    const { seq: _seq, prevHash: _prev, hash, ...content } = entry;
    const expected = computeEntryHash(prevHash, entry.seq, content as AuditEntry);
    if (hash !== expected) {
      return { valid: false, length: entries.length, brokenAt: i, reason: 'content hash mismatch' };
    }

    prevHash = entry.hash;
  }

  return { valid: true, length: entries.length };
}

export type { AuditAction, AuditEntry };
