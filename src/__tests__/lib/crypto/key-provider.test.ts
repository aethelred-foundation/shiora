/** @jest-environment node */

import {
  EnvKeyProvider,
  getKeyProvider,
  hasConfiguredDataKey,
  __resetKeyProviderForTests,
} from '@/lib/crypto/key-provider';

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
