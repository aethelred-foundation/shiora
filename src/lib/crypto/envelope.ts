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
//   • The DEK itself is encrypted ("wrapped") through the DekWrapper custody
//     seam (src/lib/crypto/dek-wrapper.ts). Only the wrapped DEK is
//     persisted; the plaintext DEK never touches disk.
//   • The wrapping-key *version* is stored with every record so the key can
//     be rotated without rewriting historical ciphertext: new data is sealed
//     under the current version, and old data still opens under its original
//     version's key for as long as that key remains available.
//   • Additional Authenticated Data (AAD) cryptographically binds a record's
//     ciphertext to its context (e.g. `owner:recordId`). A ciphertext lifted
//     from one record and replayed under another context fails to decrypt —
//     this defeats ciphertext-substitution attacks.
//
// KEY CUSTODY: every seal wraps its DEK through getDekWrapper() — the local
// in-process KEK for development, Vault Transit in production (the master key
// never enters application memory; see docs/KEY_MANAGEMENT.md §Custody model).
// Envelopes record which backend wrapped their DEK (`wrap`), so mixed-custody
// reads work throughout a migration: envelopes sealed before the DekWrapper
// adoption carry no `wrap` field and keep opening through the legacy inline
// local-KEK path until the re-seal job rewrites them.
// ============================================================

import crypto from 'node:crypto';

import {
  DEK_WRAP_AAD,
  LocalKekDekWrapper,
  getDekWrapper,
  type DekWrapper,
  type WrapBackend,
} from './dek-wrapper';
import { getKeyProvider } from './key-provider';

const ALGORITHM = 'aes-256-gcm';
const KEY_BYTES = 32; // 256-bit keys
const IV_BYTES = 12; // 96-bit nonce — the recommended size for GCM

/** Default KEK version when no rotation has occurred. */
export const KEK_VERSION = 1 as const;

/**
 * A sealed PHI value. Every field is non-secret on its own — the plaintext is
 * recoverable only with the wrapping key plus (if set at seal time) the
 * matching AAD.
 */
