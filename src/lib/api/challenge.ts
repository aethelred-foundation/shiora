// ---------------------------------------------------------------------------
// Challenge verification utility — used by wallet connect route
// Separated from the route file because Next.js App Router only allows
// specific exports (GET, POST, etc.) from route.ts files.
// ---------------------------------------------------------------------------

import crypto from 'node:crypto';

import { serverEnv } from '@/lib/api/env';

export function verifyChallenge(
  address: string,
  nonce: string,
  issuedAt: number,
  expiresAt: number,
  hmac: string,
): { valid: boolean; reason?: string } {
  // Check expiry
  if (Date.now() > expiresAt) {
    return { valid: false, reason: 'Challenge expired' };
  }

  // Verify HMAC — proves the challenge was issued by this server
  const payload = `${address}:${nonce}:${issuedAt}:${expiresAt}`;
  const expected = crypto
    .createHmac('sha256', serverEnv.sessionSecret)
    .update(payload)
    .digest('hex');

  const hmacBuffer = Buffer.from(hmac, 'hex');
  const expectedBuffer = Buffer.from(expected, 'hex');

  if (hmacBuffer.length !== expectedBuffer.length) {
    return { valid: false, reason: 'Invalid challenge HMAC' };
  }

  if (!crypto.timingSafeEqual(hmacBuffer, expectedBuffer)) {
    return { valid: false, reason: 'Invalid challenge HMAC' };
  }

  return { valid: true };
}
