/** @jest-environment node */

import crypto from 'node:crypto';
import {
  generateWebAuthnChallenge,
  parseAuthData,
  verifyRegistration,
  verifyAuthentication,
} from '@/lib/api/webauthn';

const RP_ID = 'app.shiora.health';
const ORIGIN = 'https://app.shiora.health';

// ── Minimal CBOR encoder (test-only, mirrors the shapes WebAuthn uses) ──────
function encInt(n: number): Buffer {
  if (n >= 0) {
    if (n < 24) return Buffer.from([n]);
    if (n < 256) return Buffer.from([0x18, n]);
    return Buffer.from([0x19, n >> 8, n & 0xff]);
  }
  const m = -1 - n;
  if (m < 24) return Buffer.from([0x20 | m]);
  return Buffer.from([0x38, m]);
}
function encBytes(b: Buffer): Buffer {
  const len = b.length;
  const head = len < 24 ? Buffer.from([0x40 | len])
    : len < 256 ? Buffer.from([0x58, len])
      : Buffer.from([0x59, len >> 8, len & 0xff]);
  return Buffer.concat([head, b]);
}
function encText(s: string): Buffer {
  const b = Buffer.from(s, 'utf8');
  return Buffer.concat([Buffer.from([0x60 | b.length]), b]);
}
function encMap(pairs: [Buffer, Buffer][]): Buffer {
  return Buffer.concat([Buffer.from([0xa0 | pairs.length]), ...pairs.flat()]);
}

/** A simulated ES256 authenticator. */
function makeAuthenticator() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const jwk = publicKey.export({ format: 'jwk' });
  const x = Buffer.from(jwk.x!, 'base64url');
  const y = Buffer.from(jwk.y!, 'base64url');
  const credentialId = crypto.randomBytes(16);

  const coseKey = encMap([
    [encInt(1), encInt(2)], // kty EC2
    [encInt(3), encInt(-7)], // alg ES256
    [encInt(-1), encInt(1)], // crv P-256
    [encInt(-2), encBytes(x)],
    [encInt(-3), encBytes(y)],
  ]);

  function authData(signCount: number, withAttestedData: boolean): Buffer {
    const rpIdHash = crypto.createHash('sha256').update(RP_ID).digest();
    const flags = Buffer.from([withAttestedData ? 0x41 : 0x01]); // UP (+AT)
    const counter = Buffer.alloc(4);
    counter.writeUInt32BE(signCount);
    const head = Buffer.concat([rpIdHash, flags, counter]);
    if (!withAttestedData) return head;
    const aaguid = Buffer.alloc(16);
    const idLen = Buffer.alloc(2);
    idLen.writeUInt16BE(credentialId.length);
    return Buffer.concat([head, aaguid, idLen, credentialId, coseKey]);
  }

  function authDataCustom(flags: number, withAttestedData: boolean, badCose = false): Buffer {
    const rpIdHash = crypto.createHash('sha256').update(RP_ID).digest();
    const head = Buffer.concat([rpIdHash, Buffer.from([flags]), Buffer.alloc(4)]);
    if (!withAttestedData) return head;
    const idLen = Buffer.alloc(2);
    idLen.writeUInt16BE(credentialId.length);
    // A COSE key advertising RSA (kty 3) instead of EC2 → unsupported.
    const cose = badCose
      ? encMap([[encInt(1), encInt(3)], [encInt(3), encInt(-257)]])
      : coseKey;
    return Buffer.concat([head, Buffer.alloc(16), idLen, credentialId, cose]);
  }

  function attestationObject(): string {
    const obj = encMap([
      [encText('fmt'), encText('none')],
      [encText('attStmt'), Buffer.from([0xa0])], // {}
      [encText('authData'), encBytes(authData(0, true))],
    ]);
    return obj.toString('base64url');
  }

  function attestationRaw(opts: { flags?: number; omitAuthData?: boolean; noAttested?: boolean; badCose?: boolean } = {}): string {
    const pairs: [Buffer, Buffer][] = [
      [encText('fmt'), encText('none')],
      [encText('attStmt'), Buffer.from([0xa0])],
    ];
    if (!opts.omitAuthData) {
      const ad = authDataCustom(opts.flags ?? 0x41, !opts.noAttested, opts.badCose);
      pairs.push([encText('authData'), encBytes(ad)]);
    }
    return encMap(pairs).toString('base64url');
  }

  function signRaw(flags: number, signCount: number, challenge: string) {
    const ad = authDataCustom(flags, false);
    const clientDataJSON = clientData('webauthn.get', challenge);
    const hash = crypto.createHash('sha256').update(clientDataJSON).digest();
    const signature = crypto.sign('sha256', Buffer.concat([ad, hash]), { key: privateKey, dsaEncoding: 'der' });
    return { authenticatorData: ad.toString('base64url'), clientDataJSON, signature: signature.toString('base64url') };
  }

  function clientData(type: string, challenge: string): string {
    return JSON.stringify({ type, challenge, origin: ORIGIN });
  }

  function sign(signCount: number, challenge: string): { authenticatorData: string; clientDataJSON: string; signature: string } {
    const ad = authData(signCount, false);
    const clientDataJSON = clientData('webauthn.get', challenge);
    const hash = crypto.createHash('sha256').update(clientDataJSON).digest();
    const signature = crypto.sign('sha256', Buffer.concat([ad, hash]), { key: privateKey, dsaEncoding: 'der' });
    return {
      authenticatorData: ad.toString('base64url'),
      clientDataJSON,
      signature: signature.toString('base64url'),
    };
  }

  return { attestationObject, attestationRaw, clientData, sign, signRaw, credentialId };
}

