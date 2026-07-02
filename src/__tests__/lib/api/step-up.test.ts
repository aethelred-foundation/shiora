/** @jest-environment node */

import { NextRequest } from 'next/server';
import {
  mintStepUpAssertion,
  verifyStepUpAssertion,
  requireStepUp,
  STEP_UP_TTL_MS,
  STEP_UP_HEADER,
} from '@/lib/api/step-up';
import {
  beginMfaEnrollment,
  confirmMfaEnrollment,
  __resetMfaForTests,
} from '@/lib/api/mfa-service';
import { totpCode } from '@/lib/api/totp';
import { seededAddress } from '@/lib/utils';

const ADDR = seededAddress(2001);

afterEach(() => __resetMfaForTests());

async function enableMfa(address: string): Promise<void> {
  const { secret } = await beginMfaEnrollment(address);
  expect(await confirmMfaEnrollment(address, totpCode(secret))).toBe(true);
}

describe('step-up assertions', () => {
  it('mints and verifies an assertion for its subject within the TTL', () => {
    const now = 1_700_000_000_000;
    const { assertion, expiresAt } = mintStepUpAssertion(ADDR, now);
    expect(expiresAt).toBe(now + STEP_UP_TTL_MS);
    expect(verifyStepUpAssertion(assertion, ADDR, now)).toBe(true);
    expect(verifyStepUpAssertion(assertion, ADDR, now + STEP_UP_TTL_MS - 1)).toBe(true);
  });

  it('rejects the assertion for a different subject', () => {
    const { assertion } = mintStepUpAssertion(ADDR);
    expect(verifyStepUpAssertion(assertion, seededAddress(2002))).toBe(false);
  });

  it('rejects an expired assertion', () => {
    const now = 1_700_000_000_000;
    const { assertion } = mintStepUpAssertion(ADDR, now);
    expect(verifyStepUpAssertion(assertion, ADDR, now + STEP_UP_TTL_MS)).toBe(false);
  });

  it('rejects tampered, malformed, and missing assertions', () => {
    const now = 1_700_000_000_000;
    const { assertion } = mintStepUpAssertion(ADDR, now);
    const [payload, sig] = assertion.split('.');

    // Payload swapped for another subject but the old signature kept.
    const forgedPayload = Buffer.from(
      JSON.stringify({ sub: ADDR, iat: now, exp: now + 10 * STEP_UP_TTL_MS }),
    ).toString('base64url');
    expect(verifyStepUpAssertion(`${forgedPayload}.${sig}`, ADDR, now)).toBe(false);

    expect(verifyStepUpAssertion(payload, ADDR, now)).toBe(false); // no signature part
    expect(verifyStepUpAssertion('.', ADDR, now)).toBe(false); // empty parts
    expect(verifyStepUpAssertion(null, ADDR, now)).toBe(false); // absent
    expect(verifyStepUpAssertion(`${assertion}x`, ADDR, now)).toBe(false); // corrupted sig
  });

  it('fails closed on a validly-signed non-JSON payload', () => {
    // Sign garbage with the real key by minting, then splicing base64 of non-JSON.
    const crypto = require('node:crypto');
    const { stepUpSigningKey } = require('@/lib/crypto/derived-secrets');
    const bad = Buffer.from('not json').toString('base64url');
    const sig = crypto.createHmac('sha256', stepUpSigningKey()).update(bad).digest('base64url');
    expect(verifyStepUpAssertion(`${bad}.${sig}`, ADDR)).toBe(false);
  });
});

describe('requireStepUp', () => {
  function req(headers: Record<string, string> = {}): NextRequest {
    return new NextRequest('http://localhost:3000/api/roles', { method: 'POST', headers });
  }

  it('lets accounts without MFA proceed (no factor to demand)', async () => {
    expect(await requireStepUp(req(), ADDR)).toBeNull();
  });

  it('blocks an enrolled account without an assertion', async () => {
    await enableMfa(ADDR);
    const res = await requireStepUp(req(), ADDR);
    expect(res).not.toBeNull();
    expect(res!.status).toBe(403);
    expect((await res!.json()).error.code).toBe('STEP_UP_REQUIRED');
  });

  it('blocks an enrolled account with an invalid assertion', async () => {
    await enableMfa(ADDR);
    const res = await requireStepUp(req({ [STEP_UP_HEADER]: 'garbage.assertion' }), ADDR);
    expect(res!.status).toBe(403);
  });

  it('lets an enrolled account through with a fresh assertion', async () => {
    await enableMfa(ADDR);
    const { assertion } = mintStepUpAssertion(ADDR);
    expect(await requireStepUp(req({ [STEP_UP_HEADER]: assertion }), ADDR)).toBeNull();
  });
});
