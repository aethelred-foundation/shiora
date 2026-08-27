// ============================================================
// Shiora on Aethelred — MFA step-up enforcement (GAP-07)
//
// TOTP enrolment existed but protected nothing: a stolen session could
// perform every sensitive operation. Step-up closes that: when an account
// has MFA enabled, high-impact routes demand a FRESH second-factor proof —
// a short-lived HMAC assertion minted by POST /api/mfa/step-up after a
// successful TOTP verification and presented via the x-shiora-step-up
// header. Accounts without MFA are unaffected (enrolment stays optional),
// so enabling MFA strictly adds protection.
// ============================================================

import crypto from 'node:crypto';
import type { NextRequest } from 'next/server';
import type { NextResponse } from 'next/server';

import { errorResponse, HTTP } from './responses';
import { getMfaStatus } from './mfa-service';
import { stepUpSigningKey } from '@/lib/crypto/derived-secrets';

/** How long a step-up assertion authorizes sensitive actions. */
export const STEP_UP_TTL_MS = 5 * 60 * 1000;

/** Header carrying the assertion on sensitive requests. */
export const STEP_UP_HEADER = 'x-shiora-step-up';

interface StepUpPayload {
  sub: string;
  iat: number;
  exp: number;
}

function sign(encodedPayload: string): string {
  return crypto
    .createHmac('sha256', stepUpSigningKey())
    .update(encodedPayload)
    .digest('base64url');
}

function safeCompare(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

/** Mint a step-up assertion after a successful TOTP verification. */
export function mintStepUpAssertion(
  address: string,
  now: number = Date.now(),
): { assertion: string; expiresAt: number } {
  const payload: StepUpPayload = { sub: address, iat: now, exp: now + STEP_UP_TTL_MS };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return { assertion: `${encoded}.${sign(encoded)}`, expiresAt: payload.exp };
}

/** Whether an assertion is genuine, for this subject, and unexpired. */
export function verifyStepUpAssertion(
  assertion: string | null,
  address: string,
  now: number = Date.now(),
): boolean {
  if (!assertion) {
    return false;
  }
  const [encoded, providedSignature] = assertion.split('.');
  if (!encoded || !providedSignature || !safeCompare(providedSignature, sign(encoded))) {
    return false;
  }
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString()) as StepUpPayload;
    return payload.sub === address && payload.exp > now;
  } catch {
    return false;
  }
}

/**
 * Gate a sensitive operation. Returns null when the caller may proceed:
 * either the account has no MFA enabled (step-up cannot be demanded for a
 * factor that does not exist) or a fresh, valid assertion was presented.
 */
export async function requireStepUp(
  request: NextRequest,
  address: string,
): Promise<NextResponse | null> {
  const status = await getMfaStatus(address);
  if (!status.enabled) {
    return null;
  }

  if (verifyStepUpAssertion(request.headers.get(STEP_UP_HEADER), address)) {
    return null;
  }

  return errorResponse(
    'STEP_UP_REQUIRED',
    'This action requires recent multi-factor verification. '
    + 'POST your TOTP code to /api/mfa/step-up and retry with the x-shiora-step-up header.',
    HTTP.FORBIDDEN,
  );
}
