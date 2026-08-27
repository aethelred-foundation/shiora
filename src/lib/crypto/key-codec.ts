// ============================================================
// Shiora on Aethelred — Key material codec
//
// Shared decoder for 256-bit key material, used by every KeyProvider
// implementation (env-backed and Vault-backed). Kept in its own module so the
// providers can share it without an import cycle.
// ============================================================

export const KEY_BYTES = 32; // 256-bit keys

/**
 * Decode a KEK from its stored representation. Accepts either base64 (the
 * `openssl rand -base64 32` form) or 64-char hex, and enforces the 32-byte
 * length so a truncated or mistyped key fails loudly instead of weakening the
 * cipher.
 */
export function decodeKey(raw: string): Buffer {
  const buf = /^[0-9a-fA-F]{64}$/.test(raw)
    ? Buffer.from(raw, 'hex')
    : Buffer.from(raw, 'base64');

  if (buf.length !== KEY_BYTES) {
    throw new Error(
      `Data encryption key must decode to ${KEY_BYTES} bytes `
      + `(got ${buf.length}). Generate one with: openssl rand -base64 32`,
    );
  }
  return buf;
}
