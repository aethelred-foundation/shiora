/** @jest-environment node */

import crypto from 'node:crypto';
import { verifyWalletSignature } from '@/lib/api/wallet-verify';

/**
 * Compress a 65-byte uncompressed secp256k1 public key (04||x||y) to 33 bytes (02/03||x).
 */
function compressPublicKey(uncompressedKey: Buffer): Buffer {
  // uncompressed = 0x04 || x (32 bytes) || y (32 bytes)
  if (uncompressedKey[0] !== 0x04 || uncompressedKey.length !== 65) {
    throw new Error('Expected 65-byte uncompressed key starting with 0x04');
  }
  const x = uncompressedKey.subarray(1, 33);
  const y = uncompressedKey.subarray(33, 65);
  // If y is even, prefix is 0x02; if odd, prefix is 0x03
  const prefix = (y[31] & 1) === 0 ? 0x02 : 0x03;
  return Buffer.concat([Buffer.from([prefix]), x]);
}

/**
 * Helper: generate a secp256k1 key pair, derive the aeth bech32 address,
 * sign a message, and return all artifacts for testing.
 */
function generateTestWalletSignature(message: string) {
  // Generate a secp256k1 key pair
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
    namedCurve: 'secp256k1',
  });

  // Export the raw uncompressed public key from JWK
  const jwk = publicKey.export({ format: 'jwk' });
  const xBuf = Buffer.from(jwk.x!, 'base64url');
  const yBuf = Buffer.from(jwk.y!, 'base64url');
  const uncompressedKey = Buffer.concat([Buffer.from([0x04]), xBuf, yBuf]);
  const pubKeyBytes = compressPublicKey(uncompressedKey);

  // Derive address: RIPEMD160(SHA256(pubkey)) -> bech32("aeth")
  const sha256Hash = crypto.createHash('sha256').update(pubKeyBytes).digest();
  const ripemd160Hash = crypto.createHash('ripemd160').update(sha256Hash).digest();
  const address = bech32Encode('aeth', ripemd160Hash);

  // Sign SHA-256(message) with the private key
  const messageHash = crypto.createHash('sha256').update(message).digest();
  const signature = crypto.sign(null, messageHash, { key: privateKey, dsaEncoding: 'ieee-p1363' });

  return {
    pubKeyHex: pubKeyBytes.toString('hex'),
    signatureHex: signature.toString('hex'),
    address,
    signatureField: `${pubKeyBytes.toString('hex')}.${signature.toString('hex')}`,
    privateKey,
  };
}

// Minimal bech32 encoder matching the one in wallet-verify.ts
function bech32Encode(hrp: string, data: Buffer): string {
  const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
  const words: number[] = [];
  let acc = 0;
  let bits = 0;
  for (let i = 0; i < data.length; i++) {
    acc = (acc << 8) | data[i];
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      words.push((acc >> bits) & 0x1f);
    }
  }
  if (bits > 0) {
    words.push((acc << (5 - bits)) & 0x1f);
  }
  const values = [...hrpExpand(hrp), ...words, 0, 0, 0, 0, 0, 0];
  const polymod = bech32Polymod(values) ^ 1;
  const checksum: number[] = [];
  for (let i = 0; i < 6; i++) {
    checksum.push((polymod >> (5 * (5 - i))) & 0x1f);
  }
  return hrp + '1' + [...words, ...checksum].map((d) => CHARSET[d]).join('');
}

function hrpExpand(hrp: string): number[] {
  const result: number[] = [];
  for (const c of hrp) result.push(c.charCodeAt(0) >> 5);
  result.push(0);
  for (const c of hrp) result.push(c.charCodeAt(0) & 0x1f);
  return result;
}

function bech32Polymod(values: number[]): number {
  const GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
  let chk = 1;
  for (const v of values) {
    const top = chk >> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ v;
    for (let i = 0; i < 5; i++) {
      if ((top >> i) & 1) chk ^= GEN[i];
    }
  }
  return chk;
}

