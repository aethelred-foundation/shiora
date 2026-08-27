// ============================================================
// Shiora on Aethelred — Vault-backed Key Provider (KMS/HSM custody)
//
// Closes audit Finding F4 / risk R-1: in production the Key Encryption Key must
// NOT be a plaintext environment value. This provider keeps the KEK in
// HashiCorp Vault (KV v2) and reads it once at boot over an authenticated,
// access-controlled, audited channel — the plaintext key never lives in app
// config, only inside Vault.
//
// The KEK secret in Vault is a KV v2 entry whose fields are:
//   current_version : "1"                  (the version new data is sealed under)
//   v1, v2, ...      : <base64|hex 32-byte key per version>
// so a key can be rotated (bump current_version, add v2) while historical
// ciphertext still decrypts under its original version — mirroring EnvKeyProvider.
//
// preload() is async (Vault is a network call); it is invoked once at startup
// from instrumentation.ts before any PHI is served. keyForVersion() then serves
// the cached key synchronously, satisfying the envelope's sync interface.
// ============================================================

import type { KeyProvider } from './key-provider';
import { decodeKey } from './key-codec';

/** True when every Vault setting needed to fetch the KEK is configured. */
export function isVaultConfigured(): boolean {
  return Boolean(
    process.env.SHIORA_VAULT_ADDR
    && process.env.SHIORA_VAULT_TOKEN
    && process.env.SHIORA_VAULT_KEK_PATH,
  );
}

interface VaultKvV2Response {
  data?: { data?: Record<string, string> };
}

export class VaultKeyProvider implements KeyProvider {
  private readonly cache = new Map<number, Buffer>();
  private current = 0;
  private loaded = false;

  currentVersion(): number {
    if (!this.loaded) {
      throw new Error('VaultKeyProvider.preload() must run before key access.');
    }
    return this.current;
  }

  keyForVersion(version: number): Buffer {
    const key = this.cache.get(version);
    if (!key) {
      throw new Error(
        `No data encryption key available for version ${version} from Vault `
        + '(ensure preload() ran and the key version exists in the Vault secret).',
      );
    }
    return key;
  }

  /** Fetch and cache the KEK(s) from Vault. Idempotent; throws on any problem. */
  async preload(): Promise<void> {
    const addr = process.env.SHIORA_VAULT_ADDR;
    const token = process.env.SHIORA_VAULT_TOKEN;
    const path = process.env.SHIORA_VAULT_KEK_PATH;
    if (!addr || !token || !path) {
      throw new Error(
        'Vault is not fully configured (SHIORA_VAULT_ADDR, SHIORA_VAULT_TOKEN, '
        + 'SHIORA_VAULT_KEK_PATH are all required).',
      );
    }

    const url = `${addr.replace(/\/+$/, '')}/v1/${path.replace(/^\/+/, '')}`;
    let res: Awaited<ReturnType<typeof fetch>>;
    try {
      res = await fetch(url, { headers: { 'X-Vault-Token': token } });
    } catch {
      throw new Error(
        `Vault is unreachable at ${addr}. Production PHI key custody requires Vault.`,
      );
    }
    if (!res.ok) {
      throw new Error(`Vault read failed (HTTP ${res.status}) for KEK path '${path}'.`);
    }

    const body = (await res.json()) as VaultKvV2Response;
    const data = body.data?.data;
    if (!data) {
      throw new Error(`Vault secret at '${path}' has no KV v2 data payload.`);
    }

    const current = data.current_version ? Number(data.current_version) : NaN;
    if (!Number.isInteger(current) || current < 1) {
      throw new Error(
        "Vault KEK secret must include a positive integer 'current_version' field.",
      );
    }

    const next = new Map<number, Buffer>();
    for (const [field, value] of Object.entries(data)) {
      const match = /^v(\d+)$/.exec(field);
      if (match) {
        next.set(Number(match[1]), decodeKey(value));
      }
    }
    if (!next.has(current)) {
      throw new Error(
        `Vault KEK secret has no key material (field 'v${current}') for current_version ${current}.`,
      );
    }

    this.cache.clear();
    next.forEach((key, version) => this.cache.set(version, key));
    this.current = current;
    this.loaded = true;
  }
}
