// ============================================================
// Shiora on Aethelred — Tamper-Evident Audit Chain
//
// Provides an append-only, hash-linked audit log that satisfies the audit
// controls and integrity requirements of HIPAA Security Rule §164.312(b)
// (audit controls) and §164.312(c)(1) (integrity).
//
// Each entry carries an HMAC-SHA256 over (previous entry's hash ‖ seq ‖ this
// entry's canonical content), keyed by a dedicated audit key derived from the
// root secret (config/Vault — never the application database). Because every
// link commits to the entire history before it AND is authenticated under a
// key held outside the datastore, ANY retroactive edit, deletion, or
// reordering is detected by `verifyAuditChain`, and — critically — an actor
// with write access to the audit tables cannot forge or recompute a valid
// chain without also holding the audit key. This closes the "privileged
// insider rewrites history" gap of an unkeyed hash chain (audit M-02).
//
// It is described honestly as "tamper-evident," not "on-chain." Periodically
// anchoring the head to the Aethelred L1 (defence in depth against loss of the
// audit key itself) remains the planned next step — docs/COMPLIANCE.md C-AUD-3.
// ============================================================

import crypto from 'node:crypto';

import { auditChainKey } from '@/lib/crypto/derived-secrets';
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

/**
 * Compute the keyed link that binds `entry` (at `seq`) onto `prevHash`.
 * HMAC-SHA256 under the audit key means the linkage is not just tamper-evident
 * but tamper-*resistant to a party who can write the store but does not hold
 * the key — they cannot produce a matching MAC for altered content.
 */
export function computeEntryHash(
  prevHash: string,
  seq: number,
  entry: AuditEntry,
): string {
  return crypto
    .createHmac('sha256', auditChainKey())
    .update(`${prevHash}|${seq}|${canonicalize(entry)}`)
    .digest('hex');
}

/**
 * An in-memory tamper-evident audit chain. In production the appended entries
 * are mirrored to an append-only external sink (e.g. an object-lock/WORM
 * bucket) and the head hash is anchored on-chain; this class is the
 * authoritative in-process implementation of the linking + verification logic.
 */
export interface AuditRecorder {
  /**
   * Record an audit entry into a tamper-evident chain, returning its chained
   * form. Async so a persistent implementation can write to its backing store.
   */
  record(entry: Omit<AuditEntry, 'timestamp'> & { timestamp?: string }): Promise<ChainedAuditEntry>;
}

export class AuditChain implements AuditRecorder {
  private readonly entries: ChainedAuditEntry[] = [];

  /** Async {@link AuditRecorder} adapter over {@link AuditChain.append}. */
  async record(entry: Omit<AuditEntry, 'timestamp'> & { timestamp?: string }): Promise<ChainedAuditEntry> {
    return this.append(entry);
  }

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
