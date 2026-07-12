// ============================================================
// Test fixtures for envelope custody: the legacy pre-DekWrapper seal format
// and an in-memory stand-in for Vault Transit. Production code no longer
// WRITES the legacy format, but must keep READING it until the re-seal job
// migrates a corpus — these fixtures keep that path exercised.
// ============================================================

import crypto from 'node:crypto';

import { DEK_WRAP_AAD } from '@/lib/crypto/dek-wrapper';
import { getKeyProvider } from '@/lib/crypto/key-provider';
import type { SealedEnvelope } from '@/lib/crypto/envelope';

/**
 * Seal a value exactly the way the pre-adoption envelope did: DEK wrapped
 * inline under the local KEK, colon-packed `iv:tag:ciphertext`, AAD-bound to
 * the DEK-wrap domain, and NO `wrap` discriminator.
 */
export function sealLegacyString(plaintext: string, aad?: string): SealedEnvelope {
  const provider = getKeyProvider();
  const version = provider.currentVersion();
  const kek = provider.keyForVersion(version);
  const dek = crypto.randomBytes(32);

  const payloadIv = crypto.randomBytes(12);
  const payloadCipher = crypto.createCipheriv('aes-256-gcm', dek, payloadIv);
  if (aad) payloadCipher.setAAD(Buffer.from(aad, 'utf8'));
  const ct = Buffer.concat([payloadCipher.update(Buffer.from(plaintext, 'utf8')), payloadCipher.final()]);
  const payloadTag = payloadCipher.getAuthTag();

  const wrapIv = crypto.randomBytes(12);
  const wrapCipher = crypto.createCipheriv('aes-256-gcm', kek, wrapIv);
  wrapCipher.setAAD(Buffer.from(DEK_WRAP_AAD, 'utf8'));
  const wrappedDek = Buffer.concat([wrapCipher.update(dek), wrapCipher.final()]);
  const wrapTag = wrapCipher.getAuthTag();

  return {
    v: version,
    alg: 'aes-256-gcm',
    dek: [
      wrapIv.toString('base64url'),
      wrapTag.toString('base64url'),
      wrappedDek.toString('base64url'),
    ].join(':'),
    iv: payloadIv.toString('base64url'),
    tag: payloadTag.toString('base64url'),
    ct: ct.toString('base64url'),
    ...(aad ? { aad } : {}),
  };
}

/** JSON variant of {@link sealLegacyString}. */
export function sealLegacyJson<T>(value: T, aad?: string): SealedEnvelope {
  return sealLegacyString(JSON.stringify(value), aad);
}

export const TRANSIT_ENVS = ['SHIORA_VAULT_ADDR', 'SHIORA_VAULT_TOKEN', 'SHIORA_TRANSIT_KEY_NAME'] as const;

/**
 * Configure the environment so getDekWrapper() selects Vault Transit. Does
 * NOT set SHIORA_VAULT_KEK_PATH, so the KEK KeyProvider stays env-backed and
 * historical local-KEK envelopes remain openable alongside Transit ones.
 */
export function configureTransitEnv(addr = 'https://vault.test:8200'): void {
  process.env.SHIORA_VAULT_ADDR = addr;
  process.env.SHIORA_VAULT_TOKEN = 's.test-token';
  process.env.SHIORA_TRANSIT_KEY_NAME = 'shiora-kek-test';
}

export function clearTransitEnv(): void {
  for (const key of TRANSIT_ENVS) {
    delete process.env[key];
  }
}

export interface FakeTransit {
  /** Change the key version stamped on subsequent encrypt calls (rotation). */
  rotate(version: number): void;
}

/**
 * Install an in-memory stand-in for Vault Transit's encrypt/decrypt endpoints
 * over global fetch. Like the real engine, the returned `vault:v<N>:...`
 * ciphertext is an opaque handle — the DEK never appears in it.
 */
export function installFakeTransit(initialVersion = 1): FakeTransit {
  let version = initialVersion;
  let counter = 0;
  const vault = new Map<string, string>();

  jest.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, string>;
    if (url.includes('/v1/transit/encrypt/')) {
      const ciphertext = `vault:v${version}:ct-${counter += 1}`;
      vault.set(ciphertext, body.plaintext);
      return new Response(JSON.stringify({ data: { ciphertext } }), { status: 200 });
    }
    if (url.includes('/v1/transit/decrypt/')) {
      const plaintext = vault.get(body.ciphertext);
      if (plaintext === undefined) {
        return new Response('unknown ciphertext', { status: 400 });
      }
      return new Response(JSON.stringify({ data: { plaintext } }), { status: 200 });
    }
    return new Response('not found', { status: 404 });
  });

  return {
    rotate(next: number): void {
      version = next;
    },
  };
}
