/** @jest-environment node */

import {
  deriveClientKey,
  sealField,
  openField,
  isClientSealed,
} from '@/lib/crypto/client-envelope';

describe('client-envelope (Web Crypto field sealing)', () => {
  it('round-trips a sealed field without AAD', async () => {
    const key = await deriveClientKey('wallet-sig-abc');
    const env = await sealField('my private note', key);
    expect(env.alg).toBe('A256GCM');
    expect(env.v).toBe(1);
    expect(await openField(env, key)).toBe('my private note');
  });

  it('round-trips with AAD binding', async () => {
    const key = await deriveClientKey('wallet-sig-abc');
    const env = await sealField('note body', key, 'clinical-note:0x1:42');
    expect(await openField(env, key, 'clinical-note:0x1:42')).toBe('note body');
  });

  it('derives the same key from the same secret (interoperable)', async () => {
    const k1 = await deriveClientKey('same-secret');
    const k2 = await deriveClientKey('same-secret');
    const env = await sealField('x', k1);
    expect(await openField(env, k2)).toBe('x'); // k2 opens what k1 sealed
  });

  it('derives a different key from a different secret', async () => {
    const k1 = await deriveClientKey('secret-a');
    const k2 = await deriveClientKey('secret-b');
    const env = await sealField('x', k1);
    await expect(openField(env, k2)).rejects.toThrow();
  });

  it('honors a custom salt', async () => {
    const a = await deriveClientKey('s', 'salt-a');
    const b = await deriveClientKey('s', 'salt-b');
    const env = await sealField('x', a);
    await expect(openField(env, b)).rejects.toThrow();
  });

  it('fails to open under the wrong AAD', async () => {
    const key = await deriveClientKey('s');
    const env = await sealField('x', key, 'aad-1');
    await expect(openField(env, key, 'aad-2')).rejects.toThrow();
  });

  it('detects tampered ciphertext', async () => {
    const key = await deriveClientKey('s');
    const env = await sealField('x', key);
    const flipped = (env.ct[0] === 'A' ? 'B' : 'A') + env.ct.slice(1);
    await expect(openField({ ...env, ct: flipped }, key)).rejects.toThrow();
  });

  it('produces a unique IV per seal', async () => {
    const key = await deriveClientKey('s');
    const a = await sealField('x', key);
    const b = await sealField('x', key);
    expect(a.iv).not.toBe(b.iv);
  });

  describe('isClientSealed', () => {
    it('recognizes a sealed envelope', async () => {
      const key = await deriveClientKey('s');
      expect(isClientSealed(await sealField('x', key))).toBe(true);
    });

    it.each([
      null,
      'a string',
      42,
      {},
      { alg: 'A256GCM', iv: 'x' }, // missing ct
      { alg: 'A256GCM', iv: 42, ct: 'y' }, // iv not a string
      { alg: 'other', iv: 'x', ct: 'y' }, // wrong alg
    ])('rejects a non-envelope value (%p)', (value) => {
      expect(isClientSealed(value)).toBe(false);
    });
  });
});