describe('generateWebAuthnChallenge', () => {
  it('produces a fresh base64url challenge each time', () => {
    const a = generateWebAuthnChallenge();
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(a).not.toBe(generateWebAuthnChallenge());
  });
});

describe('verifyRegistration', () => {
  it('extracts the credential from a valid ceremony', () => {
    const auth = makeAuthenticator();
    const challenge = generateWebAuthnChallenge();
    const result = verifyRegistration({
      attestationObject: auth.attestationObject(),
      clientDataJSON: auth.clientData('webauthn.create', challenge),
      expectedChallenge: challenge,
      expectedOrigin: ORIGIN,
      expectedRpId: RP_ID,
    });
    expect(result.credentialId).toBe(auth.credentialId.toString('base64url'));
    expect(result.publicKeySpki).toMatch(/^[A-Za-z0-9+/=]+$/);
    expect(result.signCount).toBe(0);
  });

  it('rejects a challenge/origin/type mismatch', () => {
    const auth = makeAuthenticator();
    const base = { attestationObject: auth.attestationObject(), expectedOrigin: ORIGIN, expectedRpId: RP_ID };
    expect(() => verifyRegistration({ ...base, clientDataJSON: auth.clientData('webauthn.create', 'c1'), expectedChallenge: 'c2' })).toThrow(/Challenge mismatch/);
    expect(() => verifyRegistration({ ...base, clientDataJSON: JSON.stringify({ type: 'webauthn.create', challenge: 'c', origin: 'https://evil.example' }), expectedChallenge: 'c' })).toThrow(/Origin mismatch/);
    expect(() => verifyRegistration({ ...base, clientDataJSON: auth.clientData('webauthn.get', 'c'), expectedChallenge: 'c' })).toThrow(/clientData type/);
  });

  it('rejects invalid clientDataJSON', () => {
    const auth = makeAuthenticator();
    expect(() => verifyRegistration({
      attestationObject: auth.attestationObject(), clientDataJSON: 'not json',
      expectedChallenge: 'c', expectedOrigin: ORIGIN, expectedRpId: RP_ID,
    })).toThrow(/not valid JSON/);
  });

  it('rejects a wrong rpId (rpIdHash mismatch)', () => {
    const auth = makeAuthenticator();
    const challenge = generateWebAuthnChallenge();
    expect(() => verifyRegistration({
      attestationObject: auth.attestationObject(), clientDataJSON: auth.clientData('webauthn.create', challenge),
      expectedChallenge: challenge, expectedOrigin: ORIGIN, expectedRpId: 'evil.example',
    })).toThrow(/rpIdHash mismatch/);
  });

  it('fails closed on malformed / unsupported ceremonies', () => {
    const auth = makeAuthenticator();
    const c = generateWebAuthnChallenge();
    const cd = auth.clientData('webauthn.create', c);
    const base = { clientDataJSON: cd, expectedChallenge: c, expectedOrigin: ORIGIN, expectedRpId: RP_ID };

    // Attestation object missing authData.
    expect(() => verifyRegistration({ ...base, attestationObject: auth.attestationRaw({ omitAuthData: true }) })).toThrow(/missing authData/);
    // User-presence flag not set (0x40 = AT only).
    expect(() => verifyRegistration({ ...base, attestationObject: auth.attestationRaw({ flags: 0x40 }) })).toThrow(/User presence/);
    // No attested credential data (UP but no AT).
    expect(() => verifyRegistration({ ...base, attestationObject: auth.attestationRaw({ flags: 0x01, noAttested: true }) })).toThrow(/No attested credential data/);
    // Unsupported (non-ES256) key.
    expect(() => verifyRegistration({ ...base, attestationObject: auth.attestationRaw({ badCose: true }) })).toThrow(/Unsupported credential public key/);
  });
});

