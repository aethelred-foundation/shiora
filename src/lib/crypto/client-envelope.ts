// ============================================================
// Shiora on Aethelred — Client-side field sealing (Web Crypto)
//
// Selective end-to-end encryption: the highest-sensitivity FREE-TEXT fields
// (e.g. clinical-note bodies, vault/journal notes) are sealed HERE, in the
// browser, before they ever leave the device — so the server stores opaque
// ciphertext and never sees the plaintext. Structured fields stay server-sealed
// (envelope.ts) so population analytics, provider record-viewing, and FHIR
// mapping keep working.
//
// The key is derived in the browser from a secret only the user controls (their
// wallet's signature over a fixed domain-separated message) and is NEVER sent to
// the server. Isomorphic: uses the Web Crypto API (globalThis.crypto.subtle),
// available in browsers and in Node — no node:crypto, so it bundles for the
// client safely.
// ============================================================

const ALG = 'AES-GCM';
const KEY_BITS = 256;
const IV_BYTES = 12;
const ENVELOPE_VERSION = 1;

/** A field sealed client-side. Opaque to the server. */
export interface ClientSealedEnvelope {
  v: number;
  alg: 'A256GCM';
  /** base64 random 96-bit IV. */
  iv: string;
  /** base64 ciphertext + GCM auth tag. */
  ct: string;
}

function subtle(): SubtleCrypto {
  return globalThis.crypto.subtle;
}

function toBase64(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  for (let i = 0; i < arr.length; i += 1) {
    binary += String.fromCharCode(arr[i]);
  }
  return btoa(binary);
}

function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const arr = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    arr[i] = binary.charCodeAt(i);
  }
  return arr;
}

/**
 * Derive the user's field-encryption key from a secret only they control — e.g.
 * their wallet's signature over a fixed, domain-separated message. Derived in
 * the browser via HKDF-SHA256; the resulting AES-256-GCM key never leaves the
 * device and is non-extractable.
 */
export async function deriveClientKey(
  secret: string,
  salt = 'shiora:client-field:v1',
): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const baseKey = await subtle().importKey('raw', enc.encode(secret), 'HKDF', false, ['deriveKey']);
  return subtle().deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: enc.encode(salt), info: enc.encode('field-encryption') },
    baseKey,
    { name: ALG, length: KEY_BITS },
    false,
    ['encrypt', 'decrypt'],
  );
}

/** Seal a plaintext field in the browser. `aad` binds the ciphertext to context. */
export async function sealField(
  plaintext: string,
  key: CryptoKey,
  aad?: string,
): Promise<ClientSealedEnvelope> {
  const enc = new TextEncoder();
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const params: AesGcmParams = { name: ALG, iv };
  if (aad !== undefined) {
    params.additionalData = enc.encode(aad);
  }
  const ct = await subtle().encrypt(params, key, enc.encode(plaintext));
  return { v: ENVELOPE_VERSION, alg: 'A256GCM', iv: toBase64(iv), ct: toBase64(ct) };
}

/** Open a client-sealed field. Throws if the key, AAD, or ciphertext is wrong. */
export async function openField(
  envelope: ClientSealedEnvelope,
  key: CryptoKey,
  aad?: string,
): Promise<string> {
  const enc = new TextEncoder();
  const params: AesGcmParams = { name: ALG, iv: fromBase64(envelope.iv) as BufferSource };
  if (aad !== undefined) {
    params.additionalData = enc.encode(aad);
  }
  const plaintext = await subtle().decrypt(params, key, fromBase64(envelope.ct) as BufferSource);
  return new TextDecoder().decode(plaintext);
}

/** Whether a value is a client-sealed envelope (vs server-side data). */
export function isClientSealed(value: unknown): value is ClientSealedEnvelope {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as Partial<ClientSealedEnvelope>;
  return candidate.alg === 'A256GCM'
    && typeof candidate.iv === 'string'
    && typeof candidate.ct === 'string';
}
