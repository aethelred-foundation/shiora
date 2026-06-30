// ============================================================
// Shiora on Aethelred — Access Audit Log API
// GET /api/access/audit — the caller's real, tamper-evident access trail
//
// Subject-scoped to the authenticated owner: every entry the audit chain holds
// where this account is the data subject (provider record reads, grant/consent
// lifecycle, etc.). Mapped to the access-page shape from the REAL chain — no
// fabricated blockchain tx hashes.
// ============================================================

import { NextRequest } from 'next/server';
import { ZodError } from 'zod';
import { AuditListQuerySchema, parseSearchParams } from '@/lib/api/validation';
import { paginatedResponse, validationError } from '@/lib/api/responses';
import { runMiddleware, requireAuth } from '@/lib/api/middleware';
import { getAuditLog } from '@/lib/api/audit-log';
import type { ChainedAuditEntry } from '@/lib/crypto/audit-chain';
import type { AuditAction } from '@/lib/api/audit';
import type { AuditEntry, AuditActionType } from '@/types';

// Map the chain's canonical action to the access page's human label + category.
// Unmapped actions fall back to a humanised label under the 'access' bucket.
const ACTION_META: Partial<Record<AuditAction, { label: string; type: AuditActionType }>> = {
  GRANT_CREATE: { label: 'Access granted', type: 'grant' },
  GRANT_UPDATE: { label: 'Access modified', type: 'modify' },
  GRANT_REVOKE: { label: 'Access revoked', type: 'revoke' },
  CONSENT_CREATE: { label: 'Consent granted', type: 'grant' },
  CONSENT_UPDATE: { label: 'Consent updated', type: 'modify' },
  CONSENT_REVOKE: { label: 'Consent revoked', type: 'revoke' },
  RECORD_READ: { label: 'Record accessed', type: 'access' },
  RECORD_CREATE: { label: 'Record added', type: 'access' },
  RECORD_UPDATE: { label: 'Record updated', type: 'modify' },
  RECORD_DELETE: { label: 'Record removed', type: 'modify' },
  CLINICAL_NOTE_CREATE: { label: 'Clinical note added', type: 'access' },
  CLINICAL_NOTE_UPDATE: { label: 'Clinical note amended', type: 'modify' },
  DATA_EXPORT: { label: 'Data exported', type: 'download' },
};

function toAuditEntry(entry: ChainedAuditEntry): AuditEntry {
  const meta = ACTION_META[entry.action] ?? {
    label: entry.action.replace(/_/g, ' ').toLowerCase(),
    type: 'access' as AuditActionType,
  };
  const resource = entry.resource ?? '';
  return {
    id: `audit-${entry.seq}`,
    provider: entry.actor,
    action: meta.label,
    timestamp: new Date(entry.timestamp).getTime(),
    details: entry.resourceId ? `${resource} · ${entry.resourceId}` : resource,
    txHash: '',
    type: meta.type,
  };
}

const AUDIT_TYPES: AuditActionType[] = ['access', 'grant', 'revoke', 'modify', 'download'];

// ────────────────────────────────────────────────────────────
// GET /api/access/audit
// ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const blocked = await runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const auth = requireAuth(request);
  if ('status' in auth) return auth;

  try {
    const query = parseSearchParams(
      AuditListQuerySchema,
      request.nextUrl.searchParams,
    );

    const chainEntries = await getAuditLog().list({
      subject: auth.walletAddress!, // self-scoped — never user-supplied
      limit: 1000,
    });
    let entries = chainEntries.map(toAuditEntry);

    // Filter by type
    if (query.type) {
      entries = entries.filter((e) => e.type === query.type);
    }

    // Filter by date range
    if (query.startDate) {
      const start = new Date(query.startDate).getTime();
      entries = entries.filter((e) => e.timestamp >= start);
    }
    if (query.endDate) {
      const end = new Date(query.endDate).getTime() + 86400000; // include the end day
      entries = entries.filter((e) => e.timestamp <= end);
    }

    // Already most-recent-first from the chain query; keep that order.
    const total = entries.length;
    const start = (query.page - 1) * query.limit;
    const paged = entries.slice(start, start + query.limit);

    const allMapped = chainEntries.map(toAuditEntry);
    const typeCounts = Object.fromEntries(
      AUDIT_TYPES.map((t) => [t, allMapped.filter((e) => e.type === t).length]),
    );

    return paginatedResponse(paged, total, query.page, query.limit, { typeCounts });
  } catch (err) {
    if (err instanceof ZodError) return validationError(err);
    throw err;
  }
}
