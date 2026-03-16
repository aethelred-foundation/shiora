/** @jest-environment node */
import { NextRequest } from 'next/server';
import { createSessionToken } from '@/lib/api/session';
import { seededAddress } from '@/lib/utils';

export const TEST_ADDRESS = seededAddress(12345);
export const TEST_TOKEN = createSessionToken(TEST_ADDRESS).token;

export function createAuthedRequest(
  url: string,
  init?: RequestInit,
): NextRequest {
  return new NextRequest(url, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      authorization: `Bearer ${TEST_TOKEN}`,
    },
  });
}

export function createRequest(url: string, init?: RequestInit): NextRequest {
  return new NextRequest(url, init);
}
