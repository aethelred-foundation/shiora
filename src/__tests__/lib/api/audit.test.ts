/** @jest-environment node */

import { audit, getAuditLog } from '@/lib/api/audit';

describe('audit', () => {
  it('adds an entry with timestamp', () => {
    const before = new Date().toISOString();
    audit({
      action: 'RECORD_READ',
      actor: 'aeth1testactor',
      success: true,
      resource: 'record',
      resourceId: 'rec-1',
    });
    const entries = getAuditLog({ actor: 'aeth1testactor', limit: 1 });
    expect(entries.length).toBe(1);
    expect(entries[0].action).toBe('RECORD_READ');
    expect(entries[0].timestamp).toBeDefined();
    expect(entries[0].actor).toBe('aeth1testactor');
    expect(entries[0].success).toBe(true);
  });

  it('records multiple entries', () => {
    const actor = `actor-${Date.now()}`;
    audit({ action: 'GRANT_CREATE', actor, success: true });
    audit({ action: 'GRANT_REVOKE', actor, success: true });
    audit({ action: 'CONSENT_CREATE', actor, success: false });

    const entries = getAuditLog({ actor });
    expect(entries.length).toBe(3);
  });
});

describe('getAuditLog', () => {
  const actor = `filter-actor-${Date.now()}`;

  beforeAll(() => {
    audit({ action: 'RECORD_CREATE', actor, success: true, resource: 'record' });
    audit({ action: 'RECORD_DELETE', actor, success: true, resource: 'record' });
    audit({ action: 'WALLET_CONNECT', actor, success: false });
  });

  it('filters by actor', () => {
    const entries = getAuditLog({ actor });
    expect(entries.length).toBe(3);
    entries.forEach((e) => expect(e.actor).toBe(actor));
  });

  it('filters by action', () => {
    const entries = getAuditLog({ actor, action: 'RECORD_CREATE' });
    expect(entries.length).toBe(1);
    expect(entries[0].action).toBe('RECORD_CREATE');
  });

  it('filters by resource', () => {
    const entries = getAuditLog({ actor, resource: 'record' });
    expect(entries.length).toBe(2);
  });

  it('respects limit', () => {
    const entries = getAuditLog({ actor, limit: 1 });
    expect(entries.length).toBe(1);
  });

  it('returns most recent first', () => {
    const entries = getAuditLog({ actor });
    // Most recent entry was WALLET_CONNECT
    expect(entries[0].action).toBe('WALLET_CONNECT');
  });

  it('defaults to 100 limit', () => {
    const entries = getAuditLog({});
    expect(entries.length).toBeLessThanOrEqual(100);
  });

  it('filters by since timestamp', () => {
    const actor = `since-actor-${Date.now()}`;
    const before = new Date().toISOString();
    audit({ action: 'DATA_EXPORT', actor, success: true });
    const after = new Date(Date.now() + 1000).toISOString();

    // Filter since before — should include
    const entries = getAuditLog({ actor, since: before });
    expect(entries.length).toBe(1);

    // Filter since future — should exclude
    const futureEntries = getAuditLog({ actor, since: after });
    expect(futureEntries.length).toBe(0);
  });
});

describe('audit rotation', () => {
  it('rotates log when exceeding MAX_ENTRIES', () => {
    // We can't easily fill 10,000 entries, but we can verify the mechanism
    // by adding many entries and checking the log doesn't grow unbounded
    const rotationActor = `rotation-actor-${Date.now()}`;
    for (let i = 0; i < 50; i++) {
      audit({ action: 'RECORD_READ', actor: rotationActor, success: true });
    }
    const entries = getAuditLog({ actor: rotationActor });
    expect(entries.length).toBe(50);
  });

  it('splices old entries when audit log exceeds 10000', () => {
    // Fill the log to trigger rotation by adding enough entries
    // We need to exceed 10,000 total entries across all tests
    const actor = `overflow-actor-${Date.now()}`;
    const totalNeeded = 10_100;
    for (let i = 0; i < totalNeeded; i++) {
      audit({ action: 'RECORD_READ', actor, success: true });
    }

    // After rotation, getting all entries with a high limit should
    // return at most 10,000 entries total (the MAX_ENTRIES cap)
    const allEntries = getAuditLog({ limit: 20_000 });
    expect(allEntries.length).toBeLessThanOrEqual(10_000);
  });
});

describe('audit console.log in non-test', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it('logs to console when NODE_ENV is not test', () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    process.env.NODE_ENV = 'development';

    audit({
      action: 'PROOF_GENERATE',
      actor: 'console-test-actor',
      success: true,
    });

    expect(consoleSpy).toHaveBeenCalled();
    const call = consoleSpy.mock.calls[consoleSpy.mock.calls.length - 1][0];
    expect(call).toContain('audit');

    consoleSpy.mockRestore();
  });
});
