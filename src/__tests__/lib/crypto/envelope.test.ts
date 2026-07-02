/** @jest-environment node */

import {
  KEK_VERSION,
  isSealed,
  isShredded,
  shredEnvelope,
  SHRED_MARKER,
  needsReseal,
  resealString,
  openJson,
  openString,
  sealJson,
  sealString,
  type SealedEnvelope,
} from '@/lib/crypto/envelope';
import { __resetKeyProviderForTests } from '@/lib/crypto/key-provider';

const KEY_ENVS = [
  'SHIORA_DATA_ENCRYPTION_KEY',
  'SHIORA_DATA_ENCRYPTION_KEY_VERSION',
  'SHIORA_DATA_ENCRYPTION_KEY_V1',
];

describe('PHI envelope encryption', () => {
  afterEach(() => {
    KEY_ENVS.forEach((key) => delete process.env[key]);
    __resetKeyProviderForTests();
  });

  it('round-trips a UTF-8 string', () => {
    const plaintext = 'Patient: BRCA1 c.68_69delAG — pathogenic';
    const sealed = sealString(plaintext);
    expect(openString(sealed)).toBe(plaintext);
  });

  it('produces a well-formed, versioned envelope', () => {
    const sealed = sealString('hello');
    expect(sealed.alg).toBe('aes-256-gcm');
    expect(sealed.v).toBe(KEK_VERSION);
    expect(isSealed(sealed)).toBe(true);
  });

  it('does not leak plaintext into any envelope field', () => {
    const secret = 'super-secret-diagnosis';
    const sealed = sealString(secret);
    expect(JSON.stringify(sealed)).not.toContain(secret);
  });

  it('uses a fresh DEK + IV per call (no deterministic ciphertext reuse)', () => {
    const a = sealString('same plaintext');
    const b = sealString('same plaintext');
    expect(a.ct).not.toBe(b.ct);
    expect(a.iv).not.toBe(b.iv);
    expect(a.dek).not.toBe(b.dek);
  });

  it('round-trips JSON values', () => {
    const value = { hr: 72, bp: '118/76', notes: ['fasting', 'AM'] };
    const sealed = sealJson(value);
    expect(openJson<typeof value>(sealed)).toEqual(value);
  });

  it('binds ciphertext to its AAD context', () => {
    const sealed = sealString('cycle-day-14 ovulation +', 'aeth1owner:rec-123');
    expect(openString(sealed, 'aeth1owner:rec-123')).toBe('cycle-day-14 ovulation +');

    // Same ciphertext, wrong context → authentication fails.
    expect(() => openString(sealed, 'aeth1attacker:rec-999')).toThrow();
    // Missing context when one was bound → also fails.
    expect(() => openString(sealed)).toThrow();
  });

  it('detects tampering with the ciphertext', () => {
    const sealed = sealString('integrity-protected');
    const tampered: SealedEnvelope = {
      ...sealed,
      ct: Buffer.from('garbage-ciphertext').toString('base64url'),
    };
    expect(() => openString(tampered)).toThrow();
  });

  it('detects tampering with the authentication tag', () => {
    const sealed = sealString('integrity-protected');
    const flipped = Buffer.from(sealed.tag, 'base64url');
    flipped[0] ^= 0xff;
    expect(() => openString({ ...sealed, tag: flipped.toString('base64url') })).toThrow();
  });

  it('rejects an envelope whose version key has changed', () => {
    const sealed = sealString('encrypted under dev fallback key');

    // Change the key serving version 1; the DEK can no longer be unwrapped.
    process.env.SHIORA_DATA_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
    __resetKeyProviderForTests();

    expect(() => openString(sealed)).toThrow();
  });

  it('rejects an unknown algorithm on open', () => {
    const sealed = sealString('x');
    expect(() => openString({ ...sealed, alg: 'rot13' as never })).toThrow(/algorithm/);
  });

  it('rejects a malformed wrapped DEK', () => {
    const sealed = sealString('x');
    expect(() => openString({ ...sealed, dek: 'only-one-part' })).toThrow(/Malformed wrapped DEK/);
  });

  it('rejects an envelope whose KEK version has no available key', () => {
    const sealed = sealString('x');
    expect(() => openString({ ...sealed, v: 999 })).toThrow(/version 999/);
  });

  it('opens historical data after a key rotation', () => {
    const key1 = Buffer.alloc(32, 11).toString('base64');
    const key2 = Buffer.alloc(32, 22).toString('base64');

    // Seal under version 1 with key1.
    process.env.SHIORA_DATA_ENCRYPTION_KEY = key1;
    __resetKeyProviderForTests();
    const oldData = sealString('pre-rotation phi', 'owner:rec');
    expect(oldData.v).toBe(1);

    // Rotate: current is now version 2 (key2); key1 is retained as historical V1.
    process.env.SHIORA_DATA_ENCRYPTION_KEY_VERSION = '2';
    process.env.SHIORA_DATA_ENCRYPTION_KEY = key2;
    process.env.SHIORA_DATA_ENCRYPTION_KEY_V1 = key1;
    __resetKeyProviderForTests();

    const newData = sealString('post-rotation phi', 'owner:rec2');
    expect(newData.v).toBe(2);

    // Old data still opens under its version-1 key; new data under version 2.
    expect(openString(oldData, 'owner:rec')).toBe('pre-rotation phi');
    expect(openString(newData, 'owner:rec2')).toBe('post-rotation phi');
  });

  it('isSealed rejects non-envelope values', () => {
    expect(isSealed(null)).toBe(false);
    expect(isSealed('string')).toBe(false);
    expect(isSealed({ v: 1 })).toBe(false);
    expect(isSealed({ alg: 'aes-256-gcm' })).toBe(false);
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

    it('isShredded recognizes tombstones and rejects everything else', () => {
      expect(isShredded(shredEnvelope())).toBe(true);
      expect(isShredded(sealString('x'))).toBe(false);
      expect(isShredded(null)).toBe(false);
      expect(isShredded('shredded')).toBe(false);
      expect(isShredded({ shredded: 'shredded' })).toBe(false); // missing alg/shreddedAt
      expect(isShredded({ shredded: 'shredded', alg: 'aes-256-gcm', shreddedAt: 'no' })).toBe(false);
    });

    it('openString refuses a shredded value with a clear error', () => {
      expect(() => openString(shredEnvelope() as never)).toThrow(/crypto-shredded/);
    });
  });

  describe('KEK re-sealing (rotation completeness, GAP-14)', () => {
    const key1 = Buffer.alloc(32, 11).toString('base64');
    const key2 = Buffer.alloc(32, 22).toString('base64');

    it('needsReseal is true only for values below the current KEK version', () => {
      process.env.SHIORA_DATA_ENCRYPTION_KEY = key1;
      __resetKeyProviderForTests();
      const v1 = sealString('phi', 'owner:rec');
      expect(needsReseal(v1)).toBe(false); // current is v1

      // Rotate to v2; the v1 value now needs re-sealing.
      process.env.SHIORA_DATA_ENCRYPTION_KEY_VERSION = '2';
      process.env.SHIORA_DATA_ENCRYPTION_KEY = key2;
      process.env.SHIORA_DATA_ENCRYPTION_KEY_V1 = key1;
      __resetKeyProviderForTests();
      expect(needsReseal(v1)).toBe(true);
      expect(needsReseal(sealString('fresh', 'owner:rec2'))).toBe(false); // sealed at v2
    });

    it('re-seals a v1 value under v2, preserving plaintext and AAD, retiring the old key', () => {
      process.env.SHIORA_DATA_ENCRYPTION_KEY = key1;
      __resetKeyProviderForTests();
      const original = sealString('cycle-day-14 ovulation', 'aeth1owner:rec-9');
      expect(original.v).toBe(1);

      process.env.SHIORA_DATA_ENCRYPTION_KEY_VERSION = '2';
      process.env.SHIORA_DATA_ENCRYPTION_KEY = key2;
      process.env.SHIORA_DATA_ENCRYPTION_KEY_V1 = key1;
      __resetKeyProviderForTests();

      const resealed = resealString(original, 'aeth1owner:rec-9');
      expect(resealed.v).toBe(2);
      expect(openString(resealed, 'aeth1owner:rec-9')).toBe('cycle-day-14 ovulation');

      // Once re-sealed, the v1 key can be retired: the value opens WITHOUT it.
      delete process.env.SHIORA_DATA_ENCRYPTION_KEY_V1;
      __resetKeyProviderForTests();
      expect(openString(resealed, 'aeth1owner:rec-9')).toBe('cycle-day-14 ovulation');
    });

    it('re-sealing preserves the AAD binding (wrong context still fails)', () => {
      process.env.SHIORA_DATA_ENCRYPTION_KEY = key1;
      __resetKeyProviderForTests();
      const original = sealString('bound', 'owner:a');
      process.env.SHIORA_DATA_ENCRYPTION_KEY_VERSION = '2';
      process.env.SHIORA_DATA_ENCRYPTION_KEY = key2;
      process.env.SHIORA_DATA_ENCRYPTION_KEY_V1 = key1;
      __resetKeyProviderForTests();

      const resealed = resealString(original, 'owner:a');
      expect(() => openString(resealed, 'owner:b')).toThrow();
    });
  });
});
