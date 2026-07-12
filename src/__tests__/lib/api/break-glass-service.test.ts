/** @jest-environment node */

// The Postgres branch of the store selector is exercised without a live DB by
// stubbing the SQL client (mirrors webauthn-service.test.ts).
const pgQuery = jest.fn().mockResolvedValue({ rows: [] });
jest.mock('@/lib/persistence/sql-client', () => ({
  getPgClient: jest.fn(() => ({ query: pgQuery })),
}));

import {
  BREAK_GLASS_TTL_MS,
  BREAK_GLASS_SCOPE,
  declareBreakGlass,
  readRecordsUnderBreakGlass,
  listBreakGlassUses,
  reviewBreakGlassUse,
  __resetBreakGlassForTests,
} from '@/lib/api/break-glass-service';
import { createRecord, __resetRecordsForTests } from '@/lib/api/records-service';
import { listNotifications, __resetNotificationsForTests } from '@/lib/api/notification-service';
import { getAuditLog, __resetAuditLogForTests } from '@/lib/api/audit-log';
import type { MockHealthRecord } from '@/lib/api/mock-data';
import { seededAddress } from '@/lib/utils';

const PROVIDER = seededAddress(7301);
const OTHER_PROVIDER = seededAddress(7302);
const PATIENT = seededAddress(7303);
const ADMIN = seededAddress(7304);

const DECLARATION = {
  patient: PATIENT,
  reason: 'Patient presented unconscious in the emergency department',
  patientContext: 'ED encounter, City General Hospital',
};

function record(id: string, owner: string): MockHealthRecord {
  return {
    id, type: 'lab', label: `Result ${id}`, description: 'note', date: 1, uploadDate: 1,
    encrypted: false, encryption: 'none', cid: 'c', txHash: 't', attestation: 'a', size: 10,
    provider: 'p', status: 'Processing', ipfsNodes: 0, tags: [], deleted: false,
    ownerAddress: owner, blockHeight: 1,
  };
}

afterEach(() => {
  __resetBreakGlassForTests();
  __resetRecordsForTests();
  __resetNotificationsForTests();
  __resetAuditLogForTests();
  delete process.env.DATABASE_URL;
  jest.clearAllMocks();
});

describe('break-glass-service — declaration', () => {
  it('mints a short-lived, read-only grant bound to requester and patient', async () => {
    const before = Date.now();
    const grant = await declareBreakGlass(PROVIDER, DECLARATION);

    expect(grant).not.toBeNull();
    expect(grant!.id).toMatch(/^bg-/);
    expect(grant!.requester).toBe(PROVIDER);
    expect(grant!.patient).toBe(PATIENT);
    expect(grant!.reason).toBe(DECLARATION.reason);
    expect(grant!.patientContext).toBe(DECLARATION.patientContext);
    expect(grant!.scope).toBe(BREAK_GLASS_SCOPE);
    expect(grant!.review).toBeNull();
    // Deliberately short: at most one hour.
    expect(grant!.expiresAt - grant!.createdAt).toBe(BREAK_GLASS_TTL_MS);
    expect(BREAK_GLASS_TTL_MS).toBeLessThanOrEqual(60 * 60 * 1000);
    expect(grant!.createdAt).toBeGreaterThanOrEqual(before);
  });

  it('appends a prominent audit entry carrying both actor and subject', async () => {
    const grant = await declareBreakGlass(PROVIDER, DECLARATION);

    const entries = await getAuditLog().list({ action: 'BREAK_GLASS_ACCESS' });
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      actor: PROVIDER,
      subject: PATIENT,
      resource: 'break-glass',
      resourceId: grant!.id,
      success: true,
    });

    // Visible in the patient's own access history (subject dimension).
    const patientView = await getAuditLog().list({ subject: PATIENT });
    expect(patientView.some((entry) => entry.action === 'BREAK_GLASS_ACCESS')).toBe(true);
  });

  it('notifies the patient with the declared reason', async () => {
    await declareBreakGlass(PROVIDER, DECLARATION);

    const inbox = await listNotifications(PATIENT, { unreadOnly: true });
    expect(inbox).toHaveLength(1);
    expect(inbox[0].type).toBe('emergency_access');
    expect(inbox[0].body).toContain(DECLARATION.reason);
    expect(inbox[0].body).toContain(PROVIDER);
  });

  it('refuses a self-targeted declaration', async () => {
    expect(await declareBreakGlass(PATIENT, DECLARATION)).toBeNull();
    expect(await listBreakGlassUses()).toEqual([]);
    expect(await listNotifications(PATIENT)).toEqual([]);
  });
});

