// ============================================================
// Shiora on Aethelred — Access Grants API
// GET  /api/access — List access grants with filtering
// POST /api/access — Create a new access grant
// ============================================================

import { NextRequest } from 'next/server';
import { ZodError } from 'zod';
import {
  AuthorizedGrantCreateSchema,
  GrantListQuerySchema,
  isZeroAethelredAddress,
  parseSearchParams,
} from '@/lib/api/validation';
import {
  errorResponse,
  successResponse,
  paginatedResponse,
  validationError,
  HTTP,
} from '@/lib/api/responses';
import { AUTH_RATE_LIMIT, requireAuth, runMiddleware } from '@/lib/api/middleware';
import { randomUUID } from 'node:crypto';
import type { MockAccessGrant } from '@/lib/api/mock-data';
import { createAccessGrant, listAccessGrants } from '@/lib/api/access-service';
import { notify } from '@/lib/api/notification-service';
import { verifyGrantAuthorizationChallenge } from '@/lib/api/grant-authorization';
import { verifyWalletSignature } from '@/lib/api/wallet-verify';
import { getNonceStore } from '@/lib/persistence/nonce-store';
import { createLogger } from '@/lib/observability/logger';

const log = createLogger({ subsystem: 'access-grants' });

// ────────────────────────────────────────────────────────────
// GET /api/access
// ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const blocked = await runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  try {
    const auth = requireAuth(request);
    if ('status' in auth) return auth;

    const query = parseSearchParams(
      GrantListQuerySchema,
      request.nextUrl.searchParams,
    );

    const allGrants = await listAccessGrants(auth.walletAddress!);
    let grants = [...allGrants];

    // Filter by status
    if (query.status) {
      grants = grants.filter((g) => g.status === query.status);
    }

    // Search
    if (query.q) {
      const q = query.q.toLowerCase();
      grants = grants.filter(
        (g) =>
          g.provider.toLowerCase().includes(q) ||
          g.specialty.toLowerCase().includes(q) ||
          g.scope.toLowerCase().includes(q),
      );
    }

    const total = grants.length;
    const start = (query.page - 1) * query.limit;
    const paged = grants.slice(start, start + query.limit);

    return paginatedResponse(paged, total, query.page, query.limit, {
      summary: {
        active: allGrants.filter((g) => g.status === 'Active').length,
        pending: allGrants.filter((g) => g.status === 'Pending').length,
        expired: allGrants.filter((g) => g.status === 'Expired').length,
        revoked: allGrants.filter((g) => g.status === 'Revoked').length,
      },
    });
  } catch (err) {
    if (err instanceof ZodError) return validationError(err);
    throw err;
  }
}

// ────────────────────────────────────────────────────────────
// POST /api/access
// ────────────────────────────────────────────────────────────

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

    const body = await request.json();
    const validated = AuthorizedGrantCreateSchema.parse(body);
    const { authorization, ...grant } = validated;
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

    const challengeResult = verifyGrantAuthorizationChallenge(
      ownerAddress,
      grant,
      authorization,
    );
    if (!challengeResult.valid) {
      return errorResponse(
        'INVALID_GRANT_AUTHORIZATION',
        challengeResult.reason,
        HTTP.BAD_REQUEST,
      );
    }

    if (!verifyWalletSignature(
      challengeResult.message,
      authorization.signature,
      ownerAddress,
    )) {
      return errorResponse(
        'INVALID_GRANT_SIGNATURE',
        'The access grant was not signed by the wallet for this session.',
        HTTP.FORBIDDEN,
      );
    }

    // Domain-prefix grant nonces so a value can never collide with a wallet
    // login challenge. The store claim is atomic across Postgres replicas.
    const fresh = await getNonceStore().consume(
      `access-grant:${authorization.nonce}`,
      authorization.expiresAt,
    );
    if (!fresh) {
      return errorResponse(
        'GRANT_AUTHORIZATION_ALREADY_USED',
        'This access-grant authorization has already been used. Please sign a new one.',
        HTTP.CONFLICT,
      );
    }

    const expiresAt = Date.now() + grant.durationDays * 86400000;

    const newGrant: MockAccessGrant = {
      id: `grant-${randomUUID().replace(/-/g, '')}`,
      provider: grant.provider,
      specialty: grant.specialty,
      address: grant.address,
      // Grants take effect immediately and are enforced by the platform's
      // RBAC + tamper-evident audit trail — there is no on-chain confirmation
      // step to be "Pending" on, and no txHash/attestation to fabricate.
      status: 'Active',
      scope: grant.scope,
      grantedAt: Date.now(),
      expiresAt,
      lastAccess: null,
      accessCount: 0,
      txHash: '',
      attestation: '',
      canView: grant.canView,
      canDownload: grant.canDownload,
      canShare: grant.canShare,
      ownerAddress,
    };

    const persistedGrant = await createAccessGrant(ownerAddress, newGrant);

    // Tell the provider they've been granted access (push counterpart to the
    // grants they can already query).
    // The grant is the durable source of truth. A notification failure must not
    // turn a successful mutation into a 500: the nonce is already consumed and
    // a retry would correctly be rejected as a replay even though the grant
    // exists. Log the delivery failure and return the persisted grant.
    try {
      await notify(persistedGrant.address, {
        type: 'consent',
        title: 'You were granted record access',
        body: 'A patient granted you access to their health records.',
      });
    } catch (err) {
      log.error('provider grant notification failed', {
        err,
        grantId: persistedGrant.id,
      });
    }

    return successResponse(persistedGrant, HTTP.CREATED, {
      message: 'Access grant created.',
    });
  } catch (err) {
    if (err instanceof ZodError) return validationError(err);
    throw err;
  }
}
