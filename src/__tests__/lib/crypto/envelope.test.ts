/** @jest-environment node */

import {
  KEK_VERSION,
  __resetKekCacheForTests,
  hasConfiguredDataKey,
  isSealed,
  openJson,
  openString,
  sealJson,
  sealString,
  type SealedEnvelope,
} from '@/lib/crypto/envelope';

describe('PHI envelope encryption', () => {
  afterEach(() => {
    delete process.env.SHIORA_DATA_ENCRYPTION_KEY;
    __resetKekCacheForTests();
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
    const serialized = JSON.stringify(sealed);
    expect(serialized).not.toContain(secret);
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

  it('rejects an envelope sealed under a different KEK', () => {
    const sealed = sealString('encrypted under dev fallback key');

    process.env.SHIORA_DATA_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
    __resetKekCacheForTests();

    expect(() => openString(sealed)).toThrow();
  });

  it('accepts a 32-byte base64 KEK from the environment', () => {
    process.env.SHIORA_DATA_ENCRYPTION_KEY = Buffer.alloc(32, 42).toString('base64');
    __resetKekCacheForTests();
    expect(hasConfiguredDataKey()).toBe(true);

    const sealed = sealString('configured-key payload');
    expect(openString(sealed)).toBe('configured-key payload');
  });

  it('accepts a 64-char hex KEK from the environment', () => {
    process.env.SHIORA_DATA_ENCRYPTION_KEY = 'a'.repeat(64);
    __resetKekCacheForTests();
    const sealed = sealString('hex-key payload');
    expect(openString(sealed)).toBe('hex-key payload');
  });

  it('rejects a KEK of the wrong length', () => {
    process.env.SHIORA_DATA_ENCRYPTION_KEY = Buffer.alloc(16, 1).toString('base64');
    __resetKekCacheForTests();
    expect(() => sealString('x')).toThrow(/32 bytes/);
  });

  it('rejects an unknown algorithm on open', () => {
    const sealed = sealString('x');
    expect(() => openString({ ...sealed, alg: 'rot13' as never })).toThrow(/algorithm/);
  });

  it('throws when no data-encryption key is configured in production', () => {
    const prevNodeEnv = process.env.NODE_ENV;
    delete process.env.SHIORA_DATA_ENCRYPTION_KEY;
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error NODE_ENV is normally read-only; overridden for this case
    process.env.NODE_ENV = 'production';
    __resetKekCacheForTests();

    try {
      expect(() => sealString('x')).toThrow(/must be set in production/);
    } finally {
      // @ts-expect-error restore
      process.env.NODE_ENV = prevNodeEnv;
      __resetKekCacheForTests();
    }
  });

  it('rejects a malformed wrapped DEK', () => {
    const sealed = sealString('x');
    expect(() => openString({ ...sealed, dek: 'only-one-part' })).toThrow(/Malformed wrapped DEK/);
  });

  it('rejects an unknown KEK version on open', () => {
    const sealed = sealString('x');
    expect(() => openString({ ...sealed, v: 999 })).toThrow(/Unknown KEK version/);
  });

  it('isSealed rejects non-envelope values', () => {
    expect(isSealed(null)).toBe(false);
    expect(isSealed('string')).toBe(false);
    expect(isSealed({ v: 1 })).toBe(false);
    expect(isSealed({ alg: 'aes-256-gcm' })).toBe(false);
  });
});
