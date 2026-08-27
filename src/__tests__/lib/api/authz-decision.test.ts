/** @jest-environment node */

import {
  authzContext,
  recordAuthorizationDecision,
} from '@/lib/api/authz-decision';
import { getAuditLog, __resetAuditLogForTests } from '@/lib/api/audit-log';
import { seededAddress } from '@/lib/utils';

const ACTOR = seededAddress(8801);
const SUBJECT = seededAddress(8802);
const CTX_ENVS = ['SHIORA_TENANT_ID', 'SHIORA_DATA_DOMAIN_ID', 'SHIORA_AUTHZ_POLICY_VERSION'] as const;
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of CTX_ENVS) { saved[key] = process.env[key]; delete process.env[key]; }
});
afterEach(() => {
  for (const key of CTX_ENVS) {
    if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key];
  }
  __resetAuditLogForTests();
});

describe('authzContext', () => {
  it('defaults the tenant/domain/policy and reads them from configuration', () => {
    expect(authzContext()).toEqual({
      tenantId: 'unconfigured', dataDomainId: 'unconfigured', policyVersion: 'authz/v1',
    });
    process.env.SHIORA_TENANT_ID = 'partner-1';
    process.env.SHIORA_DATA_DOMAIN_ID = 'domain-a';
    process.env.SHIORA_AUTHZ_POLICY_VERSION = 'authz/v3';
    expect(authzContext()).toEqual({
      tenantId: 'partner-1', dataDomainId: 'domain-a', policyVersion: 'authz/v3',
    });
  });
});

describe('recordAuthorizationDecision', () => {
  it('captures a full allow snapshot and writes it as a successful AUTHZ_DECISION', async () => {
    process.env.SHIORA_TENANT_ID = 'partner-1';
    process.env.SHIORA_DATA_DOMAIN_ID = 'domain-a';

    const snapshot = await recordAuthorizationDecision({
      actor: ACTOR,
      actorOrganizationId: 'org-9',
      subject: SUBJECT,
      resource: 'health_records',
      resourceId: SUBJECT,
      purposeOfUse: 'care_coordination',
      decision: 'allow',
      reason: 'active_grant',
      legalBasis: 'consent',
      grantId: 'grant-1',
      grantVersion: 2,
      consentVersion: 4,
      emergencyOverrideId: 'bg-1',
      decidedAt: 1_700_000_000_000,
    });

    expect(snapshot).toEqual({
      tenantId: 'partner-1', dataDomainId: 'domain-a', policyVersion: 'authz/v1',
      actor: ACTOR, actorOrganizationId: 'org-9', subject: SUBJECT,
      resource: 'health_records', resourceId: SUBJECT,
      purposeOfUse: 'care_coordination', legalBasis: 'consent', decision: 'allow',
      reason: 'active_grant', grantId: 'grant-1', grantVersion: 2, consentVersion: 4,
      emergencyOverrideId: 'bg-1', decidedAt: 1_700_000_000_000,
    });

    const entries = await getAuditLog().list({ action: 'AUTHZ_DECISION' });
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      actor: ACTOR, subject: SUBJECT, success: true, metadata: { decision: 'allow', tenantId: 'partner-1' },
    });
  });

  it('defaults optional fields and records a deny as an unsuccessful entry', async () => {
    const before = Date.now();
    const snapshot = await recordAuthorizationDecision({
      actor: ACTOR,
      subject: SUBJECT,
      resource: 'health_records',
      resourceId: SUBJECT,
      purposeOfUse: 'care_coordination',
      decision: 'deny',
      reason: 'no_active_grant',
    });

    expect(snapshot.actorOrganizationId).toBe('unconfigured');
    expect(snapshot.legalBasis).toBeNull();
    expect(snapshot.grantId).toBeNull();
    expect(snapshot.grantVersion).toBeNull();
    expect(snapshot.consentVersion).toBeNull();
    expect(snapshot.emergencyOverrideId).toBeNull();
    expect(snapshot.decidedAt).toBeGreaterThanOrEqual(before);

    const entries = await getAuditLog().list({ action: 'AUTHZ_DECISION' });
    expect(entries[0]).toMatchObject({ success: false, metadata: { decision: 'deny', reason: 'no_active_grant' } });
    // Surfaces in the patient's own access history.
    const patientView = await getAuditLog().list({ subject: SUBJECT });
    expect(patientView.some((e) => e.action === 'AUTHZ_DECISION')).toBe(true);
  });
});
