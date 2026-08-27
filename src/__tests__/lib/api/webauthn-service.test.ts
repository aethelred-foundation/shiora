/** @jest-environment node */

// The Postgres branch of the store selector is exercised without a live DB by
// stubbing the SQL client (mirrors records-service.test.ts). An empty rowset is
// enough to prove the PgDocumentStore path is taken.
const pgQuery = jest.fn().mockResolvedValue({ rows: [] });
jest.mock('@/lib/persistence/sql-client', () => ({
  getPgClient: jest.fn(() => ({ query: pgQuery })),
}));

import {
  relyingParty,
  startRegistration,
  finishRegistration,
  startAuthentication,
  finishAuthentication,
  listCredentials,
  deleteCredential,
  __resetWebAuthnForTests,
} from '@/lib/api/webauthn-service';
import { getAuditLog, __resetAuditLogForTests } from '@/lib/api/audit-log';
import { makeAuthenticator } from '@/__tests__/helpers/webauthn-fixtures';

const OWNER = 'aeth1own000000000000000000000000000000zz9';
// Build fixtures against the SAME rp identity the service derives from config,
// so a config change can never silently invalidate these tests.
const { rpId, origin } = relyingParty();

afterEach(() => {
  __resetWebAuthnForTests();
  __resetAuditLogForTests();
  delete process.env.DATABASE_URL;
  jest.clearAllMocks();
});

describe('webauthn-service', () => {
  it('exposes the configured relying party', () => {
    expect(rpId).toBe('localhost');
    expect(origin).toBe('http://localhost:3001');
  });

  it('registers, then authenticates a passkey across two counter-advancing logins', async () => {
    const device = makeAuthenticator(rpId, origin);

    const regOpts = await startRegistration(OWNER);
    expect(regOpts.rp.id).toBe(rpId);
    expect(regOpts.rp.name).toBe('Shiora on Aethelred');
    expect(regOpts.user.name).toBe(OWNER);
    expect(regOpts.pubKeyCredParams).toEqual([{ type: 'public-key', alg: -7 }]);

    const cred = await finishRegistration(OWNER, device.registration(regOpts.challenge));
    expect(cred.id).toBe(device.credentialId);
    expect(typeof cred.createdAt).toBe('number');

    const listed = await listCredentials(OWNER);
    expect(listed).toEqual([{ id: device.credentialId, createdAt: cred.createdAt }]);

    const authOpts = await startAuthentication(OWNER);
    expect(authOpts.rpId).toBe(rpId);
    expect(authOpts.allowCredentials).toEqual([{ type: 'public-key', id: device.credentialId }]);

    const first = await finishAuthentication(OWNER, device.assertion(1, authOpts.challenge));
    expect(first).toEqual({ verified: true });

    // A second login must present a strictly higher signature counter.
    const authOpts2 = await startAuthentication(OWNER);
    const second = await finishAuthentication(OWNER, device.assertion(2, authOpts2.challenge));
    expect(second).toEqual({ verified: true });

    // The enrollment/enable mutations are on the tamper-evident audit chain.
    const entries = await getAuditLog().list();
    expect(entries.some((e) => e.action === 'MFA_ENROLL')).toBe(true);
    expect(entries.some((e) => e.action === 'MFA_ENABLE')).toBe(true);
  });

  it('rejects registration when no challenge is pending', async () => {
    const device = makeAuthenticator(rpId, origin);
    await expect(finishRegistration(OWNER, device.registration('unsolicited')))
      .rejects.toThrow(/No pending registration challenge/);
  });

  it('scopes challenges by ceremony: a registration challenge cannot finish authentication', async () => {
    const device = makeAuthenticator(rpId, origin);
    const regOpts = await startRegistration(OWNER);
    await expect(finishAuthentication(OWNER, device.assertion(1, regOpts.challenge)))
      .rejects.toThrow(/No pending authentication challenge/);
    // The registration slot is untouched by the failed authentication attempt.
    const cred = await finishRegistration(OWNER, device.registration(regOpts.challenge));
    expect(cred.id).toBe(device.credentialId);
  });

  it('rejects authentication when no challenge is pending', async () => {
    const device = makeAuthenticator(rpId, origin);
    await expect(finishAuthentication(OWNER, device.assertion(1, 'unsolicited')))
      .rejects.toThrow(/No pending authentication challenge/);
  });

  it('rejects authentication for an unregistered credential', async () => {
    const device = makeAuthenticator(rpId, origin);
    const authOpts = await startAuthentication(OWNER); // valid challenge, but no creds enrolled
    await expect(finishAuthentication(OWNER, device.assertion(1, authOpts.challenge)))
      .rejects.toThrow(/Unknown credential/);
  });

  it('treats an expired challenge as missing (single-use TTL)', async () => {
    const device = makeAuthenticator(rpId, origin);
    const regOpts = await startRegistration(OWNER);
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 6 * 60 * 1000);
    await expect(finishRegistration(OWNER, device.registration(regOpts.challenge)))
      .rejects.toThrow(/No pending registration challenge/);
    nowSpy.mockRestore();
  });

  it('deletes a registered passkey and reports a missing one', async () => {
    const device = makeAuthenticator(rpId, origin);
    const regOpts = await startRegistration(OWNER);
    await finishRegistration(OWNER, device.registration(regOpts.challenge));

    expect(await deleteCredential(OWNER, device.credentialId)).toBe(true);
    expect(await listCredentials(OWNER)).toEqual([]);
    expect(await deleteCredential(OWNER, 'no-such-credential')).toBe(false);
  });

  it('selects the Postgres-backed store when DATABASE_URL is configured', async () => {
    process.env.DATABASE_URL = 'postgres://localhost/shiora';
    __resetWebAuthnForTests();
    const opts = await startAuthentication(OWNER);
    expect(opts.allowCredentials).toEqual([]);
    expect(pgQuery).toHaveBeenCalled();
  });
});
