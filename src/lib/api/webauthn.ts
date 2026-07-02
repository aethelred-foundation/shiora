// ============================================================
// Shiora on Aethelred — WebAuthn / passkeys (GAP-12)
//
// A second factor bound to an already-authenticated wallet session. We support
// ES256 (the near-universal passkey algorithm) with 'none'/self attestation:
// because registration happens inside an authenticated session, we don't need
// to verify the authenticator's provenance — only that the SAME key signs the
// login assertion. The security-critical assertion verification (challenge +
// origin binding, signature, monotonic counter) is enforced below.
//
// Built on the minimal CBOR decoder rather than a heavyweight dependency.
// ============================================================

import crypto from 'node:crypto';

import { decodeCbor, type CborValue } from '@/lib/crypto/cbor-lite';

const CHALLENGE_BYTES = 32;

/** Fresh base64url challenge for a registration or authentication ceremony. */
export function generateWebAuthnChallenge(): string {
  return crypto.randomBytes(CHALLENGE_BYTES).toString('base64url');
}

function b64urlToBuffer(value: string): Buffer {
  return Buffer.from(value, 'base64url');
}

// ── COSE ES256 → Node public key ──────────────────────────────────────────

// SPKI DER prefix for an uncompressed prime256v1 (P-256) public key.
const P256_SPKI_PREFIX = Buffer.from(
  '3059301306072a8648ce3d020106082a8648ce3d030107034200',
  'hex',
);

function coseEs256ToSpki(cose: Map<CborValue, CborValue>): Buffer {
  const kty = cose.get(1); // 2 = EC2
  const alg = cose.get(3); // -7 = ES256
  const crv = cose.get(-1); // 1 = P-256
  const x = cose.get(-2);
  const y = cose.get(-3);
  if (kty !== 2 || alg !== -7 || crv !== 1
      || !(x instanceof Uint8Array) || !(y instanceof Uint8Array)
      || x.length !== 32 || y.length !== 32) {
    throw new Error('Unsupported credential public key (expected COSE ES256/P-256).');
  }
  const point = Buffer.concat([Buffer.from([0x04]), Buffer.from(x), Buffer.from(y)]);
  return Buffer.concat([P256_SPKI_PREFIX, point]);
}

// ── authenticatorData parsing ──────────────────────────────────────────────

export interface ParsedAuthData {
  rpIdHash: Buffer;
  userPresent: boolean;
  signCount: number;
  credentialId?: Buffer;
  publicKeySpki?: Buffer;
}

/** Parse the fixed authenticatorData byte layout (WebAuthn §6.1). */
export function parseAuthData(authData: Buffer): ParsedAuthData {
  if (authData.length < 37) {
    throw new Error('authenticatorData is too short.');
  }
  const rpIdHash = authData.subarray(0, 32);
  const flags = authData[32];
  const signCount = authData.readUInt32BE(33);
  const result: ParsedAuthData = {
    rpIdHash,
    userPresent: (flags & 0x01) !== 0,
    signCount,
  };

  // AT bit: attested credential data present (registration).
  if (flags & 0x40) {
    const credIdLen = authData.readUInt16BE(53);
    const credentialId = authData.subarray(55, 55 + credIdLen);
    const cose = decodeCbor(authData.subarray(55 + credIdLen)) as Map<CborValue, CborValue>;
    result.credentialId = credentialId;
    result.publicKeySpki = coseEs256ToSpki(cose);
  }

  return result;
}

// ── clientDataJSON checks ──────────────────────────────────────────────────

function assertClientData(
  clientDataJSON: string,
  type: 'webauthn.create' | 'webauthn.get',
  expectedChallenge: string,
  expectedOrigin: string,
): void {
  let data: { type?: string; challenge?: string; origin?: string };
  try {
    data = JSON.parse(clientDataJSON);
  } catch {
    throw new Error('clientDataJSON is not valid JSON.');
  }
  if (data.type !== type) {
    throw new Error(`Unexpected clientData type: ${data.type}`);
  }
  if (data.challenge !== expectedChallenge) {
    throw new Error('Challenge mismatch.');
  }
  if (data.origin !== expectedOrigin) {
    throw new Error('Origin mismatch.');
  }
}

