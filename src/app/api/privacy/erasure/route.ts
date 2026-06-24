/**
 * Shiora on Aethelred — Privacy Erasure Request API Route
 *
 * POST /api/privacy/erasure — GDPR right to erasure (Article 17).
 * Soft-deletes the authenticated data subject's records and revokes their
 * active consents and access grants.
 */

import { NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';

import type { PrivacyRequest } from '@/types';
import { requireAuth, runMiddleware } from '@/lib/api/middleware';
import { successResponse, errorResponse, HTTP } from '@/lib/api/responses';
import { eraseUserData } from '@/lib/api/privacy';
import { audit } from '@/lib/api/audit';

export async function POST(request: NextRequest) {
  const blocked = runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const auth = requireAuth(request);
  if ('status' in auth) return auth;

  try {
    const body = await request.json();
    const { categories } = body as { categories?: string[] };

    if (!categories || !Array.isArray(categories) || categories.length === 0) {
      return errorResponse(
        'VALIDATION_ERROR',
        'categories is required and must be a non-empty array of data category strings',
        HTTP.BAD_REQUEST,
      );
    }

    const owner = auth.walletAddress!;
    const summary = await eraseUserData(owner);

    const privacyRequest: PrivacyRequest = {
      id: `priv-${randomUUID().replace(/-/g, '')}`,
      type: 'erasure',
      status: 'completed',
      requestedAt: Date.now(),
      completedAt: Date.now(),
      details: `Erased ${summary.recordsErased} records, revoked ${summary.consentsRevoked} consents and ${summary.grantsRevoked} access grants.`,
      dataCategories: categories,
    };

    audit({
      action: 'DATA_ERASURE',
      actor: owner,
      resource: 'privacy',
      resourceId: privacyRequest.id,
      success: true,
      metadata: { type: 'erasure', ...summary },
    });

    return successResponse({ request: privacyRequest, summary }, HTTP.CREATED);
  } catch {
    return errorResponse('INTERNAL_ERROR', 'Failed to submit erasure request', HTTP.INTERNAL);
  }
}
