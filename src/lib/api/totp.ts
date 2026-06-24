// ============================================================
// Shiora on Aethelred — TOTP (RFC 6238)
//
// Time-based one-time passwords for multi-factor authentication, implemented
// with Node's crypto (HMAC-SHA1) and no external dependencies. Compatible with
// standard authenticator apps (Google Authenticator, Authy, 1Password) via the
// otpauth:// provisioning URI.
// ============================================================

import crypto from 'node:crypto';

const DIGITS = 6;
const PERIOD_SECONDS = 30;
const SECRET_BYTES = 20; // 160-bit, the TOTP standard
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';
  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

export function base32Decode(secret: string): Buffer {
  let bits = 0;
  let value = 0;
  const output: number[] = [];
  const chars = secret.replace(/=+$/, '').toUpperCase();
  for (let i = 0; i < chars.length; i++) {
    const index = BASE32_ALPHABET.indexOf(chars[i]);
    if (index === -1) {
      continue; // ignore separators / formatting characters
    }
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(output);
}

/** A fresh 160-bit base32 secret for enrolment. */
export function generateTotpSecret(): string {
  return base32Encode(crypto.randomBytes(SECRET_BYTES));
}

/** The 6-digit code for a secret at a given time. */
export function totpCode(secret: string, timestamp: number = Date.now()): string {
  const counter = Math.floor(timestamp / 1000 / PERIOD_SECONDS);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));

  const hmac = crypto.createHmac('sha1', base32Decode(secret)).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    (hmac[offset + 1] << 16) |
    (hmac[offset + 2] << 8) |
    hmac[offset + 3];

  return (binary % 10 ** DIGITS).toString().padStart(DIGITS, '0');
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) {
    return false;
  }
  return crypto.timingSafeEqual(left, right);
}

/**
 * Verify a submitted code against a secret, tolerating ±`window` time steps to
 * absorb clock skew (default ±1 step = ±30s).
 */
export function verifyTotp(
  secret: string,
  code: string,
  timestamp: number = Date.now(),
  window = 1,
): boolean {
  const normalized = code.trim();
  for (let step = -window; step <= window; step++) {
    const candidate = totpCode(secret, timestamp + step * PERIOD_SECONDS * 1000);
    if (safeEqual(candidate, normalized)) {
      return true;
    }
  }
  return false;
}

/** otpauth:// provisioning URI for authenticator-app enrolment. */
export function otpauthUri(secret: string, account: string, issuer = 'Shiora'): string {
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(account)}`;
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: String(DIGITS),
    period: String(PERIOD_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}
