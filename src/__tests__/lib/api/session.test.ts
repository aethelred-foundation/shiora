/** @jest-environment node */

import { NextRequest, NextResponse } from 'next/server';

import {
  SESSION_COOKIE_NAME,
  applySessionCookie,
  clearSessionCookie,
  createSessionToken,
  verifySessionToken,
} from '@/lib/api/session';
import { seededAddress } from '@/lib/utils';

describe('session utilities', () => {
  it('creates and verifies a signed session token', () => {
    const address = seededAddress(123);
    const { token } = createSessionToken(address);

    expect(verifySessionToken(token)).toEqual(
      expect.objectContaining({
        sub: address,
        v: 1,
      }),
    );
  });

  it('rejects a tampered session token', () => {
    const address = seededAddress(456);
    const { token } = createSessionToken(address);
    const [payload, signature] = token.split('.');
    const tamperedToken = `${payload}.${signature}tampered`;

    expect(verifySessionToken(tamperedToken)).toBeNull();
  });

  it('writes and clears the session cookie on a response', () => {
    const response = NextResponse.json({ success: true });
    const { token, expiresAt } = createSessionToken(seededAddress(789));

    applySessionCookie(response, token, expiresAt);
    expect(response.cookies.get(SESSION_COOKIE_NAME)?.value).toBe(token);

    clearSessionCookie(response);
    expect(response.cookies.get(SESSION_COOKIE_NAME)?.value).toBe('');
  });

  it('verifySessionToken returns null for null/undefined', () => {
    expect(verifySessionToken(null)).toBeNull();
    expect(verifySessionToken(undefined)).toBeNull();
    expect(verifySessionToken('')).toBeNull();
  });

  it('verifySessionToken returns null for token without dot', () => {
    expect(verifySessionToken('nodottoken')).toBeNull();
  });

  it('verifySessionToken returns null for expired token', () => {
    const address = seededAddress(111);
    const { token } = createSessionToken(address);
    // Manually create an expired token by manipulating the payload
    const [payload] = token.split('.');
    // Decode and re-encode with expired time
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString());
    decoded.exp = Date.now() - 1000; // expired 1 second ago
    const newPayload = Buffer.from(JSON.stringify(decoded)).toString('base64url');
    // This will have wrong signature, so it returns null
    expect(verifySessionToken(`${newPayload}.fakesig`)).toBeNull();
  });

  it('extractSessionToken extracts from Authorization header', () => {
    const { extractSessionToken } = require('@/lib/api/session');
    const request = new NextRequest('http://localhost:3000/test', {
      headers: { authorization: 'Bearer my-token-123' },
    });
    expect(extractSessionToken(request)).toBe('my-token-123');
  });

  it('extractSessionToken returns null when no auth header or cookie', () => {
    const { extractSessionToken } = require('@/lib/api/session');
    const request = new NextRequest('http://localhost:3000/test');
    expect(extractSessionToken(request)).toBeNull();
  });

  it('allows the token to be supplied through the authorization header', () => {
    const address = seededAddress(900);
    const { token } = createSessionToken(address);
    const request = new NextRequest('http://localhost:3001/api/records', {
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    const verified = verifySessionToken(request.headers.get('authorization')?.slice(7));
    expect(verified?.sub).toBe(address);
  });

  it('verifySessionToken returns null when payload JSON parse fails', () => {
    // Create a token where the payload is valid base64url but invalid JSON,
    // with a matching HMAC signature so it passes the signature check
    const crypto = require('node:crypto');
    const { serverEnv } = require('@/lib/api/env');

    // Create base64url of non-JSON content
    const invalidPayload = Buffer.from('not-valid-json!!!').toString('base64url');
    // Sign with the real session secret
    const signature = crypto
      .createHmac('sha256', serverEnv.sessionSecret)
      .update(invalidPayload)
      .digest('base64url');

    const result = verifySessionToken(`${invalidPayload}.${signature}`);
    expect(result).toBeNull();
  });

  it('verifySessionToken returns null for wrong token version', () => {
    const crypto = require('node:crypto');
    const { serverEnv } = require('@/lib/api/env');

    const claims = {
      sub: 'aeth1testaddress',
      iat: Date.now(),
      exp: Date.now() + 3600000,
      v: 99, // wrong version
    };
    const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
    const signature = crypto
      .createHmac('sha256', serverEnv.sessionSecret)
      .update(payload)
      .digest('base64url');

    expect(verifySessionToken(`${payload}.${signature}`)).toBeNull();
  });

  it('verifySessionToken returns null for missing sub field', () => {
    const crypto = require('node:crypto');
    const { serverEnv } = require('@/lib/api/env');

    const claims = {
      iat: Date.now(),
      exp: Date.now() + 3600000,
      v: 1,
    };
    const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
    const signature = crypto
      .createHmac('sha256', serverEnv.sessionSecret)
      .update(payload)
      .digest('base64url');

    expect(verifySessionToken(`${payload}.${signature}`)).toBeNull();
  });

  it('verifySessionToken returns null for expired token with valid signature', () => {
    const crypto = require('node:crypto');
    const { serverEnv } = require('@/lib/api/env');

    const claims = {
      sub: 'aeth1testexpired',
      iat: Date.now() - 7200000,
      exp: Date.now() - 3600000, // expired 1 hour ago
      v: 1,
    };
    const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
    const signature = crypto
      .createHmac('sha256', serverEnv.sessionSecret)
      .update(payload)
      .digest('base64url');

    expect(verifySessionToken(`${payload}.${signature}`)).toBeNull();
  });

  it('verifySessionToken returns null for non-string sub field', () => {
    const crypto = require('node:crypto');
    const { serverEnv } = require('@/lib/api/env');

    const claims = {
      sub: 12345, // not a string
      iat: Date.now(),
      exp: Date.now() + 3600000,
      v: 1,
    };
    const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
    const signature = crypto
      .createHmac('sha256', serverEnv.sessionSecret)
      .update(payload)
      .digest('base64url');

    expect(verifySessionToken(`${payload}.${signature}`)).toBeNull();
  });
});

describe('SESSION_COOKIE_NAME in production', () => {
  it('uses __Host- prefix in production environment', () => {
    jest.resetModules();

    const originalEnv = { ...process.env };
    process.env.NODE_ENV = 'production';
    process.env.SHIORA_SESSION_SECRET = 'a-very-long-session-secret-that-is-at-least-32-chars';

    try {
      const { SESSION_COOKIE_NAME: prodCookieName } = require('@/lib/api/session');
      expect(prodCookieName).toBe('__Host-shiora_session');
    } finally {
      process.env = originalEnv;
      jest.resetModules();
    }
  });

  it('uses plain name in non-production environment', () => {
    // Already loaded in test env
    expect(SESSION_COOKIE_NAME).toBe('shiora_session');
  });

  it('extractSessionToken reads from cookie when no Authorization header', () => {
    const { extractSessionToken } = require('@/lib/api/session');
    // Create a request with a session cookie
    const req = new NextRequest('http://localhost:3000/test', {
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=my-session-token-value`,
      },
    });
    const token = extractSessionToken(req);
    expect(token).toBe('my-session-token-value');
  });
});
