import crypto from 'node:crypto';

import { NextRequest, NextResponse } from 'next/server';

import { serverEnv } from '@/lib/api/env';
import { runMiddleware } from '@/lib/api/middleware';

// ---------------------------------------------------------------------------
// GET /api/wallet/challenge — issue a time-limited, HMAC-signed challenge
// The client signs this challenge with its wallet, then sends the signed
// payload to POST /api/wallet/connect for session creation.
// ---------------------------------------------------------------------------

const CHALLENGE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function createChallenge(address: string): {
  message: string;
  nonce: string;
  issuedAt: number;
  expiresAt: number;
  hmac: string;
} {
  const nonce = crypto.randomBytes(32).toString('hex');
  const issuedAt = Date.now();
  const expiresAt = issuedAt + CHALLENGE_TTL_MS;

  // Human-readable message the wallet will sign
  const message = [
    'Shiora on Aethelred — Wallet Authentication',
    '',
    `Address: ${address}`,
    `Nonce: ${nonce}`,
    `Issued: ${new Date(issuedAt).toISOString()}`,
    `Expires: ${new Date(expiresAt).toISOString()}`,
    '',
    'Sign this message to authenticate with Shiora.',
    'This request will not trigger a blockchain transaction.',
  ].join('\n');

  // HMAC binds the challenge to our server secret so it cannot be forged
  const payload = `${address}:${nonce}:${issuedAt}:${expiresAt}`;
  const hmac = crypto
    .createHmac('sha256', serverEnv.sessionSecret)
    .update(payload)
    .digest('hex');

  return { message, nonce, issuedAt, expiresAt, hmac };
}

// NOTE: verifyChallenge() lives in @/lib/api/challenge.ts to avoid
// exporting non-route functions from a Next.js App Router route file.

export async function GET(request: NextRequest) {
  const blocked = runMiddleware(request);
  if (blocked) return blocked;

  const address = request.nextUrl.searchParams.get('address');

  if (!address || !/^0x[a-fA-F0-9]{40}$|^aeth[a-z0-9]{38,}$/.test(address)) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INVALID_ADDRESS',
          message: 'A valid wallet address is required',
        },
      },
      { status: 400 },
    );
  }

  const challenge = createChallenge(address.toLowerCase());

  return NextResponse.json({
    success: true,
    data: challenge,
  });
}
