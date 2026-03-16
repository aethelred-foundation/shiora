/**
 * Shiora on Aethelred — Privacy Portability Request API Route
 *
 * POST /api/privacy/portability — Submit a GDPR data portability request (Article 20)
 */

import { NextRequest } from 'next/server';

import type { PrivacyRequest } from '@/types';
import { seededHex } from '@/lib/utils';
import { runMiddleware } from '@/lib/api/middleware';
import { successResponse, errorResponse, HTTP } from '@/lib/api/responses';

// ---------------------------------------------------------------------------
// POST /api/privacy/portability
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const blocked = runMiddleware(request);
  if (blocked) return blocked;

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
    const validFormats = ['json', 'csv', 'xml'];
    if (!validFormats.includes(exportFormat)) {
      return errorResponse(
        'VALIDATION_ERROR',
        `format must be one of: ${validFormats.join(', ')}`,
        HTTP.BAD_REQUEST,
      );
    }

    const seed = Date.now();
    const privacyRequest: PrivacyRequest = {
      id: `priv-${seededHex(seed, 12)}`,
      type: 'portability',
      status: 'pending',
      requestedAt: Date.now(),
      details: `Export selected data in ${exportFormat} format for portability transfer`,
      dataCategories: categories,
    };

    return successResponse(privacyRequest, HTTP.CREATED);
  } catch {
    return errorResponse(
      'INTERNAL_ERROR',
      'Failed to submit portability request',
      HTTP.INTERNAL,
    );
  }
}
