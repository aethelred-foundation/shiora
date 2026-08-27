/** @jest-environment node */

import { decodeKey, KEY_BYTES } from '@/lib/crypto/key-codec';

describe('key-codec', () => {
  it('declares the 256-bit key length', () => {
    expect(KEY_BYTES).toBe(32);
  });

  it('decodes a 32-byte base64 key', () => {
    expect(decodeKey(Buffer.alloc(32, 1).toString('base64'))).toHaveLength(32);
  });

  it('decodes a 64-character hex key', () => {
    expect(decodeKey('a'.repeat(64))).toHaveLength(KEY_BYTES);
  });

  it('rejects key material of the wrong length', () => {
    expect(() => decodeKey('AAAA')).toThrow(/must decode to 32 bytes/);
  });
});
