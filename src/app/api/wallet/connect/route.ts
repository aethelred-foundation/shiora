// ============================================================
// Shiora on Aethelred — Wallet Connect API
// POST /api/wallet/connect — Validate wallet and create session
// ============================================================

import { NextRequest } from 'next/server';
import { ZodError } from 'zod';
import { WalletConnectSchema } from '@/lib/api/validation';
import { successResponse, errorResponse, validationError, HTTP } from '@/lib/api/responses';
import { AUTH_RATE_LIMIT, runMiddleware, extractAuth } from '@/lib/api/middleware';
import {
  applySessionCookie,
  clearSessionCookie,
  createSessionToken,
  extractSessionToken,
  verifySessionToken,
  sessionCookieName,
} from '@/lib/api/session';
import { revokeSession } from '@/lib/api/session-revocation';
import { recordIssuedSession } from '@/lib/api/session-inventory';
import { serverEnv } from '@/lib/api/env';
import { verifyChallenge } from '@/lib/api/challenge';
import { getNonceStore } from '@/lib/persistence/nonce-store';
import { getLoginAttemptStore } from '@/lib/persistence/login-attempt-store';
import { audit } from '@/lib/api/audit';
import { verifyWalletSignature } from '@/lib/api/wallet-verify';

// ────────────────────────────────────────────────────────────
// GET /api/wallet/connect — Check session validity
// ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const blocked = await runMiddleware(request);
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
  const blocked = await runMiddleware(request, AUTH_RATE_LIMIT);
  if (blocked) return blocked;

  try {
    const body = await request.json();
    const validated = WalletConnectSchema.parse(body);

    // ── Step 0: Reject if the address is locked out (audit GAP-09) ──
    // A run of failed signature verifications locks the address with
    // exponential backoff, so a targeted brute-force is throttled to a crawl.
    const lockedUntil = await getLoginAttemptStore().lockedUntil(validated.address);
    if (lockedUntil !== null) {
      audit({
        action: 'WALLET_CONNECT',
        actor: validated.address,
        success: false,
        metadata: { reason: 'locked_out', lockedUntil },
      });
      return errorResponse(
        'ACCOUNT_LOCKED',
        'Too many failed authentication attempts. Try again later.',
        HTTP.TOO_MANY_REQUESTS,
        undefined,
        { 'Retry-After': String(Math.max(1, Math.ceil((lockedUntil - Date.now()) / 1000))) },
      );
    }

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

    // ── Step 2: Enforce single-use (audit H-02) ───────────────
    // A valid, unexpired challenge may be redeemed exactly once. Consuming the
    // nonce after HMAC verification (so only genuine server-issued challenges
    // are recorded) atomically rejects any replay of the same nonce within its
    // TTL — even concurrent replays across replicas.
    const fresh = await getNonceStore().consume(validated.nonce, validated.expiresAt);
    if (!fresh) {
      audit({
        action: 'WALLET_CONNECT',
        actor: validated.address,
        success: false,
        metadata: { reason: 'nonce_replayed' },
      });
      return errorResponse(
        'CHALLENGE_ALREADY_USED',
        'This challenge has already been used. Please request a new one.',
        HTTP.BAD_REQUEST,
      );
    }

    // Freshness is enforced entirely server-side: the challenge's expiresAt is
    // HMAC-bound and checked in Step 1, and the nonce is single-use (Step 2).
    // A client-supplied timestamp adds nothing an attacker can't set (audit L-04).

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
      const outcome = await getLoginAttemptStore().recordFailure(validated.address);
      audit({
        action: 'WALLET_CONNECT',
        actor: validated.address,
        success: false,
        metadata: {
          reason: 'invalid_signature',
          failures: outcome.failures,
          ...(outcome.lockedUntil !== null ? { lockedUntil: outcome.lockedUntil } : {}),
        },
      });
      return errorResponse(
        'INVALID_SIGNATURE',
        'Wallet signature verification failed.',
        HTTP.BAD_REQUEST,
      );
    }

    // A genuine login clears the failure counter for the address.
    await getLoginAttemptStore().clear(validated.address);

    // ── Step 4: Create session ────────────────────────────────
    const { token, expiresAt, claims } = createSessionToken(validated.address);
    // Index the issued session so the owner can list/revoke devices (GAP-08).
    await recordIssuedSession(claims, request);

    audit({
      action: 'WALLET_CONNECT',
      actor: validated.address,
      success: true,
      metadata: { chainId: validated.chainId },
    });

    // The response contains only facts this server actually knows:
    // authentication outcome and session parameters. Balances and profile
    // stats are NOT fabricated here — Shiora does not query the chain, so an
    // unknown balance is reported as unknown by the client (audit L-01).
    const response = successResponse(
      {
        address: validated.address,
        expiresAt,
        expiresIn: `${serverEnv.sessionTtlHours}h`,
        session: {
          transport: 'httpOnly-cookie',
          cookieName: sessionCookieName(),
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
  const blocked = await runMiddleware(request);
  if (blocked) return blocked;

  // Server-side revoke this token so it stops being honored immediately, not
  // just cleared from the caller's cookie jar (audit M-03).
  const claims = verifySessionToken(extractSessionToken(request));
  if (claims) {
    await revokeSession(claims);
  }

  audit({
    action: 'WALLET_DISCONNECT',
    actor: claims?.sub ?? 'session',
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
