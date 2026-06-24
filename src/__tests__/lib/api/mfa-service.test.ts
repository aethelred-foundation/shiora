/** @jest-environment node */

const pgQuery = jest.fn().mockResolvedValue({ rows: [] });

jest.mock('@/lib/persistence/sql-client', () => ({
  getPgClient: jest.fn(() => ({ query: pgQuery })),
}));

import {
  beginMfaEnrollment,
  confirmMfaEnrollment,
  disableMfa,
  getMfaStatus,
  verifyMfaCode,
  __resetMfaForTests,
} from '@/lib/api/mfa-service';
import { totpCode } from '@/lib/api/totp';
import { seededAddress } from '@/lib/utils';

const ADDR = seededAddress(900);
const OTHER = seededAddress(901);

describe('mfa-service', () => {
  const original = process.env.DATABASE_URL;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = original;
    }
    __resetMfaForTests();
    jest.clearAllMocks();
  });

  it('reports not-enrolled by default', async () => {
    delete process.env.DATABASE_URL;
    __resetMfaForTests();
    expect(await getMfaStatus(ADDR)).toEqual({ enrolled: false, enabled: false });
  });

  it('enrols, confirms, verifies, and disables across the full lifecycle', async () => {
    delete process.env.DATABASE_URL;
    __resetMfaForTests();

    const { secret, otpauthUri } = await beginMfaEnrollment(ADDR);
    expect(otpauthUri).toContain('otpauth://');
    expect(await getMfaStatus(ADDR)).toEqual({ enrolled: true, enabled: false });

    // Not yet confirmed: verification of a code fails until enabled.
    expect(await verifyMfaCode(ADDR, totpCode(secret))).toBe(false);

    // Wrong code does not confirm.
    expect(await confirmMfaEnrollment(ADDR, '000000')).toBe(false);
    // Confirming with no enrolment (different address) fails.
    expect(await confirmMfaEnrollment(OTHER, totpCode(secret))).toBe(false);

    // Correct code enables MFA.
    expect(await confirmMfaEnrollment(ADDR, totpCode(secret))).toBe(true);
    expect(await getMfaStatus(ADDR)).toEqual({ enrolled: true, enabled: true });
    expect(await verifyMfaCode(ADDR, totpCode(secret))).toBe(true);
    expect(await verifyMfaCode(ADDR, '000001')).toBe(false);

    // Disable requires a valid code.
    expect(await disableMfa(ADDR, '000000')).toBe(false);
    expect(await disableMfa(ADDR, totpCode(secret))).toBe(true);
    expect((await getMfaStatus(ADDR)).enabled).toBe(false);

    // Disabling when not enabled fails.
    expect(await disableMfa(ADDR, totpCode(secret))).toBe(false);
    expect(await verifyMfaCode(OTHER, '123456')).toBe(false); // no enrolment
  });

  it('re-enrolment replaces the existing secret', async () => {
    delete process.env.DATABASE_URL;
    __resetMfaForTests();
    const first = await beginMfaEnrollment(ADDR);
    const second = await beginMfaEnrollment(ADDR);
    expect(second.secret).not.toBe(first.secret);
    expect((await getMfaStatus(ADDR)).enabled).toBe(false);
  });

  it('uses the Postgres-backed store when DATABASE_URL is configured', async () => {
    process.env.DATABASE_URL = 'postgres://localhost/shiora';
    __resetMfaForTests();
    expect(await getMfaStatus(ADDR)).toEqual({ enrolled: false, enabled: false });
    expect(pgQuery).toHaveBeenCalled();
  });
});
