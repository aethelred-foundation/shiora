// ============================================================
// Shiora on Aethelred — Single Access Grant API
// GET    /api/access/[id] — Get grant details
// PATCH  /api/access/[id] — Modify grant scope/permissions
// DELETE /api/access/[id] — Revoke access grant
// ============================================================

import { NextRequest } from 'next/server';
import { ZodError } from 'zod';
import { GrantUpdateSchema } from '@/lib/api/validation';
import {
  successResponse,
  notFoundResponse,
  errorResponse,
  validationError,
  HTTP,
} from '@/lib/api/responses';
import { requireAuth, runMiddleware } from '@/lib/api/middleware';
import { getAccessGrant, updateAccessGrant } from '@/lib/api/store';
import { generateTxHash } from '@/lib/utils';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// ────────────────────────────────────────────────────────────
// GET /api/access/[id]
// ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest, context: RouteContext) {
  const blocked = runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const auth = requireAuth(request);
  if ('status' in auth) return auth;

  const { id } = await context.params;
  const grant = getAccessGrant(auth.walletAddress!, id);

  if (!grant) {
    return notFoundResponse('AccessGrant', id);
  }

  const daysLeft = Math.max(
    0,
    Math.round((grant.expiresAt - Date.now()) / 86400000),
  );

  return successResponse({
    ...grant,
    daysRemaining: daysLeft,
    isExpiringSoon: daysLeft > 0 && daysLeft <= 7,
    permissions: {
      view: grant.canView,
      download: grant.canDownload,
      share: grant.canShare,
    },
    blockchain: {
      txHash: grant.txHash,
      attestation: grant.attestation,
      providerAddress: grant.address,
      ownerAddress: grant.ownerAddress,
    },
  });
}

// ────────────────────────────────────────────────────────────
// PATCH /api/access/[id]
// ────────────────────────────────────────────────────────────

export async function PATCH(request: NextRequest, context: RouteContext) {
  const blocked = runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const auth = requireAuth(request);
  if ('status' in auth) return auth;

  const { id } = await context.params;
  const grant = getAccessGrant(auth.walletAddress!, id);

  if (!grant) {
    return notFoundResponse('AccessGrant', id);
  }

  if (grant.status !== 'Active' && grant.status !== 'Pending') {
    return errorResponse(
      'GRANT_NOT_MODIFIABLE',
      `Cannot modify a grant with status '${grant.status}'. Only Active or Pending grants can be modified.`,
      HTTP.CONFLICT,
    );
  }

  try {
    const body = await request.json();
    const validated = GrantUpdateSchema.parse(body);

    const updated = updateAccessGrant(auth.walletAddress!, id, {
      ...(validated.scope !== undefined && { scope: validated.scope }),
      ...(validated.canView !== undefined && { canView: validated.canView }),
      ...(validated.canDownload !== undefined && { canDownload: validated.canDownload }),
      ...(validated.canShare !== undefined && { canShare: validated.canShare }),
      ...(validated.durationDays !== undefined && {
        expiresAt: Date.now() + validated.durationDays * 86400000,
      }),
    });

    if (!updated) {
      return notFoundResponse('AccessGrant', id);
    }

    return successResponse(updated, HTTP.OK, {
      message: 'Access grant modified. Transaction submitted to blockchain.',
    });
  } catch (err) {
    if (err instanceof ZodError) return validationError(err);
    throw err;
  }
}

// ────────────────────────────────────────────────────────────
// DELETE /api/access/[id] — Revoke
// ────────────────────────────────────────────────────────────

export async function DELETE(request: NextRequest, context: RouteContext) {
  const blocked = runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const auth = requireAuth(request);
  if ('status' in auth) return auth;

  const { id } = await context.params;
  const grant = getAccessGrant(auth.walletAddress!, id);

  if (!grant) {
    return notFoundResponse('AccessGrant', id);
  }

  if (grant.status === 'Revoked') {
    return errorResponse(
      'ALREADY_REVOKED',
      'This access grant has already been revoked.',
      HTTP.CONFLICT,
    );
  }

  const revokedGrant = updateAccessGrant(auth.walletAddress!, id, {
    status: 'Revoked',
  });

  if (!revokedGrant) {
    return notFoundResponse('AccessGrant', id);
  }

  return successResponse(
    {
      id: revokedGrant.id,
      status: revokedGrant.status,
      revokedAt: Date.now(),
      revokeTxHash: generateTxHash(Date.now()),
      message: 'Access revoked. Provider can no longer access your data.',
    },
    HTTP.OK,
  );
}
