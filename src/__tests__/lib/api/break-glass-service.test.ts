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
  EMERGENCY_CATEGORIES,
  SENSITIVE_RECORD_TAGS,
  applyMinimumNecessary,
  breakGlassPolicy,
  declareBreakGlass,
  readRecordsUnderBreakGlass,
  listBreakGlassUses,
  reviewBreakGlassUse,
  __resetBreakGlassForTests,
  type BreakGlassDeclaration,
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

const DECLARATION: BreakGlassDeclaration = {
  patient: PATIENT,
  category: 'clinical_emergency',
  reason: 'Patient presented unconscious in the emergency department',
  patientContext: 'ED encounter, City General Hospital',
  recordTypes: ['lab'],
};

const GOV_ENVS = ['SHIORA_JURISDICTION', 'SHIORA_BREAK_GLASS_POLICY_VERSION', 'SHIORA_BREAK_GLASS_AUTHORITY'] as const;
const savedEnv: Record<string, string | undefined> = {};

function record(id: string, owner: string, over: Partial<MockHealthRecord> = {}): MockHealthRecord {
  return {
    id, type: 'lab', label: `Result ${id}`, description: 'note', date: 1, uploadDate: 1,
    encrypted: false, encryption: 'none', cid: 'c', txHash: 't', attestation: 'a', size: 10,
    provider: 'p', status: 'Processing', ipfsNodes: 0, tags: [], deleted: false,
    ownerAddress: owner, blockHeight: 1, ...over,
  };
}

beforeEach(() => {
  for (const key of GOV_ENVS) { savedEnv[key] = process.env[key]; delete process.env[key]; }
});

afterEach(() => {
  for (const key of GOV_ENVS) {
    if (savedEnv[key] === undefined) delete process.env[key]; else process.env[key] = savedEnv[key];
  }
  __resetBreakGlassForTests();
  __resetRecordsForTests();
  __resetNotificationsForTests();
  __resetAuditLogForTests();
  delete process.env.DATABASE_URL;
  jest.clearAllMocks();
});

describe('break-glass governance policy', () => {
  it('exposes the two structured emergency categories', () => {
    expect(EMERGENCY_CATEGORIES).toEqual(['clinical_emergency', 'continuity_of_care']);
  });

  it('treats reproductive/sexual/mental-health/genetic tags as especially sensitive', () => {
    for (const tag of ['reproductive', 'sexual_health', 'mental-health', 'genomics']) {
      expect(SENSITIVE_RECORD_TAGS.has(tag)).toBe(true);
    }
    expect(SENSITIVE_RECORD_TAGS.has('lab')).toBe(false);
  });

  it('defaults the governance context and reads it from configuration', () => {
    expect(breakGlassPolicy()).toEqual({
      jurisdiction: 'unconfigured',
      policyVersion: 'break-glass/v1',
      authorizingOrganization: 'unconfigured',
    });
    process.env.SHIORA_JURISDICTION = 'AE-AZ';
    process.env.SHIORA_BREAK_GLASS_POLICY_VERSION = 'adhics-bg/v2';
    process.env.SHIORA_BREAK_GLASS_AUTHORITY = 'Partner Health System';
    expect(breakGlassPolicy()).toEqual({
      jurisdiction: 'AE-AZ',
      policyVersion: 'adhics-bg/v2',
      authorizingOrganization: 'Partner Health System',
    });
  });
});

describe('applyMinimumNecessary', () => {
  it('keeps only the declared record types', () => {
    const recs = [record('a', PATIENT, { type: 'lab' }), record('b', PATIENT, { type: 'imaging' })];
    const { records, sensitiveWithheld } = applyMinimumNecessary(recs, { recordTypes: ['lab'], sensitiveAcknowledged: false });
    expect(records.map((r) => r.id)).toEqual(['a']);
    expect(sensitiveWithheld).toBe(0);
  });

  it('withholds sensitive records (by type or tag) unless acknowledged', () => {
    const recs = [
      record('lab', PATIENT, { type: 'lab' }),
      record('repro', PATIENT, { type: 'reproductive' }),
      record('tagged', PATIENT, { type: 'lab', tags: ['Mental-Health'] }),
    ];
    const types = ['lab', 'reproductive'];
    const guarded = applyMinimumNecessary(recs, { recordTypes: types, sensitiveAcknowledged: false });
    expect(guarded.records.map((r) => r.id)).toEqual(['lab']);
    expect(guarded.sensitiveWithheld).toBe(2);

    const acknowledged = applyMinimumNecessary(recs, { recordTypes: types, sensitiveAcknowledged: true });
    expect(acknowledged.records.map((r) => r.id)).toEqual(['lab', 'repro', 'tagged']);
    expect(acknowledged.sensitiveWithheld).toBe(0);
  });

  it('tolerates a record with no tags', () => {
    const recs = [record('a', PATIENT, { type: 'lab', tags: undefined as unknown as string[] })];
    expect(applyMinimumNecessary(recs, { recordTypes: ['lab'], sensitiveAcknowledged: false }).records).toHaveLength(1);
  });
});