export interface SealedEnvelope {
  /** Wrapping-key version the DEK is bound to (KEK or Transit key version). */
  v: number;
  /** Authenticated-encryption algorithm identifier. */
  alg: typeof ALGORITHM;
  /**
   * Custody backend that wrapped the DEK. Absent on envelopes sealed before
   * the DekWrapper adoption, which carry the legacy inline local-KEK wrap
   * (`iv:tag:ciphertext`, AAD-bound to the DEK-wrap domain) in `dek`.
   */
  wrap?: WrapBackend;
  /** Backend-opaque wrapped DEK (legacy: base64url `iv:tag:ciphertext`). */
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

// ---------------------------------------------------------------------------
// DEK custody
// ---------------------------------------------------------------------------

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

let historicalLocalWrapper: LocalKekDekWrapper | null = null;

/**
 * The wrapper able to unwrap an envelope wrapped by `backend`. During a
 * custody migration (local KEK → Vault Transit) historical local-KEK envelopes
 * must stay readable until the re-seal job has rewritten them, so a local
 * unwrapping path remains available while Transit is active. The reverse is
 * refused: a Transit-wrapped envelope opens ONLY through Vault (fail-closed).
 */
function wrapperFor(backend: WrapBackend): DekWrapper {
  const active = getDekWrapper();
  if (active.backend === backend) {
    return active;
  }
  if (backend === 'local-kek') {
    historicalLocalWrapper ??= new LocalKekDekWrapper();
    return historicalLocalWrapper;
  }
  throw new Error(
    'Envelope is bound to Vault Transit custody, but Transit is not configured; refusing to open.',
  );
}

async function unwrapDek(envelope: SealedEnvelope): Promise<Buffer> {
  if (!envelope.wrap) {
    // Legacy pre-adoption format: DEK wrapped inline under the local KEK,
    // colon-packed and AAD-bound to the DEK-wrap domain.
    const kek = getKeyProvider().keyForVersion(envelope.v);
    const wrapped = unpackWrappedDek(envelope.dek);
    return gcmDecrypt(kek, wrapped.iv, wrapped.tag, wrapped.ciphertext, Buffer.from(DEK_WRAP_AAD, 'utf8'));
  }
  return wrapperFor(envelope.wrap).unwrap({
    ciphertext: envelope.dek,
    keyVersion: envelope.v,
    backend: envelope.wrap,
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Seal a UTF-8 string as PHI at rest, wrapping the DEK through the active
 * custody backend at its current key version. `aad`, when provided, is
 * authenticated (not encrypted) and must be supplied identically to
 * {@link openString}; use it to bind ciphertext to its owner/record context.
 */
export async function sealString(plaintext: string, aad?: string): Promise<SealedEnvelope> {
  const dek = crypto.randomBytes(KEY_BYTES);
  try {
    const aadBuf = aad ? Buffer.from(aad, 'utf8') : undefined;
    const payload = gcmEncrypt(dek, Buffer.from(plaintext, 'utf8'), aadBuf);
    const wrapped = await getDekWrapper().wrap(dek);

    return {
      v: wrapped.keyVersion,
      alg: ALGORITHM,
      wrap: wrapped.backend,
      dek: wrapped.ciphertext,
      iv: payload.iv.toString('base64url'),
      tag: payload.tag.toString('base64url'),
      ct: payload.ciphertext.toString('base64url'),
      ...(aad ? { aad } : {}),
    };
  } finally {
    // Defence-in-depth: drop the plaintext DEK from memory promptly.
    dek.fill(0);
  }
}

/**
 * Open a value sealed by {@link sealString}, unwrapping its DEK through the
 * custody backend recorded on the envelope. Throws if that backend or key
 * version is unavailable, the ciphertext was tampered with, or `aad` does not
 * match the seal-time value.
 */
export async function openString(envelope: SealedEnvelope, aad?: string): Promise<string> {
  if (isShredded(envelope)) {
    throw new Error('Cannot open a crypto-shredded value: its key was destroyed during erasure.');
  }
  if (envelope.alg !== ALGORITHM) {
    throw new Error(`Unsupported envelope algorithm: ${envelope.alg}`);
  }

  const dek = await unwrapDek(envelope);
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
export async function sealJson<T>(value: T, aad?: string): Promise<SealedEnvelope> {
  return sealString(JSON.stringify(value), aad);
}

/** Open a value sealed by {@link sealJson}. */
export async function openJson<T>(envelope: SealedEnvelope, aad?: string): Promise<T> {
  return JSON.parse(await openString(envelope, aad)) as T;
}

/** Structural type guard — true when `value` looks like a {@link SealedEnvelope}. */
export function isSealed(value: unknown): value is SealedEnvelope {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.v === 'number'
    && v.alg === ALGORITHM
    && (v.wrap === undefined || v.wrap === 'local-kek' || v.wrap === 'vault-transit')
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
// disk, recoverable by whoever holds the wrapping key. Crypto-erasure instead
// destroys the wrapped DEK: because the per-record DEK is the ONLY key that
// can decrypt the payload, and it exists nowhere else, discarding it makes the
// ciphertext permanently unrecoverable — by anyone, including the operator.
// What remains is a tombstone: proof that erasure happened, carrying no
// recoverable data.
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

// ---------------------------------------------------------------------------
// KEK re-sealing (rotation completeness — GAP-14)
//
// Versioned rotation lets new writes use a fresh wrapping key while old
// ciphertext still opens under its original key. But rotation's benefit —
// retiring a potentially-exposed key — is only realized once NO data still
// depends on it. Re-sealing decrypts a value under its old custody and
// re-encrypts it under the current one (a new random DEK, wrapped by the
// active backend), preserving the exact plaintext and AAD binding. The same
// pass migrates custody: legacy pre-adoption envelopes and envelopes wrapped
// by a superseded backend are rewritten into the active one.
// ---------------------------------------------------------------------------

/** A snapshot of the active custody: which backend wraps DEKs, at what version. */
export interface SealCustody {
  backend: WrapBackend;
  keyVersion: number;
}

/**
 * The custody new seals are wrapped under right now. The version is learned by
 * wrapping a throwaway probe DEK — the one mechanism every backend supports:
 * the application's Vault policy is scoped to `encrypt`/`decrypt` only, so the
 * Transit key's metadata cannot be read directly.
 */
export async function currentSealCustody(): Promise<SealCustody> {
  const wrapper = getDekWrapper();
  const probe = await wrapper.wrap(crypto.randomBytes(KEY_BYTES));
  return { backend: wrapper.backend, keyVersion: probe.keyVersion };
}

/**
 * True when a sealed value should be re-sealed under the given custody: it was
 * wrapped by a different backend (including the legacy pre-adoption format,
 * which carries no `wrap` field) or by a superseded key version of the same
 * backend. Take the {@link currentSealCustody} snapshot once per re-seal run.
 */
export function needsReseal(sealed: SealedEnvelope, custody: SealCustody): boolean {
  if (sealed.wrap !== custody.backend) {
    return true;
  }
  return sealed.v < custody.keyVersion;
}

/**
 * Re-seal a value under the active custody backend at its current version,
 * preserving its AAD binding. The same `aad` used at seal time must be
 * supplied. Throws if the value cannot be opened (wrong AAD, missing
 * historical key, tampering).
 */
export async function resealString(sealed: SealedEnvelope, aad?: string): Promise<SealedEnvelope> {
  return sealString(await openString(sealed, aad), aad);
}
