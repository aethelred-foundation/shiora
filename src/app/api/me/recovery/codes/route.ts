// ============================================================
// Shiora on Aethelred — Recovery-code batch management (consultant P0)
// POST /api/me/recovery/codes — mint a fresh batch (plaintext returned once;
//   replaces and invalidates any prior batch).
// GET  /api/me/recovery/codes — batch status (never the codes).
// ============================================================

import { NextRequest } from 'next/server';

import { successResponse, HTTP } from '@/lib/api/responses';
import { AUTH_RATE_LIMIT, requireAuth, runMiddleware } from '@/lib/api/middleware';
import { requireStepUp } from '@/lib/api/step-up';
import { generateRecoveryCodes, recoveryCodeStatus } from '@/lib/api/recovery-service';
import { audit } from '@/lib/api/audit';

export async function POST(request: NextRequest) {
  // Minting codes rotates a credential: auth-class budget and, for accounts
  // with MFA, a fresh step-up proof (a stolen session must not be able to
  // replace the recovery batch with one the attacker controls).
  const blocked = await runMiddleware(request, { ...AUTH_RATE_LIMIT, requireAuth: true });
  if (blocked) return blocked;

  const auth = requireAuth(request);
  if ('status' in auth) return auth;

  const address = auth.walletAddress!;
  const stepUp = await requireStepUp(request, address);
  if (stepUp) return stepUp;

  const { codes, generatedAt } = await generateRecoveryCodes(address);

  audit({
    action: 'RECOVERY_CODES_GENERATE',
    actor: address,
    subject: address,
    resource: 'recovery-codes',
    success: true,
    metadata: { count: codes.length },
  });

  return successResponse({ codes, generatedAt, count: codes.length }, HTTP.CREATED, {
    message:
      'Store these codes somewhere safe and offline. Each works once; '
      + 'generating a new batch invalidates all of these.',
  });
}

export async function GET(request: NextRequest) {
  const blocked = await runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const auth = requireAuth(request);
  if ('status' in auth) return auth;

  return successResponse(await recoveryCodeStatus(auth.walletAddress!));
}