describe('verifyAuthentication', () => {
  function register() {
    const auth = makeAuthenticator();
    const challenge = generateWebAuthnChallenge();
    const cred = verifyRegistration({
      attestationObject: auth.attestationObject(),
      clientDataJSON: auth.clientData('webauthn.create', challenge),
      expectedChallenge: challenge, expectedOrigin: ORIGIN, expectedRpId: RP_ID,
    });
    return { auth, cred };
  }

  it('verifies a valid assertion and advances the counter', () => {
    const { auth, cred } = register();
    const challenge = generateWebAuthnChallenge();
    const assertion = auth.sign(5, challenge);
    const result = verifyAuthentication({
      publicKeySpki: cred.publicKeySpki,
      ...assertion,
      expectedChallenge: challenge, expectedOrigin: ORIGIN, expectedRpId: RP_ID,
      storedSignCount: 0,
    });
    expect(result.newSignCount).toBe(5);
  });

  it('rejects a bad signature (wrong key)', () => {
    const { auth } = register();
    const other = makeAuthenticator();
    const otherCred = verifyRegistration({
      attestationObject: other.attestationObject(),
      clientDataJSON: other.clientData('webauthn.create', 'x'),
      expectedChallenge: 'x', expectedOrigin: ORIGIN, expectedRpId: RP_ID,
    });
    const challenge = generateWebAuthnChallenge();
    const assertion = auth.sign(1, challenge); // signed by auth, verified against other's key
    expect(() => verifyAuthentication({
      publicKeySpki: otherCred.publicKeySpki, ...assertion,
      expectedChallenge: challenge, expectedOrigin: ORIGIN, expectedRpId: RP_ID, storedSignCount: 0,
    })).toThrow(/signature verification failed/);
  });

  it('rejects a stale/cloned counter that does not advance', () => {
    const { auth, cred } = register();
    const challenge = generateWebAuthnChallenge();
    const assertion = auth.sign(3, challenge);
    expect(() => verifyAuthentication({
      publicKeySpki: cred.publicKeySpki, ...assertion,
      expectedChallenge: challenge, expectedOrigin: ORIGIN, expectedRpId: RP_ID,
      storedSignCount: 5, // already higher than the assertion's 3
    })).toThrow(/counter did not advance/);
  });

  it('rejects a challenge mismatch on the assertion', () => {
    const { auth, cred } = register();
    const assertion = auth.sign(1, 'real-challenge');
    expect(() => verifyAuthentication({
      publicKeySpki: cred.publicKeySpki, ...assertion,
      expectedChallenge: 'different', expectedOrigin: ORIGIN, expectedRpId: RP_ID, storedSignCount: 0,
    })).toThrow(/Challenge mismatch/);
  });

  it('rejects an assertion without the user-presence flag', () => {
    const { auth, cred } = register();
    const challenge = generateWebAuthnChallenge();
    const assertion = auth.signRaw(0x00, 1, challenge); // UP not set
    expect(() => verifyAuthentication({
      publicKeySpki: cred.publicKeySpki, ...assertion,
      expectedChallenge: challenge, expectedOrigin: ORIGIN, expectedRpId: RP_ID, storedSignCount: 0,
    })).toThrow(/User presence/);
  });
});

describe('parseAuthData', () => {
  it('rejects data that is too short', () => {
    expect(() => parseAuthData(Buffer.alloc(10))).toThrow(/too short/);
  });
});
