// ============================================================
// Shiora on Aethelred — DEK wrapping seam (consultant P0, key custody)
//
// The external review's key-custody finding: the application should submit
// per-record data keys (DEKs) for wrapping/unwrapping and should not hold the
// master key in process memory as the default production design. This module
// is that seam. Two complete implementations:
//
//   LocalKekDekWrapper   — wraps DEKs with the in-process KEK (KeyProvider).
//                          Today's envelope behavior, expressed through the
//                          seam. Dev/single-tenant appropriate.
//   VaultTransitDekWrapper — wraps/unwraps via HashiCorp Vault's Transit
//                          engine. The master key NEVER leaves Vault; the app
//                          sends the DEK for encryption and the ciphertext for
//                          decryption. Rotation is a Vault-side key rotation;
//                          revocation is deleting the app's token/policy.
//
// Selection: Transit when SHIORA_TRANSIT_KEY_NAME (+ Vault addr/token) is
// configured, else the local KEK. Adopted: the PHI envelope path
// (src/lib/crypto/envelope.ts) wraps and unwraps every DEK through
// getDekWrapper(), so this seam IS the production custody path
// (docs/KEY_MANAGEMENT.md §Adoption). Everything here is fail-closed: any
// transport, status, or shape surprise throws rather than degrading.
// ============================================================

import crypto from 'node:crypto';

import { getKeyProvider } from './key-provider';
import { counter } from '@/lib/observability/metrics';

export type WrapBackend = 'local-kek' | 'vault-transit';

// New DEK wraps by custody backend. In production this must show ZERO
// local-kek wraps (all new writes go through Vault Transit, consultant §7);
// a non-zero local-kek count in production is a custody regression.
const dekWrapTotal = counter(
  'shiora_dek_wrap_total',
  'DEK wrap operations, by custody backend',
);

export interface WrappedDek {
  /** Backend-opaque ciphertext of the DEK. */
  ciphertext: string;
  /** Wrapping-key version the ciphertext is bound to. */
  keyVersion: number;
  backend: WrapBackend;
}

export interface DekWrapper {
  readonly backend: WrapBackend;
  wrap(dek: Buffer): Promise<WrappedDek>;
  unwrap(wrapped: WrappedDek): Promise<Buffer>;
}

// ── Local KEK (in-process) ──────────────────────────────────────────────────

const GCM_IV_BYTES = 12;

/**
 * Domain separator (AAD) binding a local-KEK DEK wrap to its purpose: a GCM
 * ciphertext produced under the same KEK for any other purpose cannot be
 * presented as a wrapped DEK. The same domain string has bound the envelope's
 * inline DEK wrap since v1, so legacy envelopes unwrap under this constant too.
 */
export const DEK_WRAP_AAD = 'shiora/dek-wrap/v1';

/** AES-256-GCM DEK wrapping under the KeyProvider KEK (in-process custody). */
export class LocalKekDekWrapper implements DekWrapper {
  readonly backend: WrapBackend = 'local-kek';

  async wrap(dek: Buffer): Promise<WrappedDek> {
    dekWrapTotal.inc({ backend: this.backend });
    const provider = getKeyProvider();
    const version = provider.currentVersion();
    const iv = crypto.randomBytes(GCM_IV_BYTES);
    const cipher = crypto.createCipheriv('aes-256-gcm', provider.keyForVersion(version), iv);
    cipher.setAAD(Buffer.from(DEK_WRAP_AAD, 'utf8'));
    const wrapped = Buffer.concat([cipher.update(dek), cipher.final()]);
    const tag = cipher.getAuthTag();
    return {
      ciphertext: Buffer.concat([iv, tag, wrapped]).toString('base64'),
      keyVersion: version,
      backend: this.backend,
    };
  }

  async unwrap(wrapped: WrappedDek): Promise<Buffer> {
    const raw = Buffer.from(wrapped.ciphertext, 'base64');
    const iv = raw.subarray(0, GCM_IV_BYTES);
    const tag = raw.subarray(GCM_IV_BYTES, GCM_IV_BYTES + 16);
    const body = raw.subarray(GCM_IV_BYTES + 16);
    const key = getKeyProvider().keyForVersion(wrapped.keyVersion);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAAD(Buffer.from(DEK_WRAP_AAD, 'utf8'));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(body), decipher.final()]);
  }
}

