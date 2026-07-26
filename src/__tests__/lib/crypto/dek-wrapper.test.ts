/** @jest-environment node */

import crypto from 'node:crypto';

import {
  LocalKekDekWrapper,
  VaultTransitDekWrapper,
  getDekWrapper,
  isTransitConfigured,
  probeManagedDekCustody,
  transitKeyVersion,
  __resetDekWrapperForTests,
  type WrappedDek,
} from '@/lib/crypto/dek-wrapper';
import { getKeyProvider, __resetKeyProviderForTests } from '@/lib/crypto/key-provider';

const TRANSIT_ENVS = [
  'SHIORA_VAULT_ADDR',
  'SHIORA_VAULT_TOKEN',
  'SHIORA_TRANSIT_KEY_NAME',
] as const;
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of TRANSIT_ENVS) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
  __resetDekWrapperForTests();
  __resetKeyProviderForTests();
});

afterEach(() => {
  for (const key of TRANSIT_ENVS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
  __resetDekWrapperForTests();
  __resetKeyProviderForTests();
  jest.restoreAllMocks();
});

function configureTransit(addr = 'https://vault.internal:8200'): void {
  process.env.SHIORA_VAULT_ADDR = addr;
  process.env.SHIORA_VAULT_TOKEN = 's.token';
  process.env.SHIORA_TRANSIT_KEY_NAME = 'shiora-kek';
}

describe('LocalKekDekWrapper', () => {
  it('round-trips a DEK and stamps the current key version', async () => {
    const wrapperImpl = new LocalKekDekWrapper();
    const dek = crypto.randomBytes(32);
    const wrapped = await wrapperImpl.wrap(dek);
    expect(wrapped.backend).toBe('local-kek');
    expect(wrapped.keyVersion).toBeGreaterThanOrEqual(1);
    expect(wrapped.ciphertext).not.toContain(dek.toString('base64'));
    expect((await wrapperImpl.unwrap(wrapped)).equals(dek)).toBe(true);
  });

  it('fails closed on tampered ciphertext', async () => {
    const wrapperImpl = new LocalKekDekWrapper();
    const wrapped = await wrapperImpl.wrap(crypto.randomBytes(32));
    const raw = Buffer.from(wrapped.ciphertext, 'base64');
    raw[raw.length - 1] ^= 0xff;
    await expect(
      wrapperImpl.unwrap({ ...wrapped, ciphertext: raw.toString('base64') }),
    ).rejects.toThrow();
  });

  it('binds the wrap to the DEK-wrap domain (a ciphertext produced without the AAD fails)', async () => {
    // A well-formed GCM ciphertext under the same KEK, but not AAD-bound to
    // the DEK-wrap domain, must not be accepted as a wrapped DEK.
    const provider = getKeyProvider();
    const version = provider.currentVersion();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', provider.keyForVersion(version), iv);
    const body = Buffer.concat([cipher.update(crypto.randomBytes(32)), cipher.final()]);
    const unbound = Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64');

    await expect(
      new LocalKekDekWrapper().unwrap({
        ciphertext: unbound,
        keyVersion: version,
        backend: 'local-kek',
      }),
    ).rejects.toThrow();
  });
});

describe('transitKeyVersion', () => {
  it('parses the version from a Transit ciphertext and rejects other shapes', () => {
    expect(transitKeyVersion('vault:v1:abc')).toBe(1);
    expect(transitKeyVersion('vault:v12:abc')).toBe(12);
    expect(() => transitKeyVersion('not-a-vault-ciphertext')).toThrow(/Unrecognized/);
  });
});

describe('VaultTransitDekWrapper', () => {
  it('wraps by POSTing the DEK to transit/encrypt and parses the key version', async () => {
    configureTransit();
    const fetchMock = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ data: { ciphertext: 'vault:v3:opaque' } }), { status: 200 }),
      );
    const dek = crypto.randomBytes(32);

    const wrapped = await new VaultTransitDekWrapper().wrap(dek);

    expect(wrapped).toEqual({
      ciphertext: 'vault:v3:opaque',
      keyVersion: 3,
      backend: 'vault-transit',
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('https://vault.internal:8200/v1/transit/encrypt/shiora-kek');
    expect((init!.headers as Record<string, string>)['X-Vault-Token']).toBe('s.token');
    expect(JSON.parse(String(init!.body))).toEqual({ plaintext: dek.toString('base64') });
    expect(init!.signal).toBeInstanceOf(AbortSignal);
  });

  it('unwraps by POSTing the ciphertext to transit/decrypt', async () => {
    configureTransit();
    const dek = crypto.randomBytes(32);
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ data: { plaintext: dek.toString('base64') } }), {
        status: 200,
      }),
    );
    const wrapped: WrappedDek = {
      ciphertext: 'vault:v1:opaque',
      keyVersion: 1,
      backend: 'vault-transit',
    };
    expect((await new VaultTransitDekWrapper().unwrap(wrapped)).equals(dek)).toBe(true);
  });

  it('fails closed on transport errors, error statuses, and malformed payloads', async () => {
    configureTransit();
    const wrapperImpl = new VaultTransitDekWrapper();
    const dek = crypto.randomBytes(32);

    jest.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('ECONNREFUSED'));
    await expect(wrapperImpl.wrap(dek)).rejects.toThrow(/unreachable/);

    jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('denied', { status: 403 }));
    await expect(wrapperImpl.wrap(dek)).rejects.toThrow(/status 403/);

    jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('{}', { status: 200 }));
    await expect(wrapperImpl.wrap(dek)).rejects.toThrow(/unexpected payload/);

    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: {} }), { status: 200 }));
    await expect(wrapperImpl.wrap(dek)).rejects.toThrow(/no ciphertext/);

    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: {} }), { status: 200 }));
    await expect(
      wrapperImpl.unwrap({ ciphertext: 'vault:v1:x', keyVersion: 1, backend: 'vault-transit' }),
    ).rejects.toThrow(/no plaintext/);

    jest.spyOn(globalThis, 'fetch').mockRejectedValueOnce('not-an-error');
    await expect(wrapperImpl.wrap(dek)).rejects.toThrow(/unreachable/);
  });

  it('requires TLS to a non-local Vault and refuses partial configuration', () => {
    configureTransit('http://vault.internal:8200');
    expect(() => new VaultTransitDekWrapper()).toThrow(/https/);

    delete process.env.SHIORA_VAULT_TOKEN;
    process.env.SHIORA_VAULT_ADDR = 'https://vault.internal:8200';
    expect(() => new VaultTransitDekWrapper()).toThrow(/requires/);
  });

  it('accepts a plaintext localhost Vault for development', () => {
    configureTransit('http://localhost:8200');
    expect(new VaultTransitDekWrapper().backend).toBe('vault-transit');
  });

  it('probes managed custody by wrapping a throwaway DEK', async () => {
    configureTransit();
    const fetchMock = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ data: { ciphertext: 'vault:v7:probe' } }), { status: 200 }),
      );

    await probeManagedDekCustody();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain('/v1/transit/encrypt/shiora-kek');
  });
});

describe('getDekWrapper selection', () => {
  it('defaults to the local KEK wrapper and caches the instance', () => {
    expect(isTransitConfigured()).toBe(false);
    const first = getDekWrapper();
    expect(first).toBeInstanceOf(LocalKekDekWrapper);
    expect(getDekWrapper()).toBe(first);
  });

  it('selects Vault Transit when fully configured', () => {
    configureTransit();
    expect(isTransitConfigured()).toBe(true);
    __resetDekWrapperForTests();
    expect(getDekWrapper()).toBeInstanceOf(VaultTransitDekWrapper);
  });
});
