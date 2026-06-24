/**
 * Shiora on Aethelred — Privacy Access Request API Route
 *
 * POST /api/privacy/access-request — GDPR right of access (Article 15).
 * Returns the authenticated data subject's complete data across the datastore.
 */

import { NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';

import type { PrivacyRequest } from '@/types';
import { requireAuth, runMiddleware } from '@/lib/api/middleware';
import { successResponse, errorResponse, HTTP } from '@/lib/api/responses';
import { collectUserData } from '@/lib/api/privacy';
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
    const data = await collectUserData(owner);

    const privacyRequest: PrivacyRequest = {
      id: `priv-${randomUUID().replace(/-/g, '')}`,
      type: 'access',
      status: 'completed',
      requestedAt: Date.now(),
      completedAt: Date.now(),
      details: `Access fulfilled: ${data.records.length} records, ${data.consents.length} consents, ${data.accessGrants.length} access grants.`,
      dataCategories: categories,
    };

    audit({
      action: 'DATA_EXPORT',
      actor: owner,
      resource: 'privacy',
      resourceId: privacyRequest.id,
      success: true,
      metadata: { type: 'access' },
    });

    return successResponse({ request: privacyRequest, data }, HTTP.CREATED);
  } catch {
    return errorResponse('INTERNAL_ERROR', 'Failed to fulfill access request', HTTP.INTERNAL);
  }
}
