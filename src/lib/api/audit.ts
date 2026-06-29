// ---------------------------------------------------------------------------
// Audit Logger — structured logging for health-data access and mutations
// ---------------------------------------------------------------------------

export type AuditAction =
  | 'RECORD_READ'
  | 'RECORD_CREATE'
  | 'RECORD_UPDATE'
  | 'RECORD_DELETE'
  | 'GRANT_CREATE'
  | 'GRANT_UPDATE'
  | 'GRANT_REVOKE'
  | 'CONSENT_CREATE'
  | 'CONSENT_UPDATE'
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
  | 'MARKETPLACE_UPDATE'
  | 'MARKETPLACE_PURCHASE'
  | 'ROLE_ASSIGN'
  | 'ROLE_REVOKE'
  | 'MFA_ENROLL'
  | 'MFA_ENABLE'
  | 'MFA_DISABLE'
  | 'ORG_CREATE'
  | 'ORG_UPDATE'
  | 'ORG_MEMBER_ADD'
  | 'ORG_MEMBER_REMOVE'
  | 'VAULT_SYMPTOM_LOG'
  | 'VAULT_SYMPTOM_UPDATE'
  | 'VAULT_CYCLE_LOG'
  | 'VAULT_CYCLE_UPDATE'
  | 'CLINICAL_NOTE_CREATE'
  | 'CLINICAL_NOTE_UPDATE'
  | 'DATA_REQUEST_CREATE'
  | 'DATA_REQUEST_DECIDE'
  | 'WELLNESS_PROGRAM_CREATE'
  | 'WELLNESS_PROGRAM_UPDATE'
  | 'WELLNESS_ENROLL'
  | 'WELLNESS_UNENROLL'
  | 'CARE_GAP_CREATE'
  | 'CARE_GAP_UPDATE'
  | 'NOTIFICATION_CREATE'
  | 'NOTIFICATION_UPDATE'
  | 'NOTIFICATION_PREFS_UPDATE'
  | 'PROFILE_UPDATE'
  | 'ANCHOR_CREATE'
  | 'WEARABLE_INGEST'
  | 'SANA_MESSAGE'
  | 'IPFS_STORE'
  | 'MPC_COMPUTE';

export interface AuditEntry {
  timestamp: string;
  action: AuditAction;
  actor: string; // who performed the action (wallet address or 'system')
  subject?: string; // whose data the action concerns (the data subject)
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
