/** @jest-environment node */

import {
  sessionSigningKey,
  challengeSigningKey,
  auditChainKey,
  __resetDerivedSecretsForTests,
} from '@/lib/crypto/derived-secrets';

afterEach(() => __resetDerivedSecretsForTests());

describe('derived-secrets (HKDF domain separation)', () => {
  it('derives 256-bit subkeys', () => {
    expect(sessionSigningKey()).toHaveLength(32);
    expect(challengeSigningKey()).toHaveLength(32);
    expect(auditChainKey()).toHaveLength(32);
  });

  it('derives cryptographically distinct subkeys per purpose', () => {
    const s = sessionSigningKey().toString('hex');
    const c = challengeSigningKey().toString('hex');
    const a = auditChainKey().toString('hex');
    expect(new Set([s, c, a]).size).toBe(3);
  });

  it('is deterministic and cached (stable across calls in a process)', () => {
    expect(sessionSigningKey().toString('hex')).toBe(sessionSigningKey().toString('hex'));
    // A second call returns the cached buffer (exercises the cache-hit path).
    expect(auditChainKey().equals(auditChainKey())).toBe(true);
  });

  it('does not equal the root secret (subkeys hide the root)', () => {
    // The dev root secret is a known string; no subkey should be its bytes.
    const rootBytes = Buffer.from('shiora-dev-session-secret-change-me-before-production', 'utf8');
    expect(sessionSigningKey().equals(rootBytes)).toBe(false);
  });

  it('re-derives after a reset', () => {
    const before = sessionSigningKey().toString('hex');
    __resetDerivedSecretsForTests();
    expect(sessionSigningKey().toString('hex')).toBe(before); // same root → same key
  });
});
