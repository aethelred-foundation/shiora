// ============================================================
// Shiora on Aethelred — Salted segment commitments (outbox anchoring)
//
// What actually lands on-chain for an audit segment is a single opaque value:
//
//   commitment = SHA-256(salt || merkleRoot)
//
// where merkleRoot is built over the segment's entry hashes and the 32-byte
// salt lives only off-chain (on the anchor_outbox row). An on-chain observer
// therefore learns nothing — no subject addresses, no guessable scope hashes,
// not even whether two anchors cover related activity — while an auditor who
// is handed the signed export bundle plus the salt can prove the segment is
// exactly what was anchored (verifySegmentCommitment).
//
// The Merkle tree uses RFC 6962-style domain separation (0x00 leaf prefix,
// 0x01 node prefix; unpaired nodes promote unchanged) so a set of interior
// nodes can never be replayed as leaves.
// ============================================================

import crypto from 'node:crypto';

import { verifyAuditExport, type AuditExportBundle } from '@/lib/api/audit-export';

const LEAF_PREFIX = Buffer.from([0x00]);
const NODE_PREFIX = Buffer.from([0x01]);
const HASH_HEX = /^[0-9a-f]{64}$/;
const MIN_SALT_BYTES = 16;

function sha256(data: Buffer): Buffer {
  return crypto.createHash('sha256').update(data).digest();
}

function hashBytes(hex: string, what: string): Buffer {
  if (!HASH_HEX.test(hex)) {
    throw new Error(`${what} must be a 32-byte hex hash.`);
  }
  return Buffer.from(hex, 'hex');
}

/**
 * Merkle root (hex) over the given entry hashes, in order. The leaves are the
 * audit entries' chain hashes, so the root commits to both content and order.
 */
export function merkleRootOfHashes(leafHashesHex: string[]): string {
  if (leafHashesHex.length === 0) {
    throw new Error('Cannot build a Merkle root over an empty segment.');
  }
  let level = leafHashesHex.map((hex) => sha256(Buffer.concat([LEAF_PREFIX, hashBytes(hex, 'Merkle leaf')])));
  while (level.length > 1) {
    const next: Buffer[] = [];
    for (let i = 0; i < level.length; i += 2) {
      next.push(
        i + 1 < level.length
          ? sha256(Buffer.concat([NODE_PREFIX, level[i], level[i + 1]]))
          : level[i],
      );
    }
    level = next;
  }
  return level[0].toString('hex');
}

/** Mint a fresh 32-byte salt (hex). Stored off-chain on the outbox row only. */
export function newAnchorSalt(): string {
  return crypto.randomBytes(32).toString('hex');
}

/** The on-chain value: SHA-256 over the raw salt bytes followed by the raw root bytes. */
export function saltedCommitment(saltHex: string, merkleRootHex: string): string {
  if (!/^([0-9a-f]{2})+$/.test(saltHex)) {
    throw new Error('Salt must be hex-encoded bytes.');
  }
  const salt = Buffer.from(saltHex, 'hex');
  if (salt.length < MIN_SALT_BYTES) {
    throw new Error(`Salt must be at least ${MIN_SALT_BYTES} bytes.`);
  }
  return sha256(Buffer.concat([salt, hashBytes(merkleRootHex, 'Merkle root')])).toString('hex');
}

export interface SegmentCommitmentVerification {
  valid: boolean;
  reason?: string;
  /** The recomputed Merkle root, once the bundle itself verifies. */
  merkleRoot?: string;
}

/**
 * Auditor helper: prove that an off-chain export bundle is the segment behind
 * an on-chain commitment. Checks, in order: the bundle's HMAC signature and
 * internal hash linkage (audit-export), that the segment is non-empty, and
 * that SHA-256(salt || recomputed root) equals the on-chain commitment.
 */
export function verifySegmentCommitment(
  bundle: AuditExportBundle,
  saltHex: string,
  commitmentHex: string,
): SegmentCommitmentVerification {
  const exportCheck = verifyAuditExport(bundle);
  if (!exportCheck.valid) {
    return { valid: false, reason: exportCheck.reason };
  }
  if (bundle.entries.length === 0) {
    return { valid: false, reason: 'empty segment' };
  }
  let merkleRoot: string;
  let expected: string;
  try {
    merkleRoot = merkleRootOfHashes(bundle.entries.map((entry) => entry.hash));
    expected = saltedCommitment(saltHex, merkleRoot);
  } catch (err) {
    return { valid: false, reason: (err as Error).message };
  }
  const left = Buffer.from(expected);
  const right = Buffer.from(commitmentHex);
  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) {
    return { valid: false, reason: 'commitment mismatch', merkleRoot };
  }
  return { valid: true, merkleRoot };
}
