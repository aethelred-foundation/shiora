/** @jest-environment node */

import {
  EnvKeyProvider,
  getKeyProvider,
  preloadKeyProvider,
  hasConfiguredDataKey,
  __resetKeyProviderForTests,
} from '@/lib/crypto/key-provider';
import { VaultKeyProvider } from '@/lib/crypto/vault-key-provider';

const KEY_ENVS = [
  'SHIORA_DATA_ENCRYPTION_KEY',
  'SHIORA_DATA_ENCRYPTION_KEY_VERSION',
  'SHIORA_DATA_ENCRYPTION_KEY_V1',
];

describe('EnvKeyProvider', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    KEY_ENVS.forEach((key) => delete process.env[key]);
    // @ts-expect-error NODE_ENV is normally read-only; restored for isolation
    process.env.NODE_ENV = originalNodeEnv;
    __resetKeyProviderForTests();
  });

  it('defaults to version 1', () => {
    expect(new EnvKeyProvider().currentVersion()).toBe(1);
  });

  it('reads a custom current version from the environment', () => {
    process.env.SHIORA_DATA_ENCRYPTION_KEY_VERSION = '3';
    expect(new EnvKeyProvider().currentVersion()).toBe(3);
  });

  it('rejects a non-positive-integer version', () => {
    process.env.SHIORA_DATA_ENCRYPTION_KEY_VERSION = 'abc';
    expect(() => new EnvKeyProvider().currentVersion()).toThrow(/positive integer/);
    process.env.SHIORA_DATA_ENCRYPTION_KEY_VERSION = '0';
    expect(() => new EnvKeyProvider().currentVersion()).toThrow(/positive integer/);
  });

  it('derives a deterministic dev fallback key when none is configured', () => {
    const a = new EnvKeyProvider().keyForVersion(1);
    const b = new EnvKeyProvider().keyForVersion(1);
    expect(a).toHaveLength(32);
    expect(a.equals(b)).toBe(true);
  });

  it('caches the resolved key per version', () => {
    const provider = new EnvKeyProvider();
    const first = provider.keyForVersion(1);
    expect(provider.keyForVersion(1)).toBe(first); // cache hit returns same instance
  });

  it('accepts a 32-byte base64 key', () => {
    process.env.SHIORA_DATA_ENCRYPTION_KEY = Buffer.alloc(32, 42).toString('base64');
    expect(new EnvKeyProvider().keyForVersion(1)).toHaveLength(32);
    expect(hasConfiguredDataKey()).toBe(true);
  });

  it('accepts a 64-character hex key', () => {
    process.env.SHIORA_DATA_ENCRYPTION_KEY = 'a'.repeat(64);
    expect(new EnvKeyProvider().keyForVersion(1)).toHaveLength(32);
  });

  it('rejects a key of the wrong length', () => {
    process.env.SHIORA_DATA_ENCRYPTION_KEY = Buffer.alloc(16, 1).toString('base64');
    expect(() => new EnvKeyProvider().keyForVersion(1)).toThrow(/32 bytes/);
  });

  it('throws for the current version with no key in production', () => {
    delete process.env.SHIORA_DATA_ENCRYPTION_KEY;
    // @ts-expect-error override for this case
    process.env.NODE_ENV = 'production';
    expect(() => new EnvKeyProvider().keyForVersion(1)).toThrow(/must be set in production/);
  });

  it('serves a historical key for a superseded version', () => {
    process.env.SHIORA_DATA_ENCRYPTION_KEY_VERSION = '2';
    process.env.SHIORA_DATA_ENCRYPTION_KEY = Buffer.alloc(32, 2).toString('base64');
    process.env.SHIORA_DATA_ENCRYPTION_KEY_V1 = Buffer.alloc(32, 1).toString('base64');

    const provider = new EnvKeyProvider();
    expect(provider.keyForVersion(1)).toHaveLength(32); // historical path
    expect(provider.keyForVersion(2)).toHaveLength(32); // current path
  });

  it('throws for an unavailable version', () => {
    expect(() => new EnvKeyProvider().keyForVersion(999)).toThrow(/version 999/);
  });

  it('hasConfiguredDataKey reflects the environment', () => {
    expect(hasConfiguredDataKey()).toBe(false);
    process.env.SHIORA_DATA_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString('base64');
    expect(hasConfiguredDataKey()).toBe(true);
  });

  it('getKeyProvider returns a process-wide singleton until reset', () => {
    const provider = getKeyProvider();
    expect(getKeyProvider()).toBe(provider);
    __resetKeyProviderForTests();
    expect(getKeyProvider()).not.toBe(provider);
  });
});

describe('provider selection and preload', () => {
  const VAULT_ENVS = ['SHIORA_VAULT_ADDR', 'SHIORA_VAULT_TOKEN', 'SHIORA_VAULT_KEK_PATH'];
  const realFetch = global.fetch;

  function configureVault(): void {
    process.env.SHIORA_VAULT_ADDR = 'https://vault.example:8200';
    process.env.SHIORA_VAULT_TOKEN = 's.token';
    process.env.SHIORA_VAULT_KEK_PATH = 'secret/data/shiora/kek';
  }

  afterEach(() => {
    VAULT_ENVS.forEach((key) => delete process.env[key]);
    delete process.env.SHIORA_DATA_ENCRYPTION_KEY;
    global.fetch = realFetch;
    __resetKeyProviderForTests();
    jest.clearAllMocks();
  });

  it('selects the Vault provider when Vault is configured', () => {
    configureVault();
    expect(getKeyProvider()).toBeInstanceOf(VaultKeyProvider);
  });

  it('selects the env provider when Vault is not configured', () => {
    expect(getKeyProvider()).toBeInstanceOf(EnvKeyProvider);
  });

  it('hasConfiguredDataKey is true when Vault is configured without an env key', () => {
    configureVault();
    expect(hasConfiguredDataKey()).toBe(true);
  });

  it('preloadKeyProvider warms the Vault provider once', async () => {
    configureVault();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        data: { data: { current_version: '1', v1: Buffer.alloc(32, 5).toString('base64') } },
      }),
    });
    await preloadKeyProvider();
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(getKeyProvider().currentVersion()).toBe(1);
  });

  it('preloadKeyProvider is a no-op for the env provider', async () => {
    await expect(preloadKeyProvider()).resolves.toBeUndefined();
  });
});
