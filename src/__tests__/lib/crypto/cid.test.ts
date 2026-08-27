/** @jest-environment node */

import { computeCidV1, verifyCid, base32NoPad } from '@/lib/crypto/cid';

const u8 = (s: string) => new TextEncoder().encode(s);

describe('CIDv1 content addressing', () => {
  it('matches the canonical IPFS empty-file raw CIDv1 (spec cross-check)', () => {
    expect(computeCidV1(new Uint8Array(0)))
      .toBe('bafkreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku');
  });

  it('is deterministic and content-derived (same bytes → same CID)', () => {
    expect(computeCidV1(u8('hello world'))).toBe(computeCidV1(u8('hello world')));
    expect(computeCidV1(u8('hello world'))).toMatch(/^bafkrei[a-z2-7]+$/); // CIDv1 raw sha256
  });

  it('different content yields a different CID', () => {
    expect(computeCidV1(u8('a'))).not.toBe(computeCidV1(u8('b')));
  });

  it('verifyCid confirms integrity and detects tampering', () => {
    const cid = computeCidV1(u8('patient record ciphertext'));
    expect(verifyCid(cid, u8('patient record ciphertext'))).toBe(true);
    expect(verifyCid(cid, u8('patient record ciphertext!'))).toBe(false); // one byte changed
  });

  it('base32 encodes with and without leftover bits (RFC 4648, no padding)', () => {
    expect(base32NoPad(new Uint8Array([0, 0, 0, 0, 0]))).toBe('aaaaaaaa'); // 5 bytes → 0 leftover
    expect(base32NoPad(new Uint8Array([0]))).toBe('aa'); // 1 byte → leftover bits padded
  });
});
