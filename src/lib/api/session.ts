import crypto from 'node:crypto';

import { type NextRequest, type NextResponse } from 'next/server';

import { serverEnv } from './env';

interface SessionClaims {
  sub: string;
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
  return crypto
    .createHmac('sha256', serverEnv.sessionSecret)
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

export function createSessionToken(address: string): { token: string; expiresAt: number } {
  const issuedAt = Date.now();
  const expiresAt = issuedAt + serverEnv.sessionTtlHours * 60 * 60 * 1000;
  const claims: SessionClaims = {
    sub: address,
    iat: issuedAt,
    exp: expiresAt,
    v: TOKEN_VERSION,
  };

  const encodedPayload = encodeBase64Url(JSON.stringify(claims));
  const signature = sign(encodedPayload);

  return {
    token: `${encodedPayload}.${signature}`,
    expiresAt,
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
    secure: serverEnv.isProduction,
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
    secure: serverEnv.isProduction,
    path: '/',
    expires: new Date(0),
  });
}
