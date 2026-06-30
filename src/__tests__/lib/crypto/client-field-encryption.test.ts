/** @jest-environment node */

import {
  deriveFieldKey,
  sealSensitiveField,
  openSensitiveField,
  FIELD_KEY_MESSAGE,
} from '@/lib/crypto/client-field-encryption';

describe('client-field-encryption', () => {
  it('exposes a fixed, domain-separated key message', () => {
    expect(FIELD_KEY_MESSAGE).toContain('Shiora field-encryption key v1');
  });

  it('round-trips a sealed sensitive field bound to a context', async () => {
    const key = await deriveFieldKey('wallet-signature-1');
    const sealed = await sealSensitiveField('private note body', key, 'clinical-note:0x1:42');
    expect(typeof sealed).toBe('string');
    expect(JSON.parse(sealed).alg).toBe('A256GCM');
    expect(await openSensitiveField(sealed, key, 'clinical-note:0x1:42')).toBe('private note body');
  });

  it('passes through legacy non-JSON plaintext on open', async () => {
    const key = await deriveFieldKey('s');
    expect(await openSensitiveField('plain legacy text', key, 'ctx')).toBe('plain legacy text');
  });

  it('passes through JSON that is not a sealed envelope', async () => {
    const key = await deriveFieldKey('s');
    expect(await openSensitiveField('{"foo":1}', key, 'ctx')).toBe('{"foo":1}');
  });

  it('fails to open under the wrong context (AAD)', async () => {
    const key = await deriveFieldKey('s');
    const sealed = await sealSensitiveField('x', key, 'ctx-a');
    await expect(openSensitiveField(sealed, key, 'ctx-b')).rejects.toThrow();
  });
});
