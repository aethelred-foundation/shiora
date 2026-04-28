// ============================================================
// Shiora on Aethelred — Wallet Connect API
// POST /api/wallet/connect — Validate wallet and create session
// ============================================================

import { NextRequest } from 'next/server';
import { ZodError } from 'zod';
import { WalletConnectSchema } from '@/lib/api/validation';
import { successResponse, errorResponse, validationError, HTTP } from '@/lib/api/responses';
import { runMiddleware, extractAuth } from '@/lib/api/middleware';
import {
  applySessionCookie,
  clearSessionCookie,
  createSessionToken,
  SESSION_COOKIE_NAME,
} from '@/lib/api/session';
import { serverEnv } from '@/lib/api/env';
import { verifyChallenge } from '@/lib/api/challenge';
import { audit } from '@/lib/api/audit';
import { verifyWalletSignature } from '@/lib/api/wallet-verify';
import { seededRandom } from '@/lib/utils';

// ────────────────────────────────────────────────────────────
// GET /api/wallet/connect — Check session validity
// ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const blocked = runMiddleware(request);
  if (blocked) return blocked;

  const auth = extractAuth(request);
  if (!auth.isAuthenticated) {
    return errorResponse(
      'UNAUTHORIZED',
      'Session is missing, expired, or invalid.',
      HTTP.UNAUTHORIZED,
    );
  }

  return successResponse({
    address: auth.walletAddress,
    authenticated: true,
  });
}

// ────────────────────────────────────────────────────────────
// POST /api/wallet/connect
// ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const blocked = runMiddleware(request);
  if (blocked) return blocked;

  try {
    const body = await request.json();
    const validated = WalletConnectSchema.parse(body);

    // ── Step 1: Verify the HMAC-signed challenge ──────────────
    const challengeResult = verifyChallenge(
      validated.address,
      validated.nonce,
      validated.issuedAt,
      validated.expiresAt,
      validated.hmac,
    );

    if (!challengeResult.valid) {
      audit({
        action: 'WALLET_CONNECT',
        actor: validated.address,
        success: false,
        metadata: { reason: challengeResult.reason },
      });
      return errorResponse(
        'INVALID_CHALLENGE',
        challengeResult.reason /* istanbul ignore next */ ?? 'Challenge verification failed.',
        HTTP.BAD_REQUEST,
      );
    }

    // ── Step 2: Validate timestamp freshness ──────────────────
    const now = Date.now();
    const timestampDiff = Math.abs(now - validated.timestamp);
    if (timestampDiff > 5 * 60 * 1000) {
      audit({
        action: 'WALLET_CONNECT',
        actor: validated.address,
        success: false,
        metadata: { reason: 'timestamp_expired' },
      });
      return errorResponse(
        'TIMESTAMP_EXPIRED',
        'Signature timestamp has expired. Please sign a new message.',
        HTTP.BAD_REQUEST,
      );
    }

    // ── Step 3: Verify wallet signature ───────────────────────
    // Reconstruct the challenge message the wallet was asked to sign,
    // then cryptographically verify the secp256k1 signature.
    const challengeMessage = [
      'Shiora on Aethelred — Wallet Authentication',
      '',
      `Address: ${validated.address}`,
      `Nonce: ${validated.nonce}`,
      `Issued: ${new Date(validated.issuedAt).toISOString()}`,
      `Expires: ${new Date(validated.expiresAt).toISOString()}`,
      '',
      'Sign this message to authenticate with Shiora.',
      'This request will not trigger a blockchain transaction.',
    ].join('\n');

    const signatureValid = verifyWalletSignature(
      challengeMessage,
      validated.signature,
      validated.address,
    );

    if (!signatureValid) {
      audit({
        action: 'WALLET_CONNECT',
        actor: validated.address,
        success: false,
        metadata: { reason: 'invalid_signature' },
      });
      return errorResponse(
        'INVALID_SIGNATURE',
        'Wallet signature verification failed.',
        HTTP.BAD_REQUEST,
      );
    }

    // ── Step 4: Create session ────────────────────────────────
    const seed = Date.now();
    const { token, expiresAt } = createSessionToken(validated.address);

    audit({
      action: 'WALLET_CONNECT',
      actor: validated.address,
      success: true,
      metadata: { chainId: validated.chainId },
    });

    const response = successResponse(
      {
        address: validated.address,
        expiresAt,
        expiresIn: `${serverEnv.sessionTtlHours}h`,
        session: {
          transport: 'httpOnly-cookie',
          cookieName: SESSION_COOKIE_NAME,
        },
        balances: {
          aethel: parseFloat((48000 + seededRandom(seed) * 5000).toFixed(2)),
        },
        profile: {
          recordCount: 147,
          activeGrants: 3,
          lastActivity: now - 3600000,
          memberSince: now - 180 * 86400000,
        },
      },
      HTTP.OK,
      { message: 'Wallet connected successfully.' },
    );

    applySessionCookie(response, token, expiresAt);
    return response;
  } catch (err) {
    if (err instanceof ZodError) return validationError(err);
    throw err;
  }
}

export async function DELETE(request: NextRequest) {
  const blocked = runMiddleware(request);
  if (blocked) return blocked;

  audit({
    action: 'WALLET_DISCONNECT',
    actor: 'session',
    success: true,
  });

  const response = successResponse(
    {
      disconnected: true,
    },
    HTTP.OK,
    {
      message: 'Wallet session cleared.',
    },
  );

  clearSessionCookie(response);
  return response;
}
