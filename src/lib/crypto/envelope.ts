// ============================================================
// Shiora on Aethelred — PHI Envelope Encryption (at rest)
//
// Implements authenticated envelope encryption for Protected Health
// Information (PHI) stored at rest, satisfying the encryption controls in
// HIPAA Security Rule §164.312(a)(2)(iv) and §164.312(e)(2)(ii).
//
// Design — envelope encryption (the same pattern AWS KMS / GCP KMS use):
//   • Each value is encrypted under a fresh, random 256-bit Data Encryption
//     Key (DEK) using AES-256-GCM (authenticated encryption).
//   • The DEK itself is encrypted ("wrapped") under a long-lived Key
//     Encryption Key (KEK) — also AES-256-GCM. Only the wrapped DEK is
//     persisted; the plaintext DEK never touches disk.
//   • The KEK *version* is stored with every record so the key can be rotated
//     without rewriting historical ciphertext: new data is sealed under the
//     current version, and old data still opens under its original version's
//     key for as long as that key remains available.
//   • Additional Authenticated Data (AAD) cryptographically binds a record's
//     ciphertext to its context (e.g. `owner:recordId`). A ciphertext lifted
//     from one record and replayed under another context fails to decrypt —
//     this defeats ciphertext-substitution attacks.
//
// KEY CUSTODY: the KEK is resolved through the KeyProvider seam
// (src/lib/crypto/key-provider.ts). The default provider reads keys from the
// environment; production replaces it with a KMS/HSM-backed provider
// implementing the same interface. See docs/COMPLIANCE.md → control C-ENC-2.
// ============================================================

import crypto from 'node:crypto';

import { getKeyProvider } from './key-provider';

const ALGORITHM = 'aes-256-gcm';
const KEY_BYTES = 32; // 256-bit keys
const IV_BYTES = 12; // 96-bit nonce — the recommended size for GCM
const DEK_AAD = 'shiora/dek-wrap/v1';

/** Default KEK version when no rotation has occurred. */
export const KEK_VERSION = 1 as const;

/**
 * A sealed PHI value. Every field is non-secret on its own — the plaintext is
 * recoverable only with the KEK plus (if set at seal time) the matching AAD.
 */
export interface SealedEnvelope {
  /** KEK version used to wrap the DEK. */
  v: number;
  /** Authenticated-encryption algorithm identifier. */
  alg: typeof ALGORITHM;
  /** base64url — DEK wrapped under the KEK, as `iv:authTag:ciphertext`. */
  dek: string;
  /** base64url — IV used to encrypt the payload under the DEK. */
  iv: string;
  /** base64url — GCM authentication tag for the payload. */
  tag: string;
  /** base64url — the encrypted payload. */
  ct: string;
  /** Optional context string bound into the payload's AAD. */
  aad?: string;
}

// ---------------------------------------------------------------------------
// Low-level AES-256-GCM helpers
// ---------------------------------------------------------------------------

function gcmEncrypt(key: Buffer, plaintext: Buffer, aad?: Buffer): {
  iv: Buffer;
  tag: Buffer;
  ciphertext: Buffer;
} {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  if (aad) cipher.setAAD(aad);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return { iv, tag: cipher.getAuthTag(), ciphertext };
}

