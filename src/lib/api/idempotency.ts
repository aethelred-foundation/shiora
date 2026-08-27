// ============================================================
// Shiora on Aethelred — Idempotent request wrapper (GAP-17)
//
// Wrap a mutating route handler so that, when the client sends an
// `Idempotency-Key`, a retry replays the original response instead of acting
// twice. Idempotency is opt-in: a request without the header runs normally.
// Keys are scoped per caller and per endpoint, so one client's key can never
// collide with another's, and reusing a key on a different endpoint is a
// client error (422).
// ============================================================

import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

import { errorResponse, HTTP } from './responses';
import { getIdempotencyStore } from '@/lib/persistence/idempotency-store';

/** How long a recorded response stays replayable. */
export const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

const HEADER = 'idempotency-key';

// The key is scoped per caller only (NOT per endpoint): reusing one key across
// two endpoints is a client error the fingerprint check surfaces as a mismatch.
function storeKey(scope: string, key: string): string {
  return crypto.createHash('sha256').update(`${scope} ${key}`).digest('hex');
}

/**
 * Run `handler` under idempotency protection. `scope` isolates keys per caller
 * (pass the wallet address). Only successful, replay-safe responses are
 * recorded; a handler that throws leaves the key reserved but un-recorded, so
 * it expires and a later retry starts fresh.
 */
export async function withIdempotency(
  request: NextRequest,
  scope: string,
  handler: () => Promise<NextResponse>,
): Promise<NextResponse> {
  const clientKey = request.headers.get(HEADER);
  if (!clientKey) {
    return handler();
  }

  const endpoint = `${request.method} ${new URL(request.url).pathname}`;
  const key = storeKey(scope, clientKey);
  const store = getIdempotencyStore();

  const begin = await store.begin(key, endpoint, Date.now() + IDEMPOTENCY_TTL_MS);

  if (begin.kind === 'mismatch') {
    return errorResponse(
      'IDEMPOTENCY_KEY_REUSED',
      'This Idempotency-Key was already used for a different request.',
      HTTP.UNPROCESSABLE,
    );
  }
  if (begin.kind === 'in_flight') {
    return errorResponse(
      'IDEMPOTENCY_IN_PROGRESS',
      'A request with this Idempotency-Key is still being processed. Retry shortly.',
      HTTP.CONFLICT,
    );
  }
  if (begin.kind === 'replay') {
    return new NextResponse(begin.response.body, {
      status: begin.response.status,
      headers: {
        'Content-Type': 'application/json',
        'Idempotent-Replayed': 'true',
      },
    });
  }

  // begin.kind === 'started' — run the handler and record its response.
  const response = await handler();
  const body = await response.clone().text();
  await store.complete(key, response.status, body);
  return response;
}
