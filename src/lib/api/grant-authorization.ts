// ============================================================
// Shiora on Aethelred — Payload-bound access-grant authorization
//
// A grant changes who may read a patient's medical records. A valid app
// session alone is therefore not sufficient: each grant requires a fresh
// EIP-191 signature over the exact grant intent. The short-lived challenge is
// HMAC-bound to both the session owner and a canonical hash of every persisted
// grant field, so no field can be changed between challenge and redemption.
// ============================================================

import crypto from 'node:crypto';
import type { z } from 'zod';

import { challengeSigningKey } from '@/lib/crypto/derived-secrets';
import type { GrantAuthorizationSchema, GrantCreateSchema } from '@/lib/api/validation';

export const GRANT_AUTHORIZATION_TTL_MS = 5 * 60 * 1000;
export const GRANT_AUTHORIZATION_CLOCK_SKEW_MS = 30 * 1000;

const GRANT_AUTHORIZATION_DOMAIN = 'shiora/access-grant-authorization/v1';

// The HMAC key is also the deployment boundary: challengeSigningKey() is
// derived from SHIORA_SESSION_SECRET. Every environment/chain deployment must
// use a distinct root secret. Sharing that secret would make a server-issued
// challenge portable between those deployments even though nonce stores are
// separate; there is no stable chain/deployment claim in the current session
// token that can be safely added to the signed domain instead.

export type GrantIntent = z.infer<typeof GrantCreateSchema>;
export type GrantAuthorization = z.infer<typeof GrantAuthorizationSchema>;

export interface GrantAuthorizationChallenge {
  message: string;
  nonce: string;
  issuedAt: number;
  expiresAt: number;
  hmac: string;
}

type VerificationResult = { valid: true; message: string } | { valid: false; reason: string };

/**
 * Canonical, fixed-order representation of the complete grant intent.
 *
 * An array of key/value tuples avoids relying on object insertion order, while
 * JSON encoding prevents delimiter ambiguity in user-supplied text fields.
 */
export function canonicalGrantIntent(ownerAddress: string, grant: GrantIntent): string {
  return JSON.stringify([
    ['domain', GRANT_AUTHORIZATION_DOMAIN],
    ['owner', ownerAddress.toLowerCase()],
    ['provider', grant.provider],
    ['specialty', grant.specialty],
    ['providerAddress', grant.address.toLowerCase()],
    ['scope', grant.scope],
    ['durationDays', grant.durationDays],
    ['canView', grant.canView],
    ['canDownload', grant.canDownload],
    ['canShare', grant.canShare],
  ]);
}

export function grantIntentHash(ownerAddress: string, grant: GrantIntent): string {
  return crypto
    .createHash('sha256')
    .update(canonicalGrantIntent(ownerAddress, grant), 'utf8')
    .digest('hex');
}

export function buildGrantAuthorizationMessage(
  ownerAddress: string,
  grant: GrantIntent,
  challenge: Pick<GrantAuthorizationChallenge, 'nonce' | 'issuedAt' | 'expiresAt'>,
): string {
  const owner = ownerAddress.toLowerCase();
  const intentHash = grantIntentHash(owner, grant);

  return [
    'Shiora on Aethelred — Grant Record Access',
    '',
    `Owner: ${owner}`,
    `Provider: ${JSON.stringify(grant.provider)}`,
    `Specialty: ${JSON.stringify(grant.specialty)}`,
    `Provider address: ${grant.address.toLowerCase()}`,
    `Scope: ${grant.scope}`,
    `Duration: ${grant.durationDays} days`,
    `Permissions: view=${grant.canView}; download=${grant.canDownload}; share=${grant.canShare}`,
    `Intent hash: 0x${intentHash}`,
    `Nonce: ${challenge.nonce}`,
    `Issued: ${new Date(challenge.issuedAt).toISOString()}`,
    `Expires: ${new Date(challenge.expiresAt).toISOString()}`,
    '',
    'Sign this message to authorize this exact access grant.',
    'This request will not trigger a blockchain transaction.',
  ].join('\n');
}

function challengeMacPayload(
  ownerAddress: string,
  grant: GrantIntent,
  challenge: Pick<GrantAuthorizationChallenge, 'nonce' | 'issuedAt' | 'expiresAt'>,
): string {
  return JSON.stringify([
    ['domain', GRANT_AUTHORIZATION_DOMAIN],
    ['owner', ownerAddress.toLowerCase()],
    ['intentHash', grantIntentHash(ownerAddress, grant)],
    ['nonce', challenge.nonce],
    ['issuedAt', challenge.issuedAt],
    ['expiresAt', challenge.expiresAt],
  ]);
}

function createChallengeHmac(
  ownerAddress: string,
  grant: GrantIntent,
  challenge: Pick<GrantAuthorizationChallenge, 'nonce' | 'issuedAt' | 'expiresAt'>,
): string {
  return crypto
    .createHmac('sha256', challengeSigningKey())
    .update(challengeMacPayload(ownerAddress, grant, challenge), 'utf8')
    .digest('hex');
}

export function createGrantAuthorizationChallenge(
  ownerAddress: string,
  grant: GrantIntent,
  now: number = Date.now(),
): GrantAuthorizationChallenge {
  const challenge = {
    nonce: crypto.randomBytes(32).toString('hex'),
    issuedAt: now,
    expiresAt: now + GRANT_AUTHORIZATION_TTL_MS,
  };

  return {
    ...challenge,
    message: buildGrantAuthorizationMessage(ownerAddress, grant, challenge),
    hmac: createChallengeHmac(ownerAddress, grant, challenge),
  };
}

/**
 * Verify freshness and server provenance, then reconstruct the exact message
 * whose EIP-191 signature the route must verify against the session owner.
 */
export function verifyGrantAuthorizationChallenge(
  ownerAddress: string,
  grant: GrantIntent,
  authorization: GrantAuthorization,
  now: number = Date.now(),
): VerificationResult {
  if (authorization.expiresAt <= authorization.issuedAt) {
    return { valid: false, reason: 'Grant authorization has an invalid validity window.' };
  }

  if (authorization.expiresAt - authorization.issuedAt !== GRANT_AUTHORIZATION_TTL_MS) {
    return { valid: false, reason: 'Grant authorization validity must be exactly five minutes.' };
  }

  if (authorization.issuedAt > now + GRANT_AUTHORIZATION_CLOCK_SKEW_MS) {
    return { valid: false, reason: 'Grant authorization was issued in the future.' };
  }

  if (now > authorization.expiresAt) {
    return { valid: false, reason: 'Grant authorization has expired.' };
  }

  const expected = createChallengeHmac(ownerAddress, grant, authorization);
  const suppliedBuffer = Buffer.from(authorization.hmac, 'hex');
  const expectedBuffer = Buffer.from(expected, 'hex');

  if (
    suppliedBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(suppliedBuffer, expectedBuffer)
  ) {
    return {
      valid: false,
      reason: 'Grant authorization does not match this session and grant payload.',
    };
  }

  return {
    valid: true,
    message: buildGrantAuthorizationMessage(ownerAddress, grant, authorization),
  };
}
