// ============================================================
// Shiora on Aethelred — Access Grant Signature Challenge
// POST /api/access/challenge — issue a payload-bound, five-minute challenge
// ============================================================

import { NextRequest } from 'next/server';
import { ZodError } from 'zod';

import { createGrantAuthorizationChallenge } from '@/lib/api/grant-authorization';
import { AUTH_RATE_LIMIT, requireAuth, runMiddleware } from '@/lib/api/middleware';
import { errorResponse, HTTP, successResponse, validationError } from '@/lib/api/responses';
import { GrantCreateSchema, isZeroAethelredAddress } from '@/lib/api/validation';

export async function POST(request: NextRequest) {
  const blocked = await runMiddleware(request, {
    ...AUTH_RATE_LIMIT,
    requireAuth: true,
    scope: 'grant-authorization',
  });
  if (blocked) return blocked;

  try {
    const auth = requireAuth(request);
    if ('status' in auth) return auth;

    const grant = GrantCreateSchema.parse(await request.json());
    const ownerAddress = auth.walletAddress!.toLowerCase();

    if (isZeroAethelredAddress(grant.address)) {
      return errorResponse(
        'INVALID_PROVIDER_ADDRESS',
        'Provider wallet address cannot be the zero address.',
        HTTP.UNPROCESSABLE,
      );
    }

    if (grant.address === ownerAddress) {
      return errorResponse(
        'SELF_GRANT_NOT_ALLOWED',
        'You cannot grant record access to your own wallet address.',
        HTTP.UNPROCESSABLE,
      );
    }

    return successResponse(createGrantAuthorizationChallenge(ownerAddress, grant), HTTP.OK, {
      message: 'Sign this exact access grant to continue.',
    });
  } catch (err) {
    if (err instanceof ZodError) return validationError(err);
    throw err;
  }
}
