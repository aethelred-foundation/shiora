// ============================================================
// Shiora on Aethelred — Wallet Signature Verification
// secp256k1 ECDSA signature verification for Cosmos-style wallets
// ============================================================

import crypto from 'node:crypto';

/**
 * Verify a secp256k1 ECDSA signature produced by a Cosmos/Aethelred wallet.
 *
 * The wallet signs the SHA-256 hash of the challenge message using its
 * private key. The signature is submitted as a hex-encoded DER or
 * raw (r‖s) byte string.  We recover the public key from the address
 * derivation chain:  pubkey → SHA-256 → RIPEMD-160 → bech32("aeth").
 *
 * Because we cannot recover the public key from the bech32 address alone
 * (it is a hash), the client must attach the compressed public key in the
 * `signature` field using the format `<hex-pubkey>.<hex-signature>`.
 *
 * Returns true only when:
 *   1. The public key is a valid 33-byte compressed secp256k1 point.
 *   2. The ECDSA signature over SHA-256(message) verifies against the key.
 *   3. The bech32 address derived from the key matches `expectedAddress`.
 */
export function verifyWalletSignature(
  message: string,
  signatureField: string,
  expectedAddress: string,
): boolean {
  try {
    // Expect format: <compressedPubKeyHex>.<signatureHex>
    const dotIndex = signatureField.indexOf('.');
    if (dotIndex === -1) {
      return false;
    }

    const pubKeyHex = signatureField.slice(0, dotIndex);
    const sigHex = signatureField.slice(dotIndex + 1);

    if (!pubKeyHex || !sigHex) {
      return false;
    }

    // Validate public key format (33-byte compressed secp256k1)
    const pubKeyBytes = Buffer.from(pubKeyHex, 'hex');
    if (pubKeyBytes.length !== 33 || (pubKeyBytes[0] !== 0x02 && pubKeyBytes[0] !== 0x03)) {
      return false;
    }

    // Derive address from public key and verify it matches
    const derivedAddress = deriveAethelredAddress(pubKeyBytes);
    if (derivedAddress !== expectedAddress) {
      return false;
    }

    // Verify ECDSA signature over SHA-256(message)
    const messageHash = crypto.createHash('sha256').update(message).digest();

    // Convert raw (r || s) signature to DER if needed
    const sigBytes = Buffer.from(sigHex, 'hex');
    const derSig = sigBytes.length === 64 ? rawToDer(sigBytes) : sigBytes;

    // Build SPKI DER for compressed secp256k1 key:
    // SEQUENCE { SEQUENCE { OID ecPublicKey, OID secp256k1 }, BIT STRING { compressed key } }
    const spkiPrefix = Buffer.from('3036301006072a8648ce3d020106052b8104000a032200', 'hex');
    const keyObject = crypto.createPublicKey({
      key: Buffer.concat([spkiPrefix, pubKeyBytes]),
      format: 'der',
      type: 'spki',
    });

    return crypto.verify(
      null, // signature is over raw hash, not a digest algorithm
      messageHash,
      { key: keyObject, dsaEncoding: 'der' },
      derSig,
    );
  } catch {
    return false;
  }
}

/**
 * Derive an Aethelred bech32 address from a compressed secp256k1 public key.
 * Address = bech32("aeth", RIPEMD160(SHA256(pubkey)))
 */
function deriveAethelredAddress(compressedPubKey: Buffer): string {
  const sha256Hash = crypto.createHash('sha256').update(compressedPubKey).digest();
  const ripemd160Hash = crypto.createHash('ripemd160').update(sha256Hash).digest();
  return bech32Encode('aeth', ripemd160Hash);
}

/**
 * Minimal bech32 encoder (BIP-173) for address derivation.
 */
function bech32Encode(hrp: string, data: Buffer): string {
  const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';

  // Convert 8-bit groups to 5-bit groups
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
  /* istanbul ignore next -- RIPEMD-160 is always 20 bytes; 160/5=0 remainder */
  if (bits > 0) {
    words.push((acc << (5 - bits)) & 0x1f);
  }

  // Compute checksum
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
  for (const c of hrp) {
    result.push(c.charCodeAt(0) >> 5);
  }
  result.push(0);
  for (const c of hrp) {
    result.push(c.charCodeAt(0) & 0x1f);
  }
  return result;
}

function bech32Polymod(values: number[]): number {
  const GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
  let chk = 1;
  for (const v of values) {
    const top = chk >> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ v;
    for (let i = 0; i < 5; i++) {
      if ((top >> i) & 1) {
        chk ^= GEN[i];
      }
    }
  }
  return chk;
}

/**
 * Convert a raw 64-byte (r || s) ECDSA signature to DER encoding.
 */
function rawToDer(raw: Buffer): Buffer {
  const r = raw.subarray(0, 32);
  const s = raw.subarray(32, 64);

  function encodeInteger(value: Buffer): Buffer {
    // Strip leading zeros but keep one if high bit is set
    let start = 0;
    // istanbul ignore next -- loop body only runs for multi-byte leading zeros
    while (start < value.length - 1 && value[start] === 0) start++;
    let trimmed = value.subarray(start);
    // Prepend 0x00 if high bit is set (to keep it positive)
    if (trimmed[0] & 0x80) {
      trimmed = Buffer.concat([Buffer.from([0x00]), trimmed]);
    }
    return Buffer.concat([Buffer.from([0x02, trimmed.length]), trimmed]);
  }

  const rDer = encodeInteger(r);
  const sDer = encodeInteger(s);
  return Buffer.concat([Buffer.from([0x30, rDer.length + sDer.length]), rDer, sDer]);
}
