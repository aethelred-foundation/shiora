import { type NextRequest } from 'next/server';

import { serverEnv } from './env';

export function getAllowedOrigins(): string[] {
  return serverEnv.allowedOrigins;
}

export function isAllowedOrigin(origin: string | null | undefined): boolean {
  if (!origin) return false;

  return serverEnv.allowedOrigins.some((allowedOrigin) => {
    if (origin === allowedOrigin) return true;

    try {
      const allowed = new URL(allowedOrigin);
      const candidate = new URL(origin);

      return allowed.protocol === candidate.protocol
        && allowed.hostname.startsWith('.')
        && candidate.hostname.endsWith(allowed.hostname);
    } catch {
      return false;
    }
  });
}

export function getCorsHeaders(request: NextRequest): Record<string, string> {
  const origin = request.headers.get('origin');
  if (!isAllowedOrigin(origin)) {
    return {
      Vary: 'Origin',
    };
  }

  return {
    'Access-Control-Allow-Origin': origin!,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Request-ID, X-CSRF-Token',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

export function isMutatingMethod(method: string): boolean {
  return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase());
}

export function hasDisallowedOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  return !!origin && !isAllowedOrigin(origin);
}