describe('break-glass-service — declaration', () => {
  it('mints a short-lived, minimum-necessary grant with governance context', async () => {
    const before = Date.now();
    const grant = await declareBreakGlass(PROVIDER, DECLARATION);

    expect(grant).not.toBeNull();
    expect(grant!.id).toMatch(/^bg-/);
    expect(grant!.requester).toBe(PROVIDER);
    expect(grant!.patient).toBe(PATIENT);
    expect(grant!.category).toBe('clinical_emergency');
    expect(grant!.recordTypes).toEqual(['lab']);
    expect(grant!.sensitiveAcknowledged).toBe(false);
    expect(grant!.scope).toBe(BREAK_GLASS_SCOPE);
    expect(grant!.jurisdiction).toBe('unconfigured');
    expect(grant!.policyVersion).toBe('break-glass/v1');
    expect(grant!.authorizingOrganization).toBe('unconfigured');
    expect(grant!.review).toBeNull();
    expect(grant!.expiresAt - grant!.createdAt).toBe(BREAK_GLASS_TTL_MS);
    expect(BREAK_GLASS_TTL_MS).toBeLessThanOrEqual(60 * 60 * 1000);
    expect(grant!.createdAt).toBeGreaterThanOrEqual(before);
  });

  it('records an explicit sensitive acknowledgement when given', async () => {
    const grant = await declareBreakGlass(PROVIDER, { ...DECLARATION, sensitiveAcknowledged: true });
    expect(grant!.sensitiveAcknowledged).toBe(true);
  });

  it('appends a prominent audit entry carrying both actor and subject', async () => {
    const grant = await declareBreakGlass(PROVIDER, DECLARATION);

    const entries = await getAuditLog().list({ action: 'BREAK_GLASS_ACCESS' });
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      actor: PROVIDER, subject: PATIENT, resource: 'break-glass', resourceId: grant!.id, success: true,
    });
    const patientView = await getAuditLog().list({ subject: PATIENT });
    expect(patientView.some((entry) => entry.action === 'BREAK_GLASS_ACCESS')).toBe(true);
  });

  it('notifies the patient WITHOUT any PHI (no reason, context, or actor id)', async () => {
    const grant = await declareBreakGlass(PROVIDER, DECLARATION);

    const inbox = await listNotifications(PATIENT, { unreadOnly: true });
    expect(inbox).toHaveLength(1);
    expect(inbox[0].type).toBe('emergency_access');
    // No PHI: the clinician's free-text and the patient context never appear.
    expect(inbox[0].body).not.toContain(DECLARATION.reason);
    expect(inbox[0].body).not.toContain(DECLARATION.patientContext);
    expect(inbox[0].body).not.toContain(PROVIDER);
    // But it does tell the patient what matters.
    expect(inbox[0].body).toContain('read-only');
    expect(inbox[0].body).toContain('minimum necessary');
    expect(inbox[0].body).toContain(new Date(grant!.expiresAt).toISOString());
  });

  it('refuses a self-targeted declaration', async () => {
    expect(await declareBreakGlass(PATIENT, DECLARATION)).toBeNull();
    expect(await listBreakGlassUses()).toEqual([]);
    expect(await listNotifications(PATIENT)).toEqual([]);
  });
});

