/**
 * Shiora on Aethelred — Privacy Portability Request API Route
 *
 * POST /api/privacy/portability — GDPR data portability (Article 20).
 * Exports the authenticated data subject's data in the requested format.
 */

import { NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';

import type { PrivacyRequest } from '@/types';
import { requireAuth, runMiddleware } from '@/lib/api/middleware';
import { successResponse, errorResponse, HTTP } from '@/lib/api/responses';
import { collectUserData } from '@/lib/api/privacy';
import { audit } from '@/lib/api/audit';

const VALID_FORMATS = ['json', 'csv', 'xml'];

export async function POST(request: NextRequest) {
  const blocked = await runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const auth = requireAuth(request);
  if ('status' in auth) return auth;

  try {
    const body = await request.json();
    const { categories, format } = body as { categories?: string[]; format?: string };

    if (!categories || !Array.isArray(categories) || categories.length === 0) {
      return errorResponse(
        'VALIDATION_ERROR',
        'categories is required and must be a non-empty array of data category strings',
        HTTP.BAD_REQUEST,
      );
    }

    const exportFormat = format ?? 'json';
    if (!VALID_FORMATS.includes(exportFormat)) {
      return errorResponse(
        'VALIDATION_ERROR',
        `format must be one of: ${VALID_FORMATS.join(', ')}`,
        HTTP.BAD_REQUEST,
      );
    }

    const owner = auth.walletAddress!;
    const data = await collectUserData(owner);

    const privacyRequest: PrivacyRequest = {
      id: `priv-${randomUUID().replace(/-/g, '')}`,
      type: 'portability',
      status: 'completed',
      requestedAt: Date.now(),
      completedAt: Date.now(),
      details: `Exported ${data.records.length} records, ${data.consents.length} consents, ${data.accessGrants.length} access grants in ${exportFormat} format.`,
      dataCategories: categories,
    };

    audit({
      action: 'DATA_EXPORT',
      actor: owner,
      resource: 'privacy',
      resourceId: privacyRequest.id,
      success: true,
      metadata: { type: 'portability', format: exportFormat },
    });

    return successResponse({ request: privacyRequest, format: exportFormat, data }, HTTP.CREATED);
  } catch {
    return errorResponse('INTERNAL_ERROR', 'Failed to submit portability request', HTTP.INTERNAL);
  }
}
