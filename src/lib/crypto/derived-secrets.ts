// ============================================================
// Shiora on Aethelred — Domain-separated key derivation
//
// The platform holds one high-entropy root secret (SHIORA_SESSION_SECRET,
// KMS/Vault-managed in production). Using that root directly for multiple
// unrelated HMAC purposes is a key-reuse smell: a weakness or oracle in one
// protocol could, in principle, bleed into another. Instead we derive a
// distinct, purpose-bound 256-bit subkey per use via HKDF-SHA256 with a unique
// `info` label (RFC 5869 domain separation), so the subkeys are cryptograph
// ically independent and no single subkey reveals the root or a sibling.
//
// Subkeys are cached per label; a session-secret change requires a fresh
// process (or __resetDerivedSecretsForTests in tests).
// ============================================================

import crypto from 'node:crypto';

import { serverEnv } from '@/lib/api/env';

const HKDF_HASH = 'sha256';
const SUBKEY_BYTES = 32; // 256-bit subkeys

// Purpose labels — never reuse a label for two different purposes.
const SESSION_MAC_INFO = 'shiora/session-hmac/v1';
const CHALLENGE_MAC_INFO = 'shiora/challenge-hmac/v1';
const AUDIT_MAC_INFO = 'shiora/audit-chain-mac/v1';
const STEP_UP_MAC_INFO = 'shiora/mfa-stepup/v1';
const BLIND_INDEX_INFO = 'shiora/blind-index/v1';

const cache = new Map<string, Buffer>();

function deriveSubkey(info: string): Buffer {
  // Root secret comes from serverEnv.sessionSecret, which throws in production
  // when unset — so derivation fails closed rather than using a weak key.
  const ikm = Buffer.from(serverEnv.sessionSecret, 'utf8');
  const salt = Buffer.alloc(0); // fixed root already high-entropy; label is the separator
  const derived = crypto.hkdfSync(HKDF_HASH, ikm, salt, Buffer.from(info, 'utf8'), SUBKEY_BYTES);
  return Buffer.from(derived);
}

function keyFor(info: string): Buffer {
  let key = cache.get(info);
  if (!key) {
    key = deriveSubkey(info);
    cache.set(info, key);
  }
  return key;
}

/** HMAC key for signing stateless session tokens. */
export function sessionSigningKey(): Buffer {
  return keyFor(SESSION_MAC_INFO);
}

/** HMAC key for binding authentication challenges to this server. */
export function challengeSigningKey(): Buffer {
  return keyFor(CHALLENGE_MAC_INFO);
}

/** HMAC key for short-lived MFA step-up assertions (GAP-07). */
export function stepUpSigningKey(): Buffer {
  return keyFor(STEP_UP_MAC_INFO);
}

/** HMAC key for deterministic blind indexes over sealed fields (GAP-15). */
export function blindIndexKey(): Buffer {
  return keyFor(BLIND_INDEX_INFO);
}

/**
 * HMAC key for the tamper-evident audit chain. Because it is derived from the
 * root secret (config/Vault, never the application database), an actor with
 * write access to the audit tables cannot forge or recompute the chain without
 * also holding this key.
 */
export function auditChainKey(): Buffer {
  return keyFor(AUDIT_MAC_INFO);
}

/** Test-only: clear the subkey cache so a changed root secret takes effect. */
export function __resetDerivedSecretsForTests(): void {
  cache.clear();
}