function assertRpIdHash(rpIdHash: Buffer, rpId: string): void {
  const expected = crypto.createHash('sha256').update(rpId).digest();
  if (!rpIdHash.equals(expected)) {
    throw new Error('rpIdHash mismatch.');
  }
}

// ── Registration ───────────────────────────────────────────────────────────

export interface RegistrationVerification {
  credentialId: string; // base64url
  publicKeySpki: string; // base64
  signCount: number;
}

/**
 * Verify a registration ceremony and extract the credential to store. Throws on
 * any check failure (fail closed).
 */
export function verifyRegistration(params: {
  attestationObject: string; // base64url
  clientDataJSON: string; // utf-8
  expectedChallenge: string;
  expectedOrigin: string;
  expectedRpId: string;
}): RegistrationVerification {
  assertClientData(params.clientDataJSON, 'webauthn.create', params.expectedChallenge, params.expectedOrigin);

  const attestation = decodeCbor(b64urlToBuffer(params.attestationObject)) as Map<CborValue, CborValue>;
  const authDataRaw = attestation.get('authData');
  if (!(authDataRaw instanceof Uint8Array)) {
    throw new Error('Attestation object is missing authData.');
  }
  const parsed = parseAuthData(Buffer.from(authDataRaw));
  if (!parsed.userPresent) {
    throw new Error('User presence flag was not set.');
  }
  assertRpIdHash(parsed.rpIdHash, params.expectedRpId);
  if (!parsed.credentialId || !parsed.publicKeySpki) {
    throw new Error('No attested credential data present.');
  }

  return {
    credentialId: parsed.credentialId.toString('base64url'),
    publicKeySpki: parsed.publicKeySpki.toString('base64'),
    signCount: parsed.signCount,
  };
}

// ── Authentication (assertion) ─────────────────────────────────────────────

export interface AuthenticationVerification {
  newSignCount: number;
}

/**
 * Verify a login assertion against a stored credential. Enforces challenge +
 * origin binding, the ES256 signature over authenticatorData‖SHA256(clientData),
 * and a monotonic (non-cloned) signature counter. Throws on failure.
 */
export function verifyAuthentication(params: {
  publicKeySpki: string; // base64 (stored at registration)
  authenticatorData: string; // base64url
  clientDataJSON: string; // utf-8
  signature: string; // base64url, DER ECDSA
  expectedChallenge: string;
  expectedOrigin: string;
  expectedRpId: string;
  storedSignCount: number;
}): AuthenticationVerification {
  assertClientData(params.clientDataJSON, 'webauthn.get', params.expectedChallenge, params.expectedOrigin);

  const authData = b64urlToBuffer(params.authenticatorData);
  const parsed = parseAuthData(authData);
  if (!parsed.userPresent) {
    throw new Error('User presence flag was not set.');
  }
  assertRpIdHash(parsed.rpIdHash, params.expectedRpId);

  const clientDataHash = crypto.createHash('sha256').update(params.clientDataJSON).digest();
  const signedData = Buffer.concat([authData, clientDataHash]);
  const publicKey = crypto.createPublicKey({
    key: Buffer.from(params.publicKeySpki, 'base64'),
    format: 'der',
    type: 'spki',
  });
  const ok = crypto.verify(
    'sha256',
    signedData,
    { key: publicKey, dsaEncoding: 'der' },
    b64urlToBuffer(params.signature),
  );
  if (!ok) {
    throw new Error('Assertion signature verification failed.');
  }

  // Counter must strictly advance (unless the authenticator never counts, in
  // which case both are 0). A regression signals a cloned authenticator.
  if (parsed.signCount !== 0 && parsed.signCount <= params.storedSignCount) {
    throw new Error('Signature counter did not advance (possible cloned credential).');
  }

  return { newSignCount: parsed.signCount };
}