function gcmDecrypt(
  key: Buffer,
  iv: Buffer,
  tag: Buffer,
  ciphertext: Buffer,
  aad?: Buffer,
): Buffer {
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  if (aad) decipher.setAAD(aad);
  decipher.setAuthTag(tag);
  // .final() throws if the tag (and therefore integrity/authenticity) fails.
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

function packWrappedDek(iv: Buffer, tag: Buffer, ciphertext: Buffer): string {
  return [
    iv.toString('base64url'),
    tag.toString('base64url'),
    ciphertext.toString('base64url'),
  ].join(':');
}

function unpackWrappedDek(packed: string): { iv: Buffer; tag: Buffer; ciphertext: Buffer } {
  const [iv, tag, ciphertext] = packed.split(':');
  if (!iv || !tag || !ciphertext) {
    throw new Error('Malformed wrapped DEK');
  }
  return {
    iv: Buffer.from(iv, 'base64url'),
    tag: Buffer.from(tag, 'base64url'),
    ciphertext: Buffer.from(ciphertext, 'base64url'),
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Seal a UTF-8 string as PHI at rest under the current KEK version. `aad`, when
 * provided, is authenticated (not encrypted) and must be supplied identically
 * to {@link openString}; use it to bind ciphertext to its owner/record context.
 */
export function sealString(plaintext: string, aad?: string): SealedEnvelope {
  const provider = getKeyProvider();
  const version = provider.currentVersion();
  const kek = provider.keyForVersion(version);
  const dek = crypto.randomBytes(KEY_BYTES);

  const aadBuf = aad ? Buffer.from(aad, 'utf8') : undefined;
  const payload = gcmEncrypt(dek, Buffer.from(plaintext, 'utf8'), aadBuf);

  const wrapped = gcmEncrypt(kek, dek, Buffer.from(DEK_AAD, 'utf8'));
  // Defence-in-depth: drop the plaintext DEK from memory promptly.
  dek.fill(0);

  return {
    v: version,
    alg: ALGORITHM,
    dek: packWrappedDek(wrapped.iv, wrapped.tag, wrapped.ciphertext),
    iv: payload.iv.toString('base64url'),
    tag: payload.tag.toString('base64url'),
    ct: payload.ciphertext.toString('base64url'),
    ...(aad ? { aad } : {}),
  };
}

/**
 * Open a value sealed by {@link sealString}, using the KEK for the version it
 * was sealed under. Throws if that version's key is unavailable, the ciphertext
 * was tampered with, or `aad` does not match the seal-time value.
 */
export function openString(envelope: SealedEnvelope, aad?: string): string {
  if (isShredded(envelope)) {
    throw new Error('Cannot open a crypto-shredded value: its key was destroyed during erasure.');
  }
  if (envelope.alg !== ALGORITHM) {
    throw new Error(`Unsupported envelope algorithm: ${envelope.alg}`);
  }

  const kek = getKeyProvider().keyForVersion(envelope.v);
  const wrapped = unpackWrappedDek(envelope.dek);
  const dek = gcmDecrypt(
    kek,
    wrapped.iv,
    wrapped.tag,
    wrapped.ciphertext,
    Buffer.from(DEK_AAD, 'utf8'),
  );

  try {
    const aadBuf = aad ? Buffer.from(aad, 'utf8') : undefined;
    const plaintext = gcmDecrypt(
      dek,
      Buffer.from(envelope.iv, 'base64url'),
      Buffer.from(envelope.tag, 'base64url'),
      Buffer.from(envelope.ct, 'base64url'),
      aadBuf,
    );
    return plaintext.toString('utf8');
  } finally {
    dek.fill(0);
  }
}

/** Seal an arbitrary JSON-serializable value. */
export function sealJson<T>(value: T, aad?: string): SealedEnvelope {
  return sealString(JSON.stringify(value), aad);
}

/** Open a value sealed by {@link sealJson}. */
export function openJson<T>(envelope: SealedEnvelope, aad?: string): T {
  return JSON.parse(openString(envelope, aad)) as T;
}

/** Structural type guard — true when `value` looks like a {@link SealedEnvelope}. */
export function isSealed(value: unknown): value is SealedEnvelope {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.v === 'number'
    && v.alg === ALGORITHM
    && typeof v.dek === 'string'
    && typeof v.iv === 'string'
    && typeof v.tag === 'string'
    && typeof v.ct === 'string'
  );
}

// ---------------------------------------------------------------------------
// Crypto-shredding (GDPR Art. 17 erasure — GAP-13)
//
// Soft-deletion hides a record but leaves its ciphertext and wrapped DEK on
// disk, recoverable by whoever holds the KEK. Crypto-erasure instead destroys
// the wrapped DEK: because the per-record DEK is the ONLY key that can decrypt
// the payload, and it exists nowhere else, discarding it makes the ciphertext
// permanently unrecoverable — by anyone, including the operator. What remains
// is a tombstone: proof that erasure happened, carrying no recoverable data.
// ---------------------------------------------------------------------------

export const SHRED_MARKER = 'shredded' as const;

/**
 * The remains of a crypto-shredded value: the wrapped DEK and ciphertext are
 * gone, only the fact and time of erasure persist. Deliberately NOT a
 * {@link SealedEnvelope} — there is nothing left to open.
 */
export interface ShreddedEnvelope {
  alg: typeof ALGORITHM;
  shredded: typeof SHRED_MARKER;
  /** Epoch milliseconds when the DEK was destroyed. */
  shreddedAt: number;
}

/** Produce a shred tombstone to overwrite a sealed value during erasure. */
export function shredEnvelope(shreddedAt: number = Date.now()): ShreddedEnvelope {
  return { alg: ALGORITHM, shredded: SHRED_MARKER, shreddedAt };
}

/** True when a value has been crypto-shredded (its DEK destroyed). */
export function isShredded(value: unknown): value is ShreddedEnvelope {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return v.shredded === SHRED_MARKER && v.alg === ALGORITHM && typeof v.shreddedAt === 'number';
}
