import crypto from 'node:crypto';

import { type NextRequest, type NextResponse } from 'next/server';

import { serverEnv } from './env';
import { preflightMode } from './preflight';
import { sessionSigningKey } from '@/lib/crypto/derived-secrets';

export interface SessionClaims {
  /** Subject — the wallet address this session authenticates. */
  sub: string;
  /** Unique token id — the handle used to revoke this specific session. */
  jti: string;
  iat: number;
  exp: number;
  v: 1;
}

const TOKEN_VERSION = 1 as const;

export const SESSION_COOKIE_NAME = serverEnv.isProduction
  ? '__Host-shiora_session'
  : 'shiora_session';

function encodeBase64Url(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function decodeBase64Url(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function sign(payload: string): string {
  // Domain-separated subkey, not the raw root secret (see derived-secrets).
  return crypto
    .createHmac('sha256', sessionSigningKey())
    .update(payload)
    .digest('base64url');
}

function safeCompare(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);

  if (left.length !== right.length) {
    return false;
  }

  return crypto.timingSafeEqual(left, right);
}

export function createSessionToken(
  address: string,
): { token: string; expiresAt: number; claims: SessionClaims } {
  const issuedAt = Date.now();
  const expiresAt = issuedAt + serverEnv.sessionTtlHours * 60 * 60 * 1000;
  const claims: SessionClaims = {
    sub: address,
    jti: crypto.randomUUID(),
    iat: issuedAt,
    exp: expiresAt,
    v: TOKEN_VERSION,
  };

  const encodedPayload = encodeBase64Url(JSON.stringify(claims));
  const signature = sign(encodedPayload);

  return {
    token: `${encodedPayload}.${signature}`,
    expiresAt,
    claims,
  };
}

export function verifySessionToken(token: string | null | undefined): SessionClaims | null {
  if (!token) return null;

  const [payload, providedSignature] = token.split('.');
  if (!payload || !providedSignature) {
    return null;
  }

  const expectedSignature = sign(payload);
  if (!safeCompare(providedSignature, expectedSignature)) {
    return null;
  }

  try {
    const claims = JSON.parse(decodeBase64Url(payload)) as SessionClaims;
    if (claims.v !== TOKEN_VERSION) return null;
    if (!claims.sub || typeof claims.sub !== 'string') return null;
    if (!claims.jti || typeof claims.jti !== 'string') return null;
    if (claims.exp <= Date.now()) return null;
    return claims;
  } catch {
    return null;
  }
}

export function extractSessionToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  return request.cookies.get(SESSION_COOKIE_NAME)?.value ?? null;
}

/**
 * Whether the session cookie carries the Secure attribute. Production PHI
 * deployments always do. An acknowledged evaluation deployment has already
 * accepted TRANSPORT_NOT_HARDENED (plain http) — and a Secure-only cookie on
 * plain http is silently DROPPED by the browser, so wallet connect "succeeds"
 * and every following request is 401 (hit twice in testnet field testing).
 * The relaxation therefore follows the same explicit acknowledgment as the
 * transport gate itself.
 */
function sessionCookieSecure(): boolean {
  return serverEnv.isProduction && preflightMode() !== 'evaluation';
}

export function applySessionCookie(
  response: NextResponse,
  token: string,
  expiresAt: number,
): void {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: 'lax',
    secure: sessionCookieSecure(),
    path: '/',
    expires: new Date(expiresAt),
  });
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    secure: sessionCookieSecure(),
    path: '/',
    expires: new Date(0),
  });
}
