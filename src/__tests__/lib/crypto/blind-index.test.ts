/** @jest-environment node */

import { blindIndex, blindIndexAll, normalizeForIndex } from '@/lib/crypto/blind-index';
import { __resetDerivedSecretsForTests } from '@/lib/crypto/derived-secrets';

afterEach(() => __resetDerivedSecretsForTests());

describe('normalizeForIndex', () => {
  it('lowercases, trims, and NFKC-normalizes', () => {
    expect(normalizeForIndex('  Genomics  ')).toBe('genomics');
    expect(normalizeForIndex('CANCER')).toBe('cancer');
    // Full-width digits fold to ASCII under NFKC.
    expect(normalizeForIndex('ＡＢ')).toBe('ab');
  });
});

describe('blindIndex', () => {
  it('is deterministic for the same value + domain', () => {
    expect(blindIndex('genomics', 'record-tag')).toBe(blindIndex('genomics', 'record-tag'));
  });

  it('is case- and whitespace-insensitive', () => {
    expect(blindIndex(' Genomics ', 'record-tag')).toBe(blindIndex('genomics', 'record-tag'));
  });

  it('separates by domain (same value, different domain → different token)', () => {
    expect(blindIndex('cancer', 'record-tag')).not.toBe(blindIndex('cancer', 'diagnosis-code'));
  });

  it('is one-way and does not leak the plaintext', () => {
    const token = blindIndex('super-rare-condition', 'record-tag');
    expect(token).not.toContain('super-rare-condition');
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/); // base64url
  });

  it('produces different tokens for different values', () => {
    expect(blindIndex('a', 'd')).not.toBe(blindIndex('b', 'd'));
  });
});

describe('blindIndexAll', () => {
  it('tokenizes and de-duplicates (order-independent set)', () => {
    const tokens = blindIndexAll(['Genomics', 'genomics', 'oncology'], 'record-tag');
    expect(tokens).toHaveLength(2); // Genomics == genomics after normalize
    expect(tokens).toContain(blindIndex('genomics', 'record-tag'));
    expect(tokens).toContain(blindIndex('oncology', 'record-tag'));
  });

  it('returns an empty list for no values', () => {
    expect(blindIndexAll([], 'record-tag')).toEqual([]);
  });
});
