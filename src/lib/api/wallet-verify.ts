// ============================================================
// Shiora on Aethelred — Wallet Signature Verification
// EIP-191 personal_sign verification for the Aethelred Wallet
// (and any EIP-1193 / EVM wallet on the Aethelred network).
// ============================================================
//
// The whole Aethelred ecosystem — Wallet, Cruzible, ZeroID, TerraQura,
// NoblePay and now Shiora — authenticates against ONE wallet: the Aethelred
// Wallet, which injects an EIP-1193 provider (window.ethereum, isAethelred).
// Users prove control of their account by signing the server-issued challenge
// with `personal_sign` (EIP-191). The recovered address is the same 0x account
// the chain uses and that Shiora's own on-chain seal contract binds as its
// `subject`, so the app identity, the on-chain identity, and the seal subject
// are finally one and the same.
//
// Ported from the previous Cosmos ADR-36 (secp256k1/bech32) verifier. The
// security properties are preserved 1:1:
//   1. Proof of private-key control over the exact challenge message.
//   2. The recovered account must equal the expected address (binding).
//   3. Canonical low-S enforcement (EIP-2 / BIP-62) — ECDSA is malleable, so a
//      third party could otherwise mint a second "distinct" signature over the
//      same challenge. Rejecting high-S loses no legitimate logins (every
//      mainstream wallet emits low-S) while pinning one signature per
//      (key, message).
//
// Recovery + keccak come from @noble/curves and @noble/hashes — the audited
// primitives viem and ethers use internally. We never hand-roll ecrecover.

import { secp256k1 } from '@noble/curves/secp256k1';
import { keccak_256 } from '@noble/hashes/sha3';

const SECP256K1_N = secp256k1.CURVE.n;
const SECP256K1_HALF_N = SECP256K1_N / BigInt(2);

/**
 * Verify an EIP-191 `personal_sign` signature over `message`.
 *
 * @param message         the exact challenge string the wallet signed
 * @param signatureField  0x-prefixed 65-byte signature (r‖s‖v), as returned
 *                        by `personal_sign`
 * @param expectedAddress the 0x account the signature must recover to
 *                        (comparison is case-insensitive)
 *
 * Returns true only when the signature is well-formed, canonical low-S, and
 * recovers exactly to `expectedAddress`. Fails closed on any malformed input.
 */
export function verifyWalletSignature(
  message: string,
  signatureField: string,
  expectedAddress: string,
): boolean {
  try {
    if (!isHexAddress(expectedAddress)) {
      return false;
    }

    const sigBytes = hexToBytes(signatureField);
    // 65 bytes: r (32) ‖ s (32) ‖ v (1).
    if (sigBytes.length !== 65) {
      return false;
    }

    const r = bytesToBigInt(sigBytes.subarray(0, 32));
    const s = bytesToBigInt(sigBytes.subarray(32, 64));
    const recovery = normalizeRecoveryId(sigBytes[64]);
    if (recovery === null) {
      return false;
    }

    // Reject out-of-range scalars (fail closed).
    if (r <= BigInt(0) || r >= SECP256K1_N || s <= BigInt(0) || s >= SECP256K1_N) {
      return false;
    }

    // Canonical low-S (audit L-02, preserved from the Cosmos verifier).
    if (s > SECP256K1_HALF_N) {
      return false;
    }

    const digest = hashPersonalMessage(message);

    const signature = new secp256k1.Signature(r, s).addRecoveryBit(recovery);
    const publicKey = signature.recoverPublicKey(digest); // throws on failure
    const uncompressed = publicKey.toRawBytes(false); // 65 bytes, 0x04 ‖ X ‖ Y

    const recovered = deriveEvmAddress(uncompressed);
    return recovered.toLowerCase() === expectedAddress.toLowerCase();
  } catch {
    return false;
  }
}

/**
 * EIP-191 personal_sign digest:
 *   keccak256("\x19Ethereum Signed Message:\n" + len(bytes) + message)
 * where `len(bytes)` is the decimal byte length of the UTF-8 message.
 */
export function hashPersonalMessage(message: string): Uint8Array {
  const messageBytes = new TextEncoder().encode(message);
  const prefix = new TextEncoder().encode(
    `\x19Ethereum Signed Message:\n${messageBytes.length}`,
  );
  const prefixed = new Uint8Array(prefix.length + messageBytes.length);
  prefixed.set(prefix, 0);
  prefixed.set(messageBytes, prefix.length);
  return keccak_256(prefixed);
}

/**
 * Derive the EVM (0x) address from an uncompressed secp256k1 public key:
 *   address = "0x" + keccak256(pubkey[1:])[-20:]
 * Returns a lowercase (non-checksummed) address; callers compare
 * case-insensitively.
 */
export function deriveEvmAddress(uncompressedPubKey: Uint8Array): string {
  // Strip the 0x04 uncompressed prefix; hash the 64-byte X‖Y.
  const hash = keccak_256(uncompressedPubKey.subarray(1));
  const addressBytes = hash.subarray(hash.length - 20);
  return '0x' + bytesToHex(addressBytes);
}

// ── helpers ────────────────────────────────────────────────

function isHexAddress(value: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(value);
}

/** personal_sign v is 27/28 (or legacy 0/1). Map to a 0/1 recovery id. */
function normalizeRecoveryId(v: number): 0 | 1 | null {
  if (v === 27 || v === 0) return 0;
  if (v === 28 || v === 1) return 1;
  return null;
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (clean.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(clean)) {
    throw new Error('invalid hex');
  }
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

function bytesToBigInt(bytes: Uint8Array): bigint {
  // Guards BigInt('0x') throwing on empty input; both call sites pass 32-byte
  // subarrays of a length-checked 65-byte signature, so it cannot trigger.
  return BigInt('0x' + (bytesToHex(bytes) || /* istanbul ignore next -- @preserve unreachable: inputs are always 32 bytes */ '0'));
}
