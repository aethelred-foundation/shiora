/** @jest-environment node */

import {
  base32Decode,
  base32Encode,
  generateTotpSecret,
  otpauthUri,
  totpCode,
  verifyTotp,
} from '@/lib/api/totp';

describe('TOTP (RFC 6238)', () => {
  it('generates a 32-character base32 secret', () => {
    expect(generateTotpSecret()).toMatch(/^[A-Z2-7]{32}$/);
  });

  it('base32 round-trips and handles trailing partial bytes', () => {
    expect(base32Encode(Buffer.from([0xff])).length).toBeGreaterThan(0); // partial-byte branch
    const original = Buffer.from('hello world test 123', 'utf8');
    expect(base32Decode(base32Encode(original)).equals(original)).toBe(true);
  });

  it('base32Decode ignores non-alphabet characters', () => {
    expect(base32Decode('JBSWY3DP EHPK3PXP').length).toBeGreaterThan(0); // space is skipped
  });

  it('produces a stable 6-digit code for a fixed secret and time', () => {
    const secret = 'JBSWY3DPEHPK3PXP';
    const at = 1_700_000_000_000;
    const code = totpCode(secret, at);
    expect(code).toMatch(/^\d{6}$/);
    expect(totpCode(secret, at)).toBe(code);
  });

  it('verifies the current code and one within the skew window', () => {
    const secret = generateTotpSecret();
    const at = 1_700_000_000_000;
    expect(verifyTotp(secret, totpCode(secret, at), at)).toBe(true);
    expect(verifyTotp(secret, totpCode(secret, at - 30_000), at)).toBe(true);
  });

  it('rejects an incorrect or wrong-length code', () => {
    const secret = generateTotpSecret();
    const at = 1_700_000_000_000;
    const real = totpCode(secret, at);
    const wrong = real === '000000' ? '111111' : '000000';
    expect(verifyTotp(secret, wrong, at, 0)).toBe(false);
    expect(verifyTotp(secret, '12345', at)).toBe(false); // length mismatch
  });

  it('builds an otpauth provisioning URI', () => {
    const uri = otpauthUri('JBSWY3DPEHPK3PXP', 'aeth1abc', 'Shiora');
    expect(uri).toContain('otpauth://totp/');
    expect(uri).toContain('secret=JBSWY3DPEHPK3PXP');
    expect(uri).toContain('issuer=Shiora');
  });
});
