/** @jest-environment node */

const pgQuery = jest.fn().mockResolvedValue({ rows: [] });

jest.mock('@/lib/persistence/sql-client', () => ({
  getPgClient: jest.fn(() => ({ query: pgQuery })),
}));

import {
  createConsent,
  getConsent,
  listConsents,
  updateConsent,
  processConsentExpiry,
  __resetConsentForTests,
} from '@/lib/api/consent-service';
import { listNotifications, __resetNotificationsForTests } from '@/lib/api/notification-service';
import type { ConsentGrant } from '@/types';

const PATIENT = 'aeth1patient0000000000000000000000000000';
const NOW = 1_000_000_000_000;

function consent(): ConsentGrant {
  return {
    id: 'consent-1', patientAddress: PATIENT, providerAddress: 'aeth1provider',
    providerName: 'Dr. Rivera', scopes: ['cycle_data', 'lab_results'], status: 'active',
    grantedAt: 1, expiresAt: 2, txHash: '0x', attestation: 'att', policyId: 'policy-0',
    autoRenew: false,
  };
}

function mk(overrides: Partial<ConsentGrant>): ConsentGrant {
  return { ...consent(), ...overrides };
}

describe('consent-service', () => {
  const original = process.env.DATABASE_URL;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = original;
    }
    __resetConsentForTests();
    jest.clearAllMocks();
  });

  it('uses the in-memory store by default and supports CRUD', async () => {
    delete process.env.DATABASE_URL;
    __resetConsentForTests();

    await createConsent(PATIENT, consent());
    expect((await getConsent(PATIENT, 'consent-1'))?.providerName).toBe('Dr. Rivera');
    expect(await listConsents(PATIENT)).toHaveLength(1);
    expect((await updateConsent(PATIENT, 'consent-1', { status: 'revoked' }))?.status).toBe('revoked');
  });

  it('selects the Postgres store when DATABASE_URL is configured', async () => {
    process.env.DATABASE_URL = 'postgres://localhost/shiora';
    __resetConsentForTests();

    expect(await listConsents(PATIENT)).toEqual([]);
    expect(pgQuery).toHaveBeenCalled();
  });

  describe('processConsentExpiry', () => {
    beforeEach(() => {
      delete process.env.DATABASE_URL;
      __resetConsentForTests();
      __resetNotificationsForTests();
    });

    afterEach(() => __resetNotificationsForTests());

    it('is a no-op when there is nothing to reconcile (default now)', async () => {
      expect(await processConsentExpiry(PATIENT)).toEqual({ renewed: 0, expired: 0 });
    });

    it('expires an active consent past its expiry when auto-renew is off, and notifies', async () => {
      await createConsent(PATIENT, mk({ id: 'c1', grantedAt: NOW - 1000, expiresAt: NOW - 10 }));
      expect(await processConsentExpiry(PATIENT, NOW)).toEqual({ renewed: 0, expired: 1 });
      expect((await getConsent(PATIENT, 'c1'))?.status).toBe('expired');

      const inbox = await listNotifications(PATIENT);
      expect(inbox).toHaveLength(1);
      expect(inbox[0].title).toBe('A consent expired');
    });

    it('auto-renews a lapsed consent by rolling its term past now (multiple periods), and notifies', async () => {
      // term = 100; expired by 250 → rolls -150, -50, +50 → first boundary after now
      await createConsent(PATIENT, mk({
        id: 'c2', grantedAt: NOW - 350, expiresAt: NOW - 250, autoRenew: true,
      }));
      expect(await processConsentExpiry(PATIENT, NOW)).toEqual({ renewed: 1, expired: 0 });
      const c = await getConsent(PATIENT, 'c2');
      expect(c?.status).toBe('active');
      expect(c?.expiresAt).toBe(NOW + 50);

      const inbox = await listNotifications(PATIENT);
      expect(inbox).toHaveLength(1);
      expect(inbox[0].title).toBe('A consent was auto-renewed');
    });

    it('leaves a still-valid active consent untouched', async () => {
      await createConsent(PATIENT, mk({ id: 'c3', grantedAt: NOW - 100, expiresAt: NOW + 1000 }));
      expect(await processConsentExpiry(PATIENT, NOW)).toEqual({ renewed: 0, expired: 0 });
      expect((await getConsent(PATIENT, 'c3'))?.status).toBe('active');
    });

    it('ignores non-active consents', async () => {
      await createConsent(PATIENT, mk({
        id: 'c4', grantedAt: NOW - 100, expiresAt: NOW - 10, status: 'revoked',
      }));
      expect(await processConsentExpiry(PATIENT, NOW)).toEqual({ renewed: 0, expired: 0 });
      expect((await getConsent(PATIENT, 'c4'))?.status).toBe('revoked');
    });

    it('expires (cannot renew) an auto-renew consent with a non-positive term', async () => {
      await createConsent(PATIENT, mk({
        id: 'c5', grantedAt: NOW - 10, expiresAt: NOW - 10, autoRenew: true,
      }));
      expect(await processConsentExpiry(PATIENT, NOW)).toEqual({ renewed: 0, expired: 1 });
      expect((await getConsent(PATIENT, 'c5'))?.status).toBe('expired');
    });
  });
});
