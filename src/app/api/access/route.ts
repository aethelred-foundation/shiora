// ============================================================
// Shiora on Aethelred — Access Grants API
// GET  /api/access — List access grants with filtering
// POST /api/access — Create a new access grant
// ============================================================

import { NextRequest } from 'next/server';
import { ZodError } from 'zod';
import {
  GrantCreateSchema,
  GrantListQuerySchema,
  parseSearchParams,
} from '@/lib/api/validation';
import {
  successResponse,
  paginatedResponse,
  validationError,
  HTTP,
} from '@/lib/api/responses';
import { requireAuth, runMiddleware } from '@/lib/api/middleware';
import type { MockAccessGrant } from '@/lib/api/mock-data';
import { createAccessGrant, listAccessGrants } from '@/lib/api/store';
import { seededHex, generateTxHash, generateAttestation } from '@/lib/utils';

// ────────────────────────────────────────────────────────────
// GET /api/access
// ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const blocked = runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  try {
    const auth = requireAuth(request);
    if ('status' in auth) return auth;

    const query = parseSearchParams(
      GrantListQuerySchema,
      request.nextUrl.searchParams,
    );

    const allGrants = listAccessGrants(auth.walletAddress!);
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
  const blocked = runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  try {
    const auth = requireAuth(request);
    if ('status' in auth) return auth;

    const body = await request.json();
    const validated = GrantCreateSchema.parse(body);

    const seed = Date.now();
    const expiresAt = Date.now() + validated.durationDays * 86400000;

    const newGrant: MockAccessGrant = {
      id: `grant-${seededHex(seed, 8)}`,
      provider: validated.provider,
      specialty: validated.specialty,
      address: validated.address,
      status: 'Pending',
      scope: validated.scope,
      grantedAt: Date.now(),
      expiresAt,
      lastAccess: null,
      accessCount: 0,
      txHash: generateTxHash(seed),
      attestation: generateAttestation(seed),
      canView: validated.canView,
      canDownload: validated.canDownload,
      canShare: validated.canShare,
      ownerAddress: auth.walletAddress!,
    };

    const persistedGrant = createAccessGrant(auth.walletAddress!, newGrant);

    return successResponse(persistedGrant, HTTP.CREATED, {
      message: 'Access grant created. Pending blockchain confirmation.',
      estimatedConfirmation: '~6 seconds (2 blocks)',
    });
  } catch (err) {
    if (err instanceof ZodError) return validationError(err);
    throw err;
  }
}
