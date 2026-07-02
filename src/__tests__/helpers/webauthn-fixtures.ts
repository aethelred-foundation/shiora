// Test-only WebAuthn fixture builder: a simulated ES256 authenticator that
// produces valid attestation objects and assertions for a given rp/origin.
// (Excluded from the jest run + coverage via testPathIgnorePatterns/collect.)

import crypto from 'node:crypto';

function encInt(n: number): Buffer {
  if (n >= 0) {
    if (n < 24) return Buffer.from([n]);
    if (n < 256) return Buffer.from([0x18, n]);
    return Buffer.from([0x19, n >> 8, n & 0xff]);
  }
  const m = -1 - n;
  return m < 24 ? Buffer.from([0x20 | m]) : Buffer.from([0x38, m]);
}
function encBytes(b: Buffer): Buffer {
  const head = b.length < 24 ? Buffer.from([0x40 | b.length])
    : b.length < 256 ? Buffer.from([0x58, b.length])
      : Buffer.from([0x59, b.length >> 8, b.length & 0xff]);
  return Buffer.concat([head, b]);
}
function encText(s: string): Buffer {
  const b = Buffer.from(s, 'utf8');
  return Buffer.concat([Buffer.from([0x60 | b.length]), b]);
}
function encMap(pairs: [Buffer, Buffer][]): Buffer {
  return Buffer.concat([Buffer.from([0xa0 | pairs.length]), ...pairs.flat()]);
}

export function makeAuthenticator(rpId: string, origin: string) {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const jwk = publicKey.export({ format: 'jwk' });
  const x = Buffer.from(jwk.x!, 'base64url');
  const y = Buffer.from(jwk.y!, 'base64url');
  const credentialId = crypto.randomBytes(16);
  const coseKey = encMap([
    [encInt(1), encInt(2)], [encInt(3), encInt(-7)], [encInt(-1), encInt(1)],
    [encInt(-2), encBytes(x)], [encInt(-3), encBytes(y)],
  ]);

  function authData(signCount: number, withAttested: boolean): Buffer {
    const rpIdHash = crypto.createHash('sha256').update(rpId).digest();
    const counter = Buffer.alloc(4);
    counter.writeUInt32BE(signCount);
    const head = Buffer.concat([rpIdHash, Buffer.from([withAttested ? 0x41 : 0x01]), counter]);
    if (!withAttested) return head;
    const idLen = Buffer.alloc(2);
    idLen.writeUInt16BE(credentialId.length);
    return Buffer.concat([head, Buffer.alloc(16), idLen, credentialId, coseKey]);
  }
  const clientData = (type: string, challenge: string) => JSON.stringify({ type, challenge, origin });

  return {
    credentialId: credentialId.toString('base64url'),
    registration(challenge: string) {
      return {
        attestationObject: encMap([
          [encText('fmt'), encText('none')],
          [encText('attStmt'), Buffer.from([0xa0])],
          [encText('authData'), encBytes(authData(0, true))],
        ]).toString('base64url'),
        clientDataJSON: clientData('webauthn.create', challenge),
      };
    },
    assertion(signCount: number, challenge: string) {
      const ad = authData(signCount, false);
      const clientDataJSON = clientData('webauthn.get', challenge);
      const hash = crypto.createHash('sha256').update(clientDataJSON).digest();
      const signature = crypto.sign('sha256', Buffer.concat([ad, hash]), { key: privateKey, dsaEncoding: 'der' });
      return {
        credentialId: credentialId.toString('base64url'),
        authenticatorData: ad.toString('base64url'),
        clientDataJSON,
        signature: signature.toString('base64url'),
      };
    },
  };
}
