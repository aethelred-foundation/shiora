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
//   • A version tag is stored with every record so the KEK can be rotated
//     without rewriting historical ciphertext eagerly.
//   • Additional Authenticated Data (AAD) cryptographically binds a record's
//     ciphertext to its context (e.g. `owner:recordId`). A ciphertext lifted
//     from one record and replayed under another context fails to decrypt —
//     this defeats ciphertext-substitution attacks.
//
// KEY CUSTODY (read before production):
//   In this build the KEK is read from the environment. That is acceptable
//   for testnet/preview, but for production the KEK MUST be held in a managed
//   KMS/HSM (AWS KMS, GCP KMS, HashiCorp Vault Transit) and this module's
//   `wrapDek`/`unwrapDek` should delegate to it. See docs/COMPLIANCE.md →
//   control C-ENC-2. The env-based KEK is a single point of compromise and is
//   intentionally gated to throw in production unless explicitly configured.
// ============================================================

import crypto from 'node:crypto';
import { z } from 'zod';

const ALGORITHM = 'aes-256-gcm';
const KEY_BYTES = 32; // 256-bit keys
const IV_BYTES = 12; // 96-bit nonce — the recommended size for GCM
const DEK_AAD = 'shiora/dek-wrap/v1';

/** Current KEK version stamped onto every sealed value (enables rotation). */
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
// KEK accessor — mirrors the lazy, production-throwing pattern in env.ts so
// `next build` can collect pages without a configured key, while every real
// runtime path that encrypts/decrypts fails loudly if the key is missing.
// ---------------------------------------------------------------------------

const KekSchema = z.string().optional();

function decodeKek(raw: string): Buffer {
  // Accept either base64 (44 chars for 32 bytes) or hex (64 chars).
  const buf = /^[0-9a-fA-F]{64}$/.test(raw)
    ? Buffer.from(raw, 'hex')
    : Buffer.from(raw, 'base64');

  if (buf.length !== KEY_BYTES) {
    throw new Error(
      `SHIORA_DATA_ENCRYPTION_KEY must decode to ${KEY_BYTES} bytes `
      + `(got ${buf.length}). Generate one with: openssl rand -base64 32`,
    );
  }
  return buf;
}

let _cachedKek: Buffer | null = null;

/**
 * Resolve the Key Encryption Key. Throws in production when unset so PHI is
 * never silently encrypted under a known development key. In development/test
 * a deterministic, clearly-insecure fallback is derived so the suite runs
 * without configuration — identical in spirit to the session-secret fallback.
 */
function getKek(): Buffer {
  if (_cachedKek) return _cachedKek;

  const raw = KekSchema.parse(process.env.SHIORA_DATA_ENCRYPTION_KEY);
  const isProduction = process.env.NODE_ENV === 'production';

  if (!raw) {
    if (isProduction) {
      throw new Error(
        'SHIORA_DATA_ENCRYPTION_KEY must be set in production. '
        + 'Generate one with: openssl rand -base64 32 (and store it in a KMS/HSM).',
      );
    }
    // Development/test fallback — deterministic and NOT secret. Never reached
    // in production because of the throw above.
    _cachedKek = crypto
      .createHash('sha256')
      .update('shiora-dev-data-encryption-key-change-me-before-production')
      .digest();
    return _cachedKek;
  }

  _cachedKek = decodeKek(raw);
  return _cachedKek;
}

/** Test-only: clear the cached KEK so env changes take effect between cases. */
export function __resetKekCacheForTests(): void {
  _cachedKek = null;
}

/** True when a real (non-fallback) KEK is configured. */
export function hasConfiguredDataKey(): boolean {
  return !!process.env.SHIORA_DATA_ENCRYPTION_KEY;
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
 * Seal a UTF-8 string as PHI at rest. `aad`, when provided, is authenticated
 * (not encrypted) and must be supplied identically to {@link openString};
 * use it to bind ciphertext to its owner/record context.
 */
export function sealString(plaintext: string, aad?: string): SealedEnvelope {
  const kek = getKek();
  const dek = crypto.randomBytes(KEY_BYTES);

  const aadBuf = aad ? Buffer.from(aad, 'utf8') : undefined;
  const payload = gcmEncrypt(dek, Buffer.from(plaintext, 'utf8'), aadBuf);

  const wrapped = gcmEncrypt(kek, dek, Buffer.from(DEK_AAD, 'utf8'));
  // Defence-in-depth: drop the plaintext DEK from memory promptly.
  dek.fill(0);

  return {
    v: KEK_VERSION,
    alg: ALGORITHM,
    dek: packWrappedDek(wrapped.iv, wrapped.tag, wrapped.ciphertext),
    iv: payload.iv.toString('base64url'),
    tag: payload.tag.toString('base64url'),
    ct: payload.ciphertext.toString('base64url'),
    ...(aad ? { aad } : {}),
  };
}

/**
 * Open a value sealed by {@link sealString}. Throws if the KEK is wrong, the
 * ciphertext was tampered with, or `aad` does not match the seal-time value.
 */
export function openString(envelope: SealedEnvelope, aad?: string): string {
  if (envelope.alg !== ALGORITHM) {
    throw new Error(`Unsupported envelope algorithm: ${envelope.alg}`);
  }
  if (envelope.v !== KEK_VERSION) {
    throw new Error(`Unknown KEK version: ${envelope.v}`);
  }

  const kek = getKek();
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