describe('break-glass-service — restricted read', () => {
  it('lets the requester read the patient records while the grant is active, and audits each read', async () => {
    await createRecord(PATIENT, record('rec-1', PATIENT));
    const grant = await declareBreakGlass(PROVIDER, DECLARATION);

    const result = await readRecordsUnderBreakGlass(PROVIDER, grant!.id);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.records).toHaveLength(1);
      expect(result.records[0].id).toBe('rec-1');
      expect(result.grant.id).toBe(grant!.id);
    }

    const reads = await getAuditLog().list({ action: 'BREAK_GLASS_RECORD_READ' });
    expect(reads).toHaveLength(1);
    expect(reads[0]).toMatchObject({
      actor: PROVIDER,
      subject: PATIENT,
      resourceId: grant!.id,
      success: true,
      metadata: { grantId: grant!.id, recordCount: 1 },
    });
  });

  it('denies anyone who is not the declaring requester, and audits the denial', async () => {
    const grant = await declareBreakGlass(PROVIDER, DECLARATION);

    const result = await readRecordsUnderBreakGlass(OTHER_PROVIDER, grant!.id);
    expect(result).toEqual({ ok: false, reason: 'forbidden' });

    const denied = await getAuditLog().list({ action: 'BREAK_GLASS_RECORD_READ' });
    expect(denied).toHaveLength(1);
    expect(denied[0]).toMatchObject({ actor: OTHER_PROVIDER, subject: PATIENT, success: false });
  });

  it('denies reads once the grant has expired', async () => {
    const grant = await declareBreakGlass(PROVIDER, DECLARATION);

    const atExpiry = grant!.expiresAt;
    expect(await readRecordsUnderBreakGlass(PROVIDER, grant!.id, atExpiry)).toEqual({
      ok: false,
      reason: 'expired',
    });
  });

  it('reports an unknown grant id', async () => {
    expect(await readRecordsUnderBreakGlass(PROVIDER, 'bg-missing')).toEqual({
      ok: false,
      reason: 'not_found',
    });
  });
});

describe('break-glass-service — retrospective review queue', () => {
  it('lists every use, most recent first, with a derived status', async () => {
    const first = await declareBreakGlass(PROVIDER, DECLARATION);
    const second = await declareBreakGlass(OTHER_PROVIDER, {
      ...DECLARATION,
      reason: 'Collapsed in waiting room, no consent on file',
    });

    const uses = await listBreakGlassUses();
    expect(uses.map((use) => use.grant.id)).toEqual([second!.id, first!.id]);
    expect(uses.every((use) => use.status === 'active')).toBe(true);

    // After expiry the derived status changes; nothing is mutated.
    const later = await listBreakGlassUses({ now: first!.expiresAt + 1 });
    expect(later.every((use) => use.status === 'expired')).toBe(true);
  });

  it('filters to pending (unreviewed) uses', async () => {
    const first = await declareBreakGlass(PROVIDER, DECLARATION);
    const second = await declareBreakGlass(OTHER_PROVIDER, DECLARATION);
    await reviewBreakGlassUse(ADMIN, first!.id, 'justified', 'Confirmed with the ED attending.');

    const pending = await listBreakGlassUses({ pendingOnly: true });
    expect(pending.map((use) => use.grant.id)).toEqual([second!.id]);
  });

  it('records the review verdict, reviewer, and notes, and audits it', async () => {
    const grant = await declareBreakGlass(PROVIDER, DECLARATION);

    const reviewed = await reviewBreakGlassUse(
      ADMIN, grant!.id, 'unjustified', 'No matching encounter found.',
    );
    expect(reviewed).not.toBeNull();
    expect(typeof reviewed).not.toBe('string');
    if (typeof reviewed === 'object' && reviewed !== null) {
      expect(reviewed.review).toMatchObject({
        reviewer: ADMIN,
        outcome: 'unjustified',
        notes: 'No matching encounter found.',
      });
      expect(reviewed.review!.reviewedAt).toBeLessThanOrEqual(Date.now());
    }

    const audits = await getAuditLog().list({ action: 'BREAK_GLASS_REVIEW' });
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({ actor: ADMIN, subject: PATIENT });

    const uses = await listBreakGlassUses();
    expect(uses[0].status).toBe('reviewed');
  });

  it('rejects a second review of the same use', async () => {
    const grant = await declareBreakGlass(PROVIDER, DECLARATION);
    await reviewBreakGlassUse(ADMIN, grant!.id, 'justified', '');
    expect(await reviewBreakGlassUse(ADMIN, grant!.id, 'justified', '')).toBe('already_reviewed');
  });

  it('reports an unknown grant id', async () => {
    expect(await reviewBreakGlassUse(ADMIN, 'bg-missing', 'justified', '')).toBe('not_found');
  });

  it('a reviewed grant no longer authorizes reads even before expiry', async () => {
    await createRecord(PATIENT, record('rec-1', PATIENT));
    const grant = await declareBreakGlass(PROVIDER, DECLARATION);
    await reviewBreakGlassUse(ADMIN, grant!.id, 'unjustified', 'Closed.');

    expect(await readRecordsUnderBreakGlass(PROVIDER, grant!.id)).toEqual({
      ok: false,
      reason: 'closed',
    });
  });
});

describe('break-glass-service — storage', () => {
  it('selects the Postgres-backed store when DATABASE_URL is configured', async () => {
    process.env.DATABASE_URL = 'postgres://localhost/shiora';
    __resetBreakGlassForTests();
    await listBreakGlassUses();
    expect(pgQuery).toHaveBeenCalled();
  });
});
