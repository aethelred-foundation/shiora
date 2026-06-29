/** @jest-environment node */

import { VaultKeyProvider, isVaultConfigured } from '@/lib/crypto/vault-key-provider';

const VAULT_ENVS = ['SHIORA_VAULT_ADDR', 'SHIORA_VAULT_TOKEN', 'SHIORA_VAULT_KEK_PATH'];

const KEY1 = Buffer.alloc(32, 7);
const KEY2 = Buffer.alloc(32, 9);
const KEY1_B64 = KEY1.toString('base64');
const KEY2_B64 = KEY2.toString('base64');
const KEY_HEX = Buffer.alloc(32, 3).toString('hex'); // 64 hex chars

const realFetch = global.fetch;

function mockFetchOnce(opts: {
  reject?: boolean;
  ok?: boolean;
  status?: number;
  body?: unknown;
}): void {
  const fn = global.fetch as jest.Mock;
  if (opts.reject) {
    fn.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    return;
  }
  fn.mockResolvedValueOnce({
    ok: opts.ok ?? true,
    status: opts.status ?? 200,
    json: async () => opts.body,
  });
}

function kv(data: Record<string, string>): { data: { data: Record<string, string> } } {
  return { data: { data } };
}

beforeEach(() => {
  process.env.SHIORA_VAULT_ADDR = 'https://vault.example:8200';
  process.env.SHIORA_VAULT_TOKEN = 's.token';
  process.env.SHIORA_VAULT_KEK_PATH = 'secret/data/shiora/kek';
  global.fetch = jest.fn();
});

afterEach(() => {
  VAULT_ENVS.forEach((k) => delete process.env[k]);
  global.fetch = realFetch;
  jest.clearAllMocks();
});

describe('isVaultConfigured', () => {
  it('is true when all three Vault settings are present', () => {
    expect(isVaultConfigured()).toBe(true);
  });

  it.each(VAULT_ENVS)('is false when %s is missing', (missing) => {
    delete process.env[missing];
    expect(isVaultConfigured()).toBe(false);
  });
});

describe('VaultKeyProvider.preload — success', () => {
  it('loads a single-version KEK and serves it synchronously', async () => {
    mockFetchOnce({ body: kv({ current_version: '1', v1: KEY1_B64 }) });
    const provider = new VaultKeyProvider();
    await provider.preload();

    expect(provider.currentVersion()).toBe(1);
    expect(provider.keyForVersion(1).equals(KEY1)).toBe(true);
  });

  it('loads multiple versions for rotation and decodes hex key material', async () => {
    mockFetchOnce({ body: kv({ current_version: '2', v1: KEY_HEX, v2: KEY2_B64 }) });
    const provider = new VaultKeyProvider();
    await provider.preload();

    expect(provider.currentVersion()).toBe(2);
    expect(provider.keyForVersion(1).equals(Buffer.from(KEY_HEX, 'hex'))).toBe(true);
    expect(provider.keyForVersion(2).equals(KEY2)).toBe(true);
  });

  it('calls Vault KV v2 with the token header and a normalized URL', async () => {
    process.env.SHIORA_VAULT_ADDR = 'https://vault.example:8200/';
    process.env.SHIORA_VAULT_KEK_PATH = '/secret/data/shiora/kek';
    mockFetchOnce({ body: kv({ current_version: '1', v1: KEY1_B64 }) });

    await new VaultKeyProvider().preload();

    expect(global.fetch).toHaveBeenCalledWith(
      'https://vault.example:8200/v1/secret/data/shiora/kek',
      { headers: { 'X-Vault-Token': 's.token' } },
    );
  });
});

describe('VaultKeyProvider — access before/around preload', () => {
  it('currentVersion throws before preload', () => {
    expect(() => new VaultKeyProvider().currentVersion()).toThrow(/preload\(\) must run/);
  });

  it('keyForVersion throws before preload', () => {
    expect(() => new VaultKeyProvider().keyForVersion(1)).toThrow(/No data encryption key/);
  });

  it('keyForVersion throws for an unknown version after preload', async () => {
    mockFetchOnce({ body: kv({ current_version: '1', v1: KEY1_B64 }) });
    const provider = new VaultKeyProvider();
    await provider.preload();
    expect(() => provider.keyForVersion(9)).toThrow(/version 9/);
  });
});

describe('VaultKeyProvider.preload — failure modes', () => {
  it('throws when Vault is not fully configured', async () => {
    delete process.env.SHIORA_VAULT_TOKEN;
    await expect(new VaultKeyProvider().preload()).rejects.toThrow(/not fully configured/);
  });

  it('throws when Vault is unreachable', async () => {
    mockFetchOnce({ reject: true });
    await expect(new VaultKeyProvider().preload()).rejects.toThrow(/unreachable/);
  });

  it('throws when Vault returns a non-2xx status', async () => {
    mockFetchOnce({ ok: false, status: 403 });
    await expect(new VaultKeyProvider().preload()).rejects.toThrow(/HTTP 403/);
  });

  it('throws when the KV v2 data payload is absent', async () => {
    mockFetchOnce({ body: {} });
    await expect(new VaultKeyProvider().preload()).rejects.toThrow(/no KV v2 data payload/);
  });

  it('throws when current_version is missing or non-positive', async () => {
    mockFetchOnce({ body: kv({ v1: KEY1_B64 }) });
    await expect(new VaultKeyProvider().preload()).rejects.toThrow(/current_version/);
  });

  it('throws when there is no key material for the current version', async () => {
    mockFetchOnce({ body: kv({ current_version: '2', v1: KEY1_B64 }) });
    await expect(new VaultKeyProvider().preload()).rejects.toThrow(/no key material/);
  });

  it('throws when key material is the wrong length', async () => {
    mockFetchOnce({ body: kv({ current_version: '1', v1: 'dG9vLXNob3J0' }) }); // "too-short"
    await expect(new VaultKeyProvider().preload()).rejects.toThrow(/must decode to 32 bytes/);
  });
});
