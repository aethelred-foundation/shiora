/**
 * EVM wallet test helper — produces the exact identity + signatures the
 * Aethelred Wallet (EIP-1193) would, so wallet-auth tests exercise the real
 * EIP-191 verification path instead of a bespoke crypto reimplementation.
 */
import { secp256k1 } from '@noble/curves/secp256k1';
import { keccak_256 } from '@noble/hashes/sha3';

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Deterministic 32-byte private key from a seed (for stable fixtures). */
export function testPrivateKey(seed = 0x1234): Uint8Array {
  const key = new Uint8Array(32);
  // Fill with a keccak stream so the key is a valid, non-trivial scalar.
  const stream = keccak_256(new Uint8Array([seed & 0xff, (seed >> 8) & 0xff]));
  key.set(stream.subarray(0, 32));
  key[0] |= 1; // ensure non-zero, in-range
  return key;
}

/** The 0x EVM address (lowercase) for a private key. */
export function evmAddress(privKey: Uint8Array): string {
  const pub = secp256k1.getPublicKey(privKey, false); // uncompressed 0x04‖X‖Y
  const hash = keccak_256(pub.subarray(1));
  return '0x' + toHex(hash.subarray(hash.length - 20));
}

/** EIP-191 personal_sign digest for a message. */
export function personalHash(message: string): Uint8Array {
  const msg = new TextEncoder().encode(message);
  const prefix = new TextEncoder().encode(
    `\x19Ethereum Signed Message:\n${msg.length}`,
  );
  const full = new Uint8Array(prefix.length + msg.length);
  full.set(prefix, 0);
  full.set(msg, prefix.length);
  return keccak_256(full);
}

/**
 * Sign `message` as an EVM wallet would: EIP-191 personal_sign, canonical
 * low-S, returning the 0x-prefixed 65-byte (r‖s‖v) signature.
 */
export function personalSign(message: string, privKey: Uint8Array): string {
  const sig = secp256k1.sign(personalHash(message), privKey); // low-S by default
  const rs = sig.toCompactRawBytes();
  const v = (sig.recovery ?? 0) + 27;
  return '0x' + toHex(rs) + v.toString(16).padStart(2, '0');
}

/** The exact challenge message the server builds and verifies against. */
export function buildChallengeMessage(challenge: {
  address: string;
  nonce: string;
  issuedAt: number;
  expiresAt: number;
}): string {
  return [
    'Shiora on Aethelred — Wallet Authentication',
    '',
    `Address: ${challenge.address}`,
    `Nonce: ${challenge.nonce}`,
    `Issued: ${new Date(challenge.issuedAt).toISOString()}`,
    `Expires: ${new Date(challenge.expiresAt).toISOString()}`,
    '',
    'Sign this message to authenticate with Shiora.',
    'This request will not trigger a blockchain transaction.',
  ].join('\n');
}
