/** @jest-environment node */

import {
  GRANT_AUTHORIZATION_CLOCK_SKEW_MS,
  GRANT_AUTHORIZATION_TTL_MS,
  buildGrantAuthorizationMessage,
  canonicalGrantIntent,
  createGrantAuthorizationChallenge,
  grantIntentHash,
  verifyGrantAuthorizationChallenge,
} from '@/lib/api/grant-authorization';
import { GrantCreateSchema } from '@/lib/api/validation';
import { seededAddress } from '@/lib/utils';

const owner = seededAddress(7001);
const grant = GrantCreateSchema.parse({
  provider: 'Dr. Chen',
  specialty: 'OB-GYN',
  address: seededAddress(7002),
  scope: 'Full Records',
  durationDays: 90,
  canView: true,
  canDownload: true,
  canShare: false,
});

describe('grant authorization challenge', () => {
  const now = Date.parse('2026-07-17T12:00:00.000Z');

  it('creates a five-minute HMAC challenge and reconstructs its exact message', () => {
    const challenge = createGrantAuthorizationChallenge(owner, grant, now);

    expect(challenge.nonce).toMatch(/^[0-9a-f]{64}$/);
    expect(challenge.hmac).toMatch(/^[0-9a-f]{64}$/);
    expect(challenge.issuedAt).toBe(now);
    expect(challenge.expiresAt - challenge.issuedAt).toBe(GRANT_AUTHORIZATION_TTL_MS);
    expect(challenge.message).toContain(`Owner: ${owner}`);
    expect(challenge.message).toContain(`Provider address: ${grant.address}`);
    expect(challenge.message).toContain('Permissions: view=true; download=true; share=false');
    expect(challenge.message).toContain(`Intent hash: 0x${grantIntentHash(owner, grant)}`);
    expect(
      buildGrantAuthorizationMessage(owner, grant, {
        nonce: challenge.nonce,
        issuedAt: challenge.issuedAt,
        expiresAt: challenge.expiresAt,
      }),
    ).toBe(challenge.message);

    const result = verifyGrantAuthorizationChallenge(
      owner,
      grant,
      { ...challenge, signature: 'not-checked-by-this-helper' },
      now + 1,
    );
    expect(result).toEqual({ valid: true, message: challenge.message });
  });

  it('uses the current time when callers omit an explicit clock', () => {
    const challenge = createGrantAuthorizationChallenge(owner, grant);
    const result = verifyGrantAuthorizationChallenge(owner, grant, {
      ...challenge,
      signature: 'not-checked-by-this-helper',
    });

    expect(result).toEqual({ valid: true, message: challenge.message });
  });

  it.each([
    ['owner', seededAddress(7999), grant],
    ['provider', owner, { ...grant, provider: 'Different provider' }],
    ['specialty', owner, { ...grant, specialty: 'Radiology' }],
    ['provider address', owner, { ...grant, address: seededAddress(7003) }],
    ['scope', owner, { ...grant, scope: 'Lab Results Only' as const }],
    ['duration', owner, { ...grant, durationDays: 89 }],
    ['view permission', owner, { ...grant, canView: false }],
    ['download permission', owner, { ...grant, canDownload: false }],
    ['share permission', owner, { ...grant, canShare: true }],
  ])('rejects a challenge rebound to a different %s', (_label, changedOwner, changedGrant) => {
    const challenge = createGrantAuthorizationChallenge(owner, grant, now);
    const result = verifyGrantAuthorizationChallenge(
      changedOwner,
      changedGrant,
      { ...challenge, signature: 'unused' },
      now + 1,
    );
    expect(result).toEqual({
      valid: false,
      reason: 'Grant authorization does not match this session and grant payload.',
    });
  });

  it('rejects expired, excessively future-issued, extended, and tampered challenges', () => {
    const challenge = createGrantAuthorizationChallenge(owner, grant, now);
    const authorization = { ...challenge, signature: 'unused' };

    expect(
      verifyGrantAuthorizationChallenge(owner, grant, authorization, challenge.expiresAt + 1),
    ).toEqual({ valid: false, reason: 'Grant authorization has expired.' });

    expect(
      verifyGrantAuthorizationChallenge(
        owner,
        grant,
        authorization,
        now - GRANT_AUTHORIZATION_CLOCK_SKEW_MS,
      ),
    ).toEqual({ valid: true, message: challenge.message });

    expect(
      verifyGrantAuthorizationChallenge(
        owner,
        grant,
        authorization,
        now - GRANT_AUTHORIZATION_CLOCK_SKEW_MS - 1,
      ),
    ).toEqual({ valid: false, reason: 'Grant authorization was issued in the future.' });

    expect(
      verifyGrantAuthorizationChallenge(
        owner,
        grant,
        { ...authorization, expiresAt: authorization.issuedAt },
        now + 1,
      ),
    ).toEqual({
      valid: false,
      reason: 'Grant authorization has an invalid validity window.',
    });

    expect(
      verifyGrantAuthorizationChallenge(
        owner,
        grant,
        { ...authorization, expiresAt: authorization.expiresAt + 1 },
        now + 1,
      ),
    ).toEqual({
      valid: false,
      reason: 'Grant authorization validity must be exactly five minutes.',
    });

    expect(
      verifyGrantAuthorizationChallenge(
        owner,
        grant,
        { ...authorization, hmac: '0'.repeat(64) },
        now + 1,
      ),
    ).toEqual({
      valid: false,
      reason: 'Grant authorization does not match this session and grant payload.',
    });
  });

  it('uses unambiguous canonical encoding for user-controlled text', () => {
    const first = { ...grant, provider: 'A:B', specialty: 'C' };
    const second = { ...grant, provider: 'A', specialty: 'B:C' };

    expect(canonicalGrantIntent(owner, first)).not.toBe(canonicalGrantIntent(owner, second));
    expect(grantIntentHash(owner, first)).not.toBe(grantIntentHash(owner, second));
  });
});
