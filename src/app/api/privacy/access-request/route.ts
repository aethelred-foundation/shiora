/**
 * Shiora on Aethelred — Privacy Access Request API Route
 *
 * POST /api/privacy/access-request — Submit a GDPR data access request (Article 15)
 */

import { NextRequest } from 'next/server';

import type { PrivacyRequest } from '@/types';
import { seededHex } from '@/lib/utils';
import { runMiddleware } from '@/lib/api/middleware';
import { successResponse, errorResponse, HTTP } from '@/lib/api/responses';

// ---------------------------------------------------------------------------
// POST /api/privacy/access-request
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const blocked = runMiddleware(request);
  if (blocked) return blocked;

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

    const seed = Date.now();
    const privacyRequest: PrivacyRequest = {
      id: `priv-${seededHex(seed, 12)}`,
      type: 'access',
      status: 'pending',
      requestedAt: Date.now(),
      details: 'Request full export of selected personal health data categories',
      dataCategories: categories,
    };

    return successResponse(privacyRequest, HTTP.CREATED);
  } catch {
    return errorResponse(
      'INTERNAL_ERROR',
      'Failed to submit access request',
      HTTP.INTERNAL,
    );
  }
}