describe('verifyWalletSignature', () => {
  const message = 'Test message';
  const validAddress = 'aeth1qypqxpq9qcrsszg2pvxq6rs0zqg3yyc5lzv7xu';

  it('returns false when signature has no dot separator', () => {
    expect(verifyWalletSignature(message, 'nodot', validAddress)).toBe(false);
  });

  it('returns false when pubkey part is empty', () => {
    expect(verifyWalletSignature(message, '.signature', validAddress)).toBe(false);
  });

  it('returns false when signature part is empty', () => {
    expect(verifyWalletSignature(message, 'pubkey.', validAddress)).toBe(false);
  });

  it('returns false for pubkey with wrong length (not 33 bytes)', () => {
    const shortKey = '02' + 'ab'.repeat(31);
    const sig = 'aa'.repeat(64);
    expect(verifyWalletSignature(message, `${shortKey}.${sig}`, validAddress)).toBe(false);
  });

  it('returns false for pubkey with wrong prefix (not 0x02 or 0x03)', () => {
    const badPrefix = '04' + 'ab'.repeat(32);
    const sig = 'aa'.repeat(64);
    expect(verifyWalletSignature(message, `${badPrefix}.${sig}`, validAddress)).toBe(false);
  });

  it('returns false for valid-looking pubkey but wrong derived address', () => {
    const pubKey = '02' + 'ab'.repeat(32);
    const sig = 'aa'.repeat(64);
    expect(verifyWalletSignature(message, `${pubKey}.${sig}`, validAddress)).toBe(false);
  });

  it('returns false for completely malformed input', () => {
    expect(verifyWalletSignature(message, 'not-hex.also-not-hex', validAddress)).toBe(false);
  });

  it('returns false for empty message', () => {
    expect(verifyWalletSignature('', 'a.b', validAddress)).toBe(false);
  });

  it('verifies a valid secp256k1 signature with raw (r||s) format', () => {
    const testMessage = 'Shiora wallet verification test';
    const { signatureField, address } = generateTestWalletSignature(testMessage);

    const result = verifyWalletSignature(testMessage, signatureField, address);
    expect(result).toBe(true);
  });

  it('returns false for valid signature but wrong message', () => {
    const testMessage = 'Original message';
    const { signatureField, address } = generateTestWalletSignature(testMessage);

    const result = verifyWalletSignature('Tampered message', signatureField, address);
    expect(result).toBe(false);
  });

  it('returns false for valid pubkey/sig but mismatched address', () => {
    const testMessage = 'Address mismatch test';
    const { signatureField } = generateTestWalletSignature(testMessage);

    const result = verifyWalletSignature(testMessage, signatureField, 'aeth1wrongaddresswrongaddresswrongaddresswro');
    expect(result).toBe(false);
  });

  it('verifies with a DER-encoded signature', () => {
    const testMessage = 'DER signature test';
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
      namedCurve: 'secp256k1',
    });

    const jwk = publicKey.export({ format: 'jwk' });
    const xBuf = Buffer.from(jwk.x!, 'base64url');
    const yBuf = Buffer.from(jwk.y!, 'base64url');
    const uncompressedKey = Buffer.concat([Buffer.from([0x04]), xBuf, yBuf]);
    const pubKeyBytes = compressPublicKey(uncompressedKey);

    const sha256Hash = crypto.createHash('sha256').update(pubKeyBytes).digest();
    const ripemd160Hash = crypto.createHash('ripemd160').update(sha256Hash).digest();
    const address = bech32Encode('aeth', ripemd160Hash);

    const messageHash = crypto.createHash('sha256').update(testMessage).digest();
    // Sign with DER encoding
    const derSignature = crypto.sign(null, messageHash, { key: privateKey, dsaEncoding: 'der' });

    const sigField = `${pubKeyBytes.toString('hex')}.${derSignature.toString('hex')}`;
    const result = verifyWalletSignature(testMessage, sigField, address);
    expect(result).toBe(true);
  });

  it('returns false when crypto.createPublicKey throws (catch branch)', () => {
    // A valid-looking 33-byte compressed key but with a valid address derived from it,
    // paired with a corrupted signature that will cause crypto.verify to throw
    const { address, pubKeyHex } = generateTestWalletSignature('test');

    // Use a signature hex that is valid hex but not a valid DER or raw signature,
    // causing the crypto operations to throw internally
    const corruptSig = '30' + '00'.repeat(70); // Invalid DER structure
    const result = verifyWalletSignature('test', `${pubKeyHex}.${corruptSig}`, address);
    expect(result).toBe(false);
  });

  it('returns false for a completely non-hex pubkey that causes Buffer parsing issues', () => {
    // This triggers the catch block when Buffer.from(pubKeyHex, 'hex') produces
    // unexpected results
    const result = verifyWalletSignature(
      'test',
      'zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz.aabbcc',
      'aeth1test',
    );
    expect(result).toBe(false);
  });

  it('catches error from crypto.createPublicKey with invalid key bytes', () => {
    // Create a valid-looking 33-byte compressed key (starts with 0x02) that
    // actually maps to a valid derived address but use a pubkey that will cause
    // crypto.createPublicKey to throw when building the SPKI DER
    const pubKey = Buffer.alloc(33);
    pubKey[0] = 0x02;
    // All zeros is not a valid point on secp256k1, so crypto.createPublicKey will throw
    const pubKeyHex = pubKey.toString('hex');

    // Derive the address for this key so it passes the address check
    const sha256Hash = crypto.createHash('sha256').update(pubKey).digest();
    const ripemd160Hash = crypto.createHash('ripemd160').update(sha256Hash).digest();
    const derivedAddr = bech32Encode('aeth', ripemd160Hash);

    const sigHex = 'aa'.repeat(64);
    const result = verifyWalletSignature('test', `${pubKeyHex}.${sigHex}`, derivedAddr);
    expect(result).toBe(false);
  });
});
