// ---------------------------------------------------------------------------
// Audit Logger — structured logging for health-data access and mutations
// ---------------------------------------------------------------------------

export type AuditAction =
  | 'RECORD_READ'
  | 'RECORD_CREATE'
  | 'RECORD_UPDATE'
  | 'RECORD_DELETE'
  | 'GRANT_CREATE'
  | 'GRANT_REVOKE'
  | 'CONSENT_CREATE'
  | 'CONSENT_REVOKE'
  | 'SESSION_CREATE'
  | 'SESSION_DESTROY'
  | 'WALLET_CONNECT'
  | 'WALLET_DISCONNECT'
  | 'DATA_EXPORT'
  | 'DATA_ERASURE'
  | 'PROOF_GENERATE'
  | 'PROOF_VERIFY'
  | 'GOVERNANCE_VOTE'
  | 'MARKETPLACE_LIST'
  | 'MARKETPLACE_PURCHASE';

export interface AuditEntry {
  timestamp: string;
  action: AuditAction;
  actor: string; // wallet address or 'system'
  resource?: string; // resource type
  resourceId?: string; // resource identifier
  ip?: string;
  userAgent?: string;
  requestId?: string;
  success: boolean;
  metadata?: Record<string, unknown>;
}

// In-memory audit log with bounded size (rotated in production to external sink)
const MAX_ENTRIES = 10_000;
const auditLog: AuditEntry[] = [];

export function audit(entry: Omit<AuditEntry, 'timestamp'>): void {
  const full: AuditEntry = {
    ...entry,
    timestamp: new Date().toISOString(),
  };

  auditLog.push(full);

  // Rotate: keep the most recent entries
  if (auditLog.length > MAX_ENTRIES) {
    auditLog.splice(0, auditLog.length - MAX_ENTRIES);
  }

  // Structured log output (consumed by log aggregators in production)
  if (process.env.NODE_ENV !== 'test') {
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify({
        level: 'audit',
        ...full,
      }),
    );
  }
}

export function getAuditLog(
  filters?: {
    actor?: string;
    action?: AuditAction;
    resource?: string;
    since?: string;
    limit?: number;
  },
): AuditEntry[] {
  let entries = [...auditLog];

  if (filters?.actor) {
    entries = entries.filter((e) => e.actor === filters.actor);
  }
  if (filters?.action) {
    entries = entries.filter((e) => e.action === filters.action);
  }
  if (filters?.resource) {
    entries = entries.filter((e) => e.resource === filters.resource);
  }
  if (filters?.since) {
    const since = new Date(filters.since).getTime();
    entries = entries.filter((e) => new Date(e.timestamp).getTime() >= since);
  }

  // Most recent first
  entries.reverse();

  return entries.slice(0, filters?.limit ?? 100);
}
