// ============================================================
// Shiora on Aethelred — Client-side sensitive-field encryption (integration)
//
// The production layer over the Web Crypto primitive (client-envelope.ts) that a
// sensitive-field form uses: derive a field key from a wallet signature, then
// seal a field to an opaque string before it is POSTed and open it on read. The
// server only ever stores/returns the sealed string — selective end-to-end
// encryption (the server can still process structured, non-sealed fields).
//
// The signature is over a FIXED, domain-separated message, so the derived key is
// deterministic for a given wallet and never leaves the device.
// ============================================================

import {
  deriveClientKey,
  sealField,
  openField,
  isClientSealed,
} from '@/lib/crypto/client-envelope';

/** The fixed message a user signs once per session to unlock field encryption. */
export const FIELD_KEY_MESSAGE =
  'Shiora field-encryption key v1 — sign to unlock client-side encryption of your most '
  + 'sensitive fields. This signature never leaves your device.';

/** Derive the field-encryption key from the wallet's signature over FIELD_KEY_MESSAGE. */
export async function deriveFieldKey(signature: string): Promise<CryptoKey> {
  return deriveClientKey(signature);
}

/** Seal a sensitive field to an opaque JSON string for storage. */
export async function sealSensitiveField(
  plaintext: string,
  key: CryptoKey,
  context: string,
): Promise<string> {
  return JSON.stringify(await sealField(plaintext, key, context));
}

/**
 * Open a stored field. If it is a client-sealed envelope, decrypt it; otherwise
 * (non-JSON legacy plaintext, or JSON that is not a sealed envelope) return it
 * unchanged so pre-existing data still reads.
 */
export async function openSensitiveField(
  stored: string,
  key: CryptoKey,
  context: string,
): Promise<string> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stored);
  } catch {
    return stored; // not JSON → treat as legacy plaintext
  }
  if (!isClientSealed(parsed)) {
    return stored; // JSON but not a sealed envelope → passthrough
  }
  return openField(parsed, key, context);
}
