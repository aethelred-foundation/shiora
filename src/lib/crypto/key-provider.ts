// ============================================================
// Shiora on Aethelred — Key Provider (KEK custody seam)
//
// Resolves the Key Encryption Key (KEK) used to wrap per-record DEKs. This is
// the single seam between envelope encryption and key custody: the default
// implementation reads keys from the environment, and a production deployment
// replaces it with a KMS/HSM-backed provider implementing the same interface
// (COMPLIANCE.md C-ENC-2).
//
// Rotation: a sealed value records the KEK *version* it was wrapped under, so
// the current key can be rotated while historical ciphertext still decrypts
// under its original version's key. The current key is
// SHIORA_DATA_ENCRYPTION_KEY at version SHIORA_DATA_ENCRYPTION_KEY_VERSION
// (default 1); a superseded key is kept available as
// SHIORA_DATA_ENCRYPTION_KEY_V<n>.
// ============================================================

import crypto from 'node:crypto';
import { decodeKey } from './key-codec';
import { VaultKeyProvider, isVaultConfigured } from './vault-key-provider';

const DEV_FALLBACK_SEED = 'shiora-dev-data-encryption-key-change-me-before-production';

export interface KeyProvider {
  /** The KEK version that new data is sealed under. */
  currentVersion(): number;
  /** The 32-byte KEK for a given version. Throws if it is unavailable. */
  keyForVersion(version: number): Buffer;
  /**
   * Optional async warm-up for providers whose key custody is a network call
   * (e.g. Vault). Invoked once at startup (instrumentation.ts) before any PHI is
   * served, so keyForVersion() can remain synchronous.
   */
  preload?(): Promise<void>;
}

/**
 * Environment-backed KeyProvider with rotation support. Resolved keys are
 * cached per version on the instance, so env changes require a fresh provider
 * (see {@link __resetKeyProviderForTests}).
 */
export class EnvKeyProvider implements KeyProvider {
  private readonly cache = new Map<number, Buffer>();

  currentVersion(): number {
    const raw = process.env.SHIORA_DATA_ENCRYPTION_KEY_VERSION;
    const version = raw ? Number(raw) : 1;
    if (!Number.isInteger(version) || version < 1) {
      throw new Error('SHIORA_DATA_ENCRYPTION_KEY_VERSION must be a positive integer.');
    }
    return version;
  }

  keyForVersion(version: number): Buffer {
    const cached = this.cache.get(version);
    if (cached) {
      return cached;
    }
    const key = this.resolve(version);
    this.cache.set(version, key);
    return key;
  }

  private resolve(version: number): Buffer {
    // A superseded key kept available for decrypting historical ciphertext.
    const historical = process.env[`SHIORA_DATA_ENCRYPTION_KEY_V${version}`];
    if (historical) {
      return decodeKey(historical);
    }

    // The current version is served by the primary key.
    if (version === this.currentVersion()) {
      const primary = process.env.SHIORA_DATA_ENCRYPTION_KEY;
      if (primary) {
        return decodeKey(primary);
      }
      if (process.env.NODE_ENV === 'production') {
        throw new Error(
          'SHIORA_DATA_ENCRYPTION_KEY must be set in production. '
          + 'Generate one with: openssl rand -base64 32 (and store it in a KMS/HSM).',
        );
      }
      // Development/test fallback — deterministic and NOT secret. Never reached
      // in production because of the throw above.
      return crypto.createHash('sha256').update(DEV_FALLBACK_SEED).digest();
    }

    throw new Error(`No data encryption key available for version ${version}.`);
  }
}

let provider: KeyProvider | null = null;

/**
 * The process-wide key provider. Vault-backed when Vault is configured (the
 * production posture — KEK custody outside application config), otherwise
 * env-backed for local development and tests.
 */
export function getKeyProvider(): KeyProvider {
  if (!provider) {
    provider = isVaultConfigured() ? new VaultKeyProvider() : new EnvKeyProvider();
  }
  return provider;
}

/**
 * Warm up the key provider before serving PHI. A no-op for providers without a
 * preload step (env-backed); for Vault it fetches and caches the KEK once.
 */
export async function preloadKeyProvider(): Promise<void> {
  const active = getKeyProvider();
  if (active.preload) {
    await active.preload();
  }
}

/**
 * True when real KEK custody is configured — either an explicit env key
 * (dev/test) or a Vault-backed KEK (production).
 */
export function hasConfiguredDataKey(): boolean {
  return !!process.env.SHIORA_DATA_ENCRYPTION_KEY || isVaultConfigured();
}

/** Test-only: drop the cached provider so env changes take effect. */
export function __resetKeyProviderForTests(): void {
  provider = null;
}
