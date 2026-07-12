/** @jest-environment node */

import {
  KEK_VERSION,
  isSealed,
  isShredded,
  shredEnvelope,
  SHRED_MARKER,
  currentSealCustody,
  needsReseal,
  resealString,
  openJson,
  openString,
  sealJson,
  sealString,
  type SealedEnvelope,
} from '@/lib/crypto/envelope';
import { __resetDekWrapperForTests } from '@/lib/crypto/dek-wrapper';
import { __resetKeyProviderForTests } from '@/lib/crypto/key-provider';
import {
  clearTransitEnv,
  configureTransitEnv,
  installFakeTransit,
  sealLegacyString,
} from '@/__tests__/helpers/envelope-fixtures';

const KEY_ENVS = [
  'SHIORA_DATA_ENCRYPTION_KEY',
  'SHIORA_DATA_ENCRYPTION_KEY_VERSION',
  'SHIORA_DATA_ENCRYPTION_KEY_V1',
];

describe('PHI envelope encryption', () => {
  beforeEach(() => {
    clearTransitEnv();
    __resetDekWrapperForTests();
    __resetKeyProviderForTests();
  });

  afterEach(() => {
    KEY_ENVS.forEach((key) => delete process.env[key]);
    clearTransitEnv();
    __resetDekWrapperForTests();
    __resetKeyProviderForTests();
    jest.restoreAllMocks();
  });

  it('round-trips a UTF-8 string', async () => {
    const plaintext = 'Patient: BRCA1 c.68_69delAG — pathogenic';
    const sealed = await sealString(plaintext);
    expect(await openString(sealed)).toBe(plaintext);
  });

  it('produces a well-formed, versioned envelope wrapped by the custody seam', async () => {
    const sealed = await sealString('hello');
    expect(sealed.alg).toBe('aes-256-gcm');
    expect(sealed.v).toBe(KEK_VERSION);
    expect(sealed.wrap).toBe('local-kek');
    expect(isSealed(sealed)).toBe(true);
  });

  it('does not leak plaintext into any envelope field', async () => {
    const secret = 'super-secret-diagnosis';
    const sealed = await sealString(secret);
    expect(JSON.stringify(sealed)).not.toContain(secret);
  });

  it('uses a fresh DEK + IV per call (no deterministic ciphertext reuse)', async () => {
    const a = await sealString('same plaintext');
    const b = await sealString('same plaintext');
    expect(a.ct).not.toBe(b.ct);
    expect(a.iv).not.toBe(b.iv);
    expect(a.dek).not.toBe(b.dek);
  });

  it('round-trips JSON values', async () => {
    const value = { hr: 72, bp: '118/76', notes: ['fasting', 'AM'] };
    const sealed = await sealJson(value);
    expect(await openJson<typeof value>(sealed)).toEqual(value);
  });

  it('binds ciphertext to its AAD context', async () => {
    const sealed = await sealString('cycle-day-14 ovulation +', 'aeth1owner:rec-123');
    expect(await openString(sealed, 'aeth1owner:rec-123')).toBe('cycle-day-14 ovulation +');

    // Same ciphertext, wrong context → authentication fails.
    await expect(openString(sealed, 'aeth1attacker:rec-999')).rejects.toThrow();
    // Missing context when one was bound → also fails.
    await expect(openString(sealed)).rejects.toThrow();
  });

  it('detects tampering with the ciphertext', async () => {
    const sealed = await sealString('integrity-protected');
    const tampered: SealedEnvelope = {
      ...sealed,
      ct: Buffer.from('garbage-ciphertext').toString('base64url'),
    };
    await expect(openString(tampered)).rejects.toThrow();
  });

  it('detects tampering with the authentication tag', async () => {
    const sealed = await sealString('integrity-protected');
    const flipped = Buffer.from(sealed.tag, 'base64url');
    flipped[0] ^= 0xff;
    await expect(openString({ ...sealed, tag: flipped.toString('base64url') })).rejects.toThrow();
  });

  it('rejects an envelope whose version key has changed', async () => {
    const sealed = await sealString('encrypted under dev fallback key');

    // Change the key serving version 1; the DEK can no longer be unwrapped.
    process.env.SHIORA_DATA_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
    __resetKeyProviderForTests();

    await expect(openString(sealed)).rejects.toThrow();
  });

  it('rejects an unknown algorithm on open', async () => {
    const sealed = await sealString('x');
    await expect(openString({ ...sealed, alg: 'rot13' as never })).rejects.toThrow(/algorithm/);
  });

  it('rejects an envelope whose wrapping-key version has no available key', async () => {
    const sealed = await sealString('x');
    await expect(openString({ ...sealed, v: 999 })).rejects.toThrow(/version 999/);
  });

  it('opens historical data after a key rotation', async () => {
    const key1 = Buffer.alloc(32, 11).toString('base64');
    const key2 = Buffer.alloc(32, 22).toString('base64');

    // Seal under version 1 with key1.
    process.env.SHIORA_DATA_ENCRYPTION_KEY = key1;
    __resetKeyProviderForTests();
    const oldData = await sealString('pre-rotation phi', 'owner:rec');
    expect(oldData.v).toBe(1);

    // Rotate: current is now version 2 (key2); key1 is retained as historical V1.
    process.env.SHIORA_DATA_ENCRYPTION_KEY_VERSION = '2';
    process.env.SHIORA_DATA_ENCRYPTION_KEY = key2;
    process.env.SHIORA_DATA_ENCRYPTION_KEY_V1 = key1;
    __resetKeyProviderForTests();

    const newData = await sealString('post-rotation phi', 'owner:rec2');
    expect(newData.v).toBe(2);

    // Old data still opens under its version-1 key; new data under version 2.
    expect(await openString(oldData, 'owner:rec')).toBe('pre-rotation phi');
    expect(await openString(newData, 'owner:rec2')).toBe('post-rotation phi');
  });

  it('isSealed rejects non-envelope values and unknown custody backends', () => {
    expect(isSealed(null)).toBe(false);
    expect(isSealed('string')).toBe(false);
    expect(isSealed({ v: 1 })).toBe(false);
    expect(isSealed({ alg: 'aes-256-gcm' })).toBe(false);
  });

  it('isSealed accepts both discriminated and legacy envelopes, but not a bogus wrap', async () => {
    const sealed = await sealString('x');
    expect(isSealed(sealed)).toBe(true);
    expect(isSealed(sealLegacyString('x'))).toBe(true); // wrap absent = legacy
    expect(isSealed({ ...sealed, wrap: 'hsm-of-mystery' })).toBe(false);
  });

  describe('legacy pre-adoption envelopes (inline local-KEK wrap)', () => {
    it('opens a legacy envelope, honoring its AAD binding', async () => {
      const legacy = sealLegacyString('sealed before the DekWrapper adoption', 'owner:rec-1');
      expect(legacy.wrap).toBeUndefined();
      expect(await openString(legacy, 'owner:rec-1')).toBe('sealed before the DekWrapper adoption');
      await expect(openString(legacy, 'owner:other')).rejects.toThrow();
    });

    it('rejects a malformed legacy wrapped DEK', async () => {
      const legacy = sealLegacyString('x');
      await expect(openString({ ...legacy, dek: 'only-one-part' })).rejects.toThrow(/Malformed wrapped DEK/);
    });

    it('re-seals a legacy envelope into the custody seam format', async () => {
      const legacy = sealLegacyString('migrate me', 'owner:rec-2');
      const migrated = await resealString(legacy, 'owner:rec-2');
      expect(migrated.wrap).toBe('local-kek');
      expect(await openString(migrated, 'owner:rec-2')).toBe('migrate me');
    });
  });

  describe('Vault Transit custody', () => {
    it('seals through Transit, stamping the Transit key version and backend', async () => {
      configureTransitEnv();
      __resetDekWrapperForTests();
      installFakeTransit(3);

      const sealed = await sealString('phi under vault custody', 'owner:rec');
      expect(sealed.wrap).toBe('vault-transit');
      expect(sealed.v).toBe(3);
      expect(sealed.dek).toMatch(/^vault:v3:/);
      expect(await openString(sealed, 'owner:rec')).toBe('phi under vault custody');
    });

    it('keeps historical local-KEK and legacy envelopes readable during a Transit migration', async () => {
      // Sealed under local custody, before Transit was configured.
      const seamLocalA = await sealString('seam-local a', 'owner:a');
      const seamLocalB = await sealString('seam-local b', 'owner:b');
      const legacy = sealLegacyString('legacy row', 'owner:c');

      configureTransitEnv();
      __resetDekWrapperForTests();
      installFakeTransit();

      // Mixed-custody reads: both pre-Transit formats still open…
      expect(await openString(seamLocalA, 'owner:a')).toBe('seam-local a');
      expect(await openString(seamLocalB, 'owner:b')).toBe('seam-local b');
      expect(await openString(legacy, 'owner:c')).toBe('legacy row');

      // …while new writes are Transit-wrapped.
      expect((await sealString('new row')).wrap).toBe('vault-transit');
    });

    it('fails closed on a Transit-wrapped envelope when Transit is not configured', async () => {
      configureTransitEnv();
      __resetDekWrapperForTests();
      installFakeTransit();
      const sealed = await sealString('vault-bound');

      clearTransitEnv();
      __resetDekWrapperForTests();

      await expect(openString(sealed)).rejects.toThrow(/Transit is not configured/);
    });
  });

  describe('crypto-shredding (GDPR erasure, GAP-13)', () => {
    it('produces a tombstone carrying no recoverable data', () => {
      const tombstone = shredEnvelope(1_700_000_000_000);
      expect(tombstone).toEqual({ alg: 'aes-256-gcm', shredded: SHRED_MARKER, shreddedAt: 1_700_000_000_000 });
      expect('dek' in tombstone).toBe(false);
      expect('ct' in tombstone).toBe(false);
      expect(isSealed(tombstone)).toBe(false);
    });

    it('defaults shreddedAt to now', () => {
      const before = Date.now();
      expect(shredEnvelope().shreddedAt).toBeGreaterThanOrEqual(before);
    });

    it('isShredded recognizes tombstones and rejects everything else', async () => {
      expect(isShredded(shredEnvelope())).toBe(true);
      expect(isShredded(await sealString('x'))).toBe(false);
      expect(isShredded(null)).toBe(false);
      expect(isShredded('shredded')).toBe(false);
      expect(isShredded({ shredded: 'shredded' })).toBe(false); // missing alg/shreddedAt
      expect(isShredded({ shredded: 'shredded', alg: 'aes-256-gcm', shreddedAt: 'no' })).toBe(false);
    });

    it('openString refuses a shredded value with a clear error', async () => {
      await expect(openString(shredEnvelope() as never)).rejects.toThrow(/crypto-shredded/);
    });
  });

  describe('custody-aware re-sealing (rotation completeness, GAP-14)', () => {
    const key1 = Buffer.alloc(32, 11).toString('base64');
    const key2 = Buffer.alloc(32, 22).toString('base64');

    it('currentSealCustody reports the active backend and wrapping version', async () => {
      expect(await currentSealCustody()).toEqual({ backend: 'local-kek', keyVersion: 1 });

      configureTransitEnv();
      __resetDekWrapperForTests();
      installFakeTransit(7);
      expect(await currentSealCustody()).toEqual({ backend: 'vault-transit', keyVersion: 7 });
    });

    it('needsReseal is true below the current version of the same backend', async () => {
      process.env.SHIORA_DATA_ENCRYPTION_KEY = key1;
      __resetKeyProviderForTests();
      const v1 = await sealString('phi', 'owner:rec');
      expect(needsReseal(v1, await currentSealCustody())).toBe(false); // current is v1

      // Rotate to v2; the v1 value now needs re-sealing.
      process.env.SHIORA_DATA_ENCRYPTION_KEY_VERSION = '2';
      process.env.SHIORA_DATA_ENCRYPTION_KEY = key2;
      process.env.SHIORA_DATA_ENCRYPTION_KEY_V1 = key1;
      __resetKeyProviderForTests();
      const custody = await currentSealCustody();
      expect(needsReseal(v1, custody)).toBe(true);
      expect(needsReseal(await sealString('fresh', 'owner:rec2'), custody)).toBe(false); // sealed at v2
    });

    it('needsReseal is true across custody backends and for legacy envelopes', async () => {
      const seamLocal = await sealString('local row');
      const legacy = sealLegacyString('legacy row');
      const localCustody = await currentSealCustody();

      // The legacy format is migrated even when the key version is current.
      expect(needsReseal(legacy, localCustody)).toBe(true);
      expect(needsReseal(seamLocal, localCustody)).toBe(false);

      // After a Transit cut-over, every local envelope migrates into Vault custody.
      configureTransitEnv();
      __resetDekWrapperForTests();
      installFakeTransit();
      const transitCustody = await currentSealCustody();
      expect(needsReseal(seamLocal, transitCustody)).toBe(true);
      expect(needsReseal(legacy, transitCustody)).toBe(true);
      expect(needsReseal(await sealString('vault row'), transitCustody)).toBe(false);
    });

    it('re-seals a v1 value under v2, preserving plaintext and AAD, retiring the old key', async () => {
      process.env.SHIORA_DATA_ENCRYPTION_KEY = key1;
      __resetKeyProviderForTests();
      const original = await sealString('cycle-day-14 ovulation', 'aeth1owner:rec-9');
      expect(original.v).toBe(1);

      process.env.SHIORA_DATA_ENCRYPTION_KEY_VERSION = '2';
      process.env.SHIORA_DATA_ENCRYPTION_KEY = key2;
      process.env.SHIORA_DATA_ENCRYPTION_KEY_V1 = key1;
      __resetKeyProviderForTests();

      const resealed = await resealString(original, 'aeth1owner:rec-9');
      expect(resealed.v).toBe(2);
      expect(await openString(resealed, 'aeth1owner:rec-9')).toBe('cycle-day-14 ovulation');

      // Once re-sealed, the v1 key can be retired: the value opens WITHOUT it.
      delete process.env.SHIORA_DATA_ENCRYPTION_KEY_V1;
      __resetKeyProviderForTests();
      expect(await openString(resealed, 'aeth1owner:rec-9')).toBe('cycle-day-14 ovulation');
    });

    it('re-sealing preserves the AAD binding (wrong context still fails)', async () => {
      process.env.SHIORA_DATA_ENCRYPTION_KEY = key1;
      __resetKeyProviderForTests();
      const original = await sealString('bound', 'owner:a');
      process.env.SHIORA_DATA_ENCRYPTION_KEY_VERSION = '2';
      process.env.SHIORA_DATA_ENCRYPTION_KEY = key2;
      process.env.SHIORA_DATA_ENCRYPTION_KEY_V1 = key1;
      __resetKeyProviderForTests();

      const resealed = await resealString(original, 'owner:a');
      await expect(openString(resealed, 'owner:b')).rejects.toThrow();
    });
  });
});
