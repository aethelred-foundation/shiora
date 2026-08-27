// ============================================================
// Shiora on Aethelred — Audit-log WORM export (GAP-28)
//
// The audit chain is verifiable in-place, but nothing let an operator ship a
// segment off-platform (e.g. to WORM object storage with Object Lock) in a
// form that stays independently verifiable. This produces a self-contained,
// signed bundle: a contiguous slice of the chain plus the chain head at export
// time and an HMAC signature. A later reader — even without database access —
// can confirm (1) the segment's internal hash linkage is intact and (2) the
// bundle was produced by this platform and not altered in transit or storage.
// ============================================================

import crypto from 'node:crypto';

import {
  computeEntryHash,
  type AuditEntry,
  type ChainedAuditEntry,
} from '@/lib/crypto/audit-chain';
import { auditExportKey } from '@/lib/crypto/derived-secrets';

export interface AuditExportBundle {
  fromSeq: number;
  toSeq: number;
  count: number;
  entries: ChainedAuditEntry[];
  /** The whole chain's head hash + length at export time. */
  chainHead: { hash: string; length: number };
  exportedAt: string;
  /** HMAC over the canonicalized bundle (base64url). */
  signature: string;
}

/** Deterministic serialization of the signed portion of a bundle. */
function signingPayload(
  entries: ChainedAuditEntry[],
  chainHead: { hash: string; length: number },
  exportedAt: string,
): string {
  return JSON.stringify({ entries, chainHead, exportedAt });
}

function sign(payload: string): string {
  return crypto.createHmac('sha256', auditExportKey()).update(payload).digest('base64url');
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

/** Build a signed WORM bundle from a contiguous chain segment. */
export function buildAuditExport(
  entries: ChainedAuditEntry[],
  chainHead: { hash: string; length: number },
  exportedAt: string = new Date().toISOString(),
): AuditExportBundle {
  const payload = signingPayload(entries, chainHead, exportedAt);
  return {
    fromSeq: entries.length > 0 ? entries[0].seq : 0,
    toSeq: entries.length > 0 ? entries[entries.length - 1].seq : -1,
    count: entries.length,
    entries,
    chainHead,
    exportedAt,
    signature: sign(payload),
  };
}

export interface ExportVerification {
  valid: boolean;
  reason?: string;
}

/**
 * Verify an exported bundle: the HMAC signature (authenticity) and the
 * segment's internal hash linkage (integrity). An empty segment is vacuously
 * valid once its signature checks out.
 */
export function verifyAuditExport(bundle: AuditExportBundle): ExportVerification {
  const payload = signingPayload(bundle.entries, bundle.chainHead, bundle.exportedAt);
  if (!safeEqual(bundle.signature, sign(payload))) {
    return { valid: false, reason: 'signature mismatch' };
  }

  for (let i = 0; i < bundle.entries.length; i++) {
    const entry = bundle.entries[i];
    if (i > 0 && entry.prevHash !== bundle.entries[i - 1].hash) {
      return { valid: false, reason: `broken linkage at seq ${entry.seq}` };
    }
    if (i > 0 && entry.seq !== bundle.entries[i - 1].seq + 1) {
      return { valid: false, reason: `non-contiguous sequence at index ${i}` };
    }
    const { seq: _seq, prevHash: _prev, hash, ...content } = entry;
    if (computeEntryHash(entry.prevHash, entry.seq, content as AuditEntry) !== hash) {
      return { valid: false, reason: `content hash mismatch at seq ${entry.seq}` };
    }
  }

  return { valid: true };
}