describe('break-glass-service — restricted read', () => {
  it('returns only the declared record types and audits governance context', async () => {
    await createRecord(PATIENT, record('rec-1', PATIENT, { type: 'lab' }));
    await createRecord(PATIENT, record('rec-2', PATIENT, { type: 'imaging' }));
    const grant = await declareBreakGlass(PROVIDER, DECLARATION);

    const result = await readRecordsUnderBreakGlass(PROVIDER, grant!.id);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.records.map((r) => r.id)).toEqual(['rec-1']); // imaging excluded
      expect(result.sensitiveWithheld).toBe(0);
      expect(result.grant.id).toBe(grant!.id);
    }

    const reads = await getAuditLog().list({ action: 'BREAK_GLASS_RECORD_READ' });
    expect(reads[0]).toMatchObject({
      actor: PROVIDER, subject: PATIENT, resourceId: grant!.id, success: true,
      metadata: {
        grantId: grant!.id, recordCount: 1, recordTypes: ['lab'],
        sensitiveWithheld: 0, category: 'clinical_emergency', policyVersion: 'break-glass/v1',
      },
    });
  });

  it('withholds sensitive records and reports the count when not acknowledged', async () => {
    await createRecord(PATIENT, record('lab', PATIENT, { type: 'lab' }));
    await createRecord(PATIENT, record('repro', PATIENT, { type: 'reproductive' }));
    const grant = await declareBreakGlass(PROVIDER, { ...DECLARATION, recordTypes: ['lab', 'reproductive'] });

    const result = await readRecordsUnderBreakGlass(PROVIDER, grant!.id);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.records.map((r) => r.id)).toEqual(['lab']);
      expect(result.sensitiveWithheld).toBe(1);
    }
  });

  it('denies anyone who is not the declaring requester, and audits the denial with governance', async () => {
    const grant = await declareBreakGlass(PROVIDER, DECLARATION);

    const result = await readRecordsUnderBreakGlass(OTHER_PROVIDER, grant!.id);
    expect(result).toEqual({ ok: false, reason: 'forbidden' });

    const denied = await getAuditLog().list({ action: 'BREAK_GLASS_RECORD_READ' });
    expect(denied[0]).toMatchObject({
      actor: OTHER_PROVIDER, subject: PATIENT, success: false,
      metadata: { denied: 'forbidden', category: 'clinical_emergency' },
    });
  });

  it('denies reads once the grant has expired', async () => {
    const grant = await declareBreakGlass(PROVIDER, DECLARATION);
    expect(await readRecordsUnderBreakGlass(PROVIDER, grant!.id, grant!.expiresAt)).toEqual({
      ok: false, reason: 'expired',
    });
  });

  it('reports an unknown grant id', async () => {
    expect(await readRecordsUnderBreakGlass(PROVIDER, 'bg-missing')).toEqual({ ok: false, reason: 'not_found' });
  });
});

describe('break-glass-service — retrospective review queue', () => {
  it('lists every use, most recent first, with a derived status', async () => {
    const first = await declareBreakGlass(PROVIDER, DECLARATION);
    const second = await declareBreakGlass(OTHER_PROVIDER, {
      ...DECLARATION, reason: 'Collapsed in waiting room, no consent on file',
    });

    const uses = await listBreakGlassUses();
    expect(uses.map((use) => use.grant.id)).toEqual([second!.id, first!.id]);
    expect(uses.every((use) => use.status === 'active')).toBe(true);

    const afterEveryExpiry = Math.max(first!.expiresAt, second!.expiresAt) + 1;
    const later = await listBreakGlassUses({ now: afterEveryExpiry });
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

    const reviewed = await reviewBreakGlassUse(ADMIN, grant!.id, 'unjustified', 'No matching encounter found.');
    expect(typeof reviewed).not.toBe('string');
    if (typeof reviewed === 'object' && reviewed !== null) {
      expect(reviewed.review).toMatchObject({ reviewer: ADMIN, outcome: 'unjustified', notes: 'No matching encounter found.' });
      expect(reviewed.review!.reviewedAt).toBeLessThanOrEqual(Date.now());
    }

    const audits = await getAuditLog().list({ action: 'BREAK_GLASS_REVIEW' });
    expect(audits[0]).toMatchObject({ actor: ADMIN, subject: PATIENT });
    expect((await listBreakGlassUses())[0].status).toBe('reviewed');
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
    expect(await readRecordsUnderBreakGlass(PROVIDER, grant!.id)).toEqual({ ok: false, reason: 'closed' });
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