// ── Vault Transit ───────────────────────────────────────────────────────────

export interface TransitConfig {
  addr: string;
  token: string;
  keyName: string;
}

/** True when every setting needed for Transit custody is configured. */
export function isTransitConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return !!(env.SHIORA_VAULT_ADDR && env.SHIORA_VAULT_TOKEN && env.SHIORA_TRANSIT_KEY_NAME);
}

function transitConfigFromEnv(): TransitConfig {
  if (!isTransitConfigured()) {
    throw new Error(
      'Vault Transit custody requires SHIORA_VAULT_ADDR, SHIORA_VAULT_TOKEN and SHIORA_TRANSIT_KEY_NAME.',
    );
  }
  return {
    addr: process.env.SHIORA_VAULT_ADDR!,
    token: process.env.SHIORA_VAULT_TOKEN!,
    keyName: process.env.SHIORA_TRANSIT_KEY_NAME!,
  };
}

function assertTlsAddr(addr: string): void {
  const url = new URL(addr);
  const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '::1';
  if (url.protocol !== 'https:' && !local) {
    throw new Error('SHIORA_VAULT_ADDR must use https for a non-local Vault (key material in transit).');
  }
}

/** Parse the key version out of a Transit ciphertext (`vault:v<N>:...`). */
export function transitKeyVersion(ciphertext: string): number {
  const match = /^vault:v(\d+):/.exec(ciphertext);
  if (!match) {
    throw new Error('Unrecognized Vault Transit ciphertext format.');
  }
  return Number(match[1]);
}

/**
 * DEK wrapping via Vault Transit encrypt/decrypt. The master key lives only in
 * Vault; every operation is an authenticated HTTPS call. Fail-closed.
 */
export class VaultTransitDekWrapper implements DekWrapper {
  readonly backend: WrapBackend = 'vault-transit';
  private readonly config: TransitConfig;

  constructor(config?: TransitConfig) {
    this.config = config ?? transitConfigFromEnv();
    assertTlsAddr(this.config.addr);
  }

  private async post(operation: 'encrypt' | 'decrypt', body: Record<string, string>): Promise<Record<string, string>> {
    const url = `${this.config.addr.replace(/\/$/, '')}/v1/transit/${operation}/${encodeURIComponent(this.config.keyName)}`;
    let res: Awaited<ReturnType<typeof fetch>>;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'X-Vault-Token': this.config.token, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch (err) {
      throw new Error(`Vault Transit ${operation} unreachable: ${err instanceof Error ? err.message : String(err)}`);
    }
    if (!res.ok) {
      throw new Error(`Vault Transit ${operation} failed with status ${res.status}.`);
    }
    const payload = (await res.json()) as { data?: Record<string, string> };
    if (!payload.data) {
      throw new Error(`Vault Transit ${operation} returned an unexpected payload shape.`);
    }
    return payload.data;
  }

  async wrap(dek: Buffer): Promise<WrappedDek> {
    dekWrapTotal.inc({ backend: this.backend });
    const data = await this.post('encrypt', { plaintext: dek.toString('base64') });
    if (typeof data.ciphertext !== 'string') {
      throw new Error('Vault Transit encrypt returned no ciphertext.');
    }
    return {
      ciphertext: data.ciphertext,
      keyVersion: transitKeyVersion(data.ciphertext),
      backend: this.backend,
    };
  }

  async unwrap(wrapped: WrappedDek): Promise<Buffer> {
    const data = await this.post('decrypt', { ciphertext: wrapped.ciphertext });
    if (typeof data.plaintext !== 'string') {
      throw new Error('Vault Transit decrypt returned no plaintext.');
    }
    return Buffer.from(data.plaintext, 'base64');
  }
}

// ── Selection ───────────────────────────────────────────────────────────────

let wrapper: DekWrapper | null = null;

/** The process-wide DEK wrapper: Vault Transit when configured, else local KEK. */
export function getDekWrapper(): DekWrapper {
  if (!wrapper) {
    wrapper = isTransitConfigured() ? new VaultTransitDekWrapper() : new LocalKekDekWrapper();
  }
  return wrapper;
}

export function __resetDekWrapperForTests(): void {
  wrapper = null;
}
