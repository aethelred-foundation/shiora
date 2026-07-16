/** @jest-environment node */

// The Secure attribute on the session cookie follows the preflight tier:
// production always Secure; an acknowledged evaluation deployment has
// accepted plain-http transport, where a Secure-only cookie is silently
// dropped by browsers (connect "succeeds", everything after is 401).

jest.mock('@/lib/api/env', () => ({
  serverEnv: { isProduction: true },
}));
jest.mock('@/lib/api/preflight', () => ({
  preflightMode: jest.fn(() => 'production'),
}));
jest.mock('@/lib/crypto/derived-secrets', () => ({
  sessionSigningKey: () => Buffer.alloc(32, 7),
}));

import { NextResponse } from 'next/server';
import { applySessionCookie } from '@/lib/api/session';
import { preflightMode } from '@/lib/api/preflight';
import { serverEnv } from '@/lib/api/env';

const mockMode = preflightMode as jest.Mock;
const mockEnv = serverEnv as unknown as { isProduction: boolean };

function setCookieHeader(): string {
  const response = NextResponse.json({ ok: true });
  applySessionCookie(response, 'token-value', Date.now() + 60_000);
  return response.headers.get('set-cookie') ?? '';
}

describe('session cookie Secure attribute by preflight tier', () => {
  afterEach(() => {
    mockMode.mockReturnValue('production');
    mockEnv.isProduction = true;
  });

  it('is Secure in production', () => {
    expect(setCookieHeader()).toMatch(/;\s*Secure/i);
  });

  it('is NOT Secure under the acknowledged evaluation tier (plain-http testnets)', () => {
    mockMode.mockReturnValue('evaluation');
    expect(setCookieHeader()).not.toMatch(/;\s*Secure/i);
  });

  it('is NOT Secure in development', () => {
    mockEnv.isProduction = false;
    mockMode.mockReturnValue('development');
    expect(setCookieHeader()).not.toMatch(/;\s*Secure/i);
  });

  it('always stays HttpOnly regardless of tier', () => {
    mockMode.mockReturnValue('evaluation');
    expect(setCookieHeader()).toMatch(/HttpOnly/i);
  });
});
