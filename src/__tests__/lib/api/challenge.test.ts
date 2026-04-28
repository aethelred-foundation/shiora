/** @jest-environment node */

import crypto from 'node:crypto';
import { verifyChallenge } from '@/lib/api/challenge';
import { serverEnv } from '@/lib/api/env';

function createValidChallenge(address: string) {
  const nonce = crypto.randomBytes(32).toString('hex');
  const issuedAt = Date.now();
  const expiresAt = issuedAt + 5 * 60 * 1000;
  const payload = `${address}:${nonce}:${issuedAt}:${expiresAt}`;
  const hmac = crypto.createHmac('sha256', serverEnv.sessionSecret).update(payload).digest('hex');
  return { nonce, issuedAt, expiresAt, hmac };
}

describe('verifyChallenge', () => {
  const address = 'aeth1qypqxpq9qcrsszg2pvxq6rs0zqg3yyc5lzv7xu';

  it('returns valid for correct challenge', () => {
    const { nonce, issuedAt, expiresAt, hmac } = createValidChallenge(address);
    const result = verifyChallenge(address, nonce, issuedAt, expiresAt, hmac);
    expect(result.valid).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('returns invalid for expired challenge', () => {
    const nonce = crypto.randomBytes(32).toString('hex');
    const issuedAt = Date.now() - 10 * 60 * 1000;
    const expiresAt = issuedAt + 5 * 60 * 1000; // Already expired
    const payload = `${address}:${nonce}:${issuedAt}:${expiresAt}`;
    const hmac = crypto.createHmac('sha256', serverEnv.sessionSecret).update(payload).digest('hex');

    const result = verifyChallenge(address, nonce, issuedAt, expiresAt, hmac);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('Challenge expired');
  });

  it('returns invalid for tampered HMAC', () => {
    const { nonce, issuedAt, expiresAt } = createValidChallenge(address);
    const tamperedHmac = 'a'.repeat(64);

    const result = verifyChallenge(address, nonce, issuedAt, expiresAt, tamperedHmac);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('Invalid challenge HMAC');
  });

  it('returns invalid for wrong address', () => {
    const { nonce, issuedAt, expiresAt, hmac } = createValidChallenge(address);
    const wrongAddress = 'aeth1differentaddress123456789012345678abcd';

    const result = verifyChallenge(wrongAddress, nonce, issuedAt, expiresAt, hmac);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('Invalid challenge HMAC');
  });

  it('returns invalid for mismatched HMAC length', () => {
    const { nonce, issuedAt, expiresAt } = createValidChallenge(address);
    const shortHmac = 'abcd';

    const result = verifyChallenge(address, nonce, issuedAt, expiresAt, shortHmac);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('Invalid challenge HMAC');
  });
});
