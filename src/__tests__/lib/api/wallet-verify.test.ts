/** @jest-environment node */

import { secp256k1 } from '@noble/curves/secp256k1';
import {
  verifyWalletSignature,
  hashPersonalMessage,
  deriveEvmAddress,
} from '@/lib/api/wallet-verify';

const SECP256K1_N = secp256k1.CURVE.n;

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Produce an EIP-191 `personal_sign`-shaped 65-byte signature (r‖s‖v) for a
 * message, exactly as an EVM wallet would. @noble emits canonical low-S, which
 * is what every mainstream wallet does.
 */
function personalSign(message: string, privKey: Uint8Array): string {
  const digest = hashPersonalMessage(message);
  const sig = secp256k1.sign(digest, privKey); // low-S by default
  const rs = sig.toCompactRawBytes(); // 64 bytes r‖s
  const v = sig.recovery! + 27;
  return '0x' + toHex(rs) + v.toString(16).padStart(2, '0');
}

function addressFor(privKey: Uint8Array): string {
  const pub = secp256k1.getPublicKey(privKey, false); // uncompressed
  return deriveEvmAddress(pub);
}

describe('verifyWalletSignature (EIP-191 personal_sign)', () => {
  // Private key = 1 → the canonical, widely-published EVM address. Proves our
  // address derivation matches the rest of the world, not just itself.
  const KNOWN_KEY = new Uint8Array(32);
  KNOWN_KEY[31] = 1;
  const KNOWN_ADDRESS = '0x7e5f4552091a69125d5dfcb7b8c2659029395bdf';

  it('derives the canonical EVM address for private key = 1', () => {
    expect(addressFor(KNOWN_KEY)).toBe(KNOWN_ADDRESS);
  });

  it('accepts a valid signature that recovers to the expected address', () => {
    const message = 'shiora:aethelred:login:nonce-abc123';
    const sig = personalSign(message, KNOWN_KEY);
    expect(verifyWalletSignature(message, sig, KNOWN_ADDRESS)).toBe(true);
  });

  it('is case-insensitive on the expected address (checksum vs lowercase)', () => {
    const message = 'challenge';
    const sig = personalSign(message, KNOWN_KEY);
    const checksummed = '0x7E5F4552091A69125d5DfCb7b8C2659029395Bdf';
    expect(verifyWalletSignature(message, sig, checksummed)).toBe(true);
  });

  it('rejects a signature over a DIFFERENT message (no replay across challenges)', () => {
    const sig = personalSign('challenge-A', KNOWN_KEY);
    expect(verifyWalletSignature('challenge-B', sig, KNOWN_ADDRESS)).toBe(false);
  });

  it('rejects when the recovered address does not match the expected address', () => {
    const message = 'challenge';
    const sig = personalSign(message, KNOWN_KEY);
    const otherKey = new Uint8Array(32);
    otherKey[31] = 2;
    expect(verifyWalletSignature(message, sig, addressFor(otherKey))).toBe(false);
  });

  it('rejects a high-S (malleated) twin of a valid signature (audit L-02)', () => {
    const message = 'challenge';
    const validSig = personalSign(message, KNOWN_KEY);
    const raw = validSig.slice(2);
    const r = raw.slice(0, 64);
    const s = BigInt('0x' + raw.slice(64, 128));
    const v = parseInt(raw.slice(128, 130), 16);

    // Malleate: s' = n - s (high-S), and flip the recovery parity so the twin
    // still recovers to the same key. A verifier without low-S enforcement
    // would accept both; ours must reject the high-S twin.
    const highS = SECP256K1_N - s;
    const flippedV = v === 27 ? 28 : 27;
    const malleated =
      '0x' + r + highS.toString(16).padStart(64, '0') + flippedV.toString(16).padStart(2, '0');

    expect(verifyWalletSignature(message, validSig, KNOWN_ADDRESS)).toBe(true);
    expect(verifyWalletSignature(message, malleated, KNOWN_ADDRESS)).toBe(false);
  });

  it('accepts legacy v ∈ {0,1} as well as {27,28}', () => {
    const message = 'challenge';
    const sig = personalSign(message, KNOWN_KEY); // v is 27 or 28
    const raw = sig.slice(2);
    const v = parseInt(raw.slice(128, 130), 16);
    const legacyV = v - 27; // 0 or 1
    const legacySig = '0x' + raw.slice(0, 128) + legacyV.toString(16).padStart(2, '0');
    expect(verifyWalletSignature(message, legacySig, KNOWN_ADDRESS)).toBe(true);
  });

  it.each([
    ['not-hex', 'zzzz', KNOWN_ADDRESS],
    ['wrong length (64 bytes, no v)', '0x' + '11'.repeat(64), KNOWN_ADDRESS],
    ['empty', '', KNOWN_ADDRESS],
    ['bad v byte', '0x' + '11'.repeat(64) + '05', KNOWN_ADDRESS],
  ])('fails closed on malformed signature: %s', (_label, sig, addr) => {
    expect(verifyWalletSignature('challenge', sig, addr)).toBe(false);
  });

  // r and s must be in [1, n-1]. Out-of-range scalars are never produced by a
  // real signer; accepting them would hand ecrecover degenerate inputs.
  const scalar = (value: bigint) => value.toString(16).padStart(64, '0');
  const VALID_S = scalar(BigInt(2)); // in-range low-S filler
  it.each([
    ['r = 0', '0x' + scalar(BigInt(0)) + VALID_S + '1b'],
    ['r = n', '0x' + scalar(SECP256K1_N) + VALID_S + '1b'],
    ['s = 0', '0x' + scalar(BigInt(2)) + scalar(BigInt(0)) + '1b'],
    ['s = n', '0x' + scalar(BigInt(2)) + scalar(SECP256K1_N) + '1b'],
  ])('fails closed on an out-of-range scalar: %s', (_label, sig) => {
    expect(verifyWalletSignature('challenge', sig, KNOWN_ADDRESS)).toBe(false);
  });

  it.each([
    ['not an address', 'aethel1notevm'],
    ['bech32 (old Cosmos format is no longer accepted)', 'aeth1qqq9m6qe0z6dp0v9phm5g0m6qe0z6dp0abcdef'],
    ['too short', '0x1234'],
    ['empty', ''],
  ])('rejects a non-EVM expected address: %s', (_label, addr) => {
    const sig = personalSign('challenge', KNOWN_KEY);
    expect(verifyWalletSignature('challenge', sig, addr)).toBe(false);
  });
});
