/**
 * Shiora on Aethelred — Consent API Route
 *
 * GET  /api/consent  — List consents (with optional status, scope, search, page, pageSize filters)
 * POST /api/consent  — Create a new consent grant
 */

import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';

import type {
  ConsentGrant,
  PaginatedResponse,
  ApiResponse,
} from '@/types';
import {
  seededHex,
  seededAddress,
  generateTxHash,
  generateAttestation,
} from '@/lib/utils';
import {
  ConsentCreateSchema,
  ConsentListQuerySchema,
  parseSearchParams,
} from '@/lib/api/validation';
import { requireAuth, runMiddleware } from '@/lib/api/middleware';
import { createConsent, listConsents } from '@/lib/api/store';

// ---------------------------------------------------------------------------
// GET /api/consent
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const blocked = runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  try {
    const auth = requireAuth(request);
    if ('status' in auth) return auth;

    const query = parseSearchParams(
      ConsentListQuerySchema,
      request.nextUrl.searchParams,
    );

    let filtered = listConsents(auth.walletAddress!);

    if (query.status) {
      filtered = filtered.filter((consent) => consent.status === query.status);
    }

    if (query.scope) {
      const scope = query.scope;
      filtered = filtered.filter((consent) => consent.scopes.includes(scope));
    }

    if (query.search) {
      const q = query.search.toLowerCase();
      filtered = filtered.filter(
        (consent) =>
          consent.providerName.toLowerCase().includes(q)
          || consent.providerAddress.toLowerCase().includes(q),
      );
    }

    filtered.sort((a, b) => b.grantedAt - a.grantedAt);

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / query.limit));
    const page = Math.min(query.page, totalPages);
    const start = (page - 1) * query.limit;
    const items = filtered.slice(start, start + query.limit);

    const body: ApiResponse<PaginatedResponse<ConsentGrant>> = {
      success: true,
      data: {
        items,
        total,
        page,
        pageSize: query.limit,
        totalPages,
        hasMore: page < totalPages,
      },
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(body, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Consent query validation failed',
            details: error.flatten().fieldErrors,
          },
          timestamp: new Date().toISOString(),
        } satisfies ApiResponse<never>,
        { status: 422 },
      );
    }

    throw error;
  }
}

// ---------------------------------------------------------------------------
// POST /api/consent
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const blocked = runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  try {
    const auth = requireAuth(request);
    if ('status' in auth) return auth;

    const form = ConsentCreateSchema.parse(await request.json());

    const seed = Date.now();
    const consent = createConsent(auth.walletAddress!, {
      id: `consent-${seededHex(seed, 12)}`,
      patientAddress: auth.walletAddress!,
      providerAddress: form.providerAddress || seededAddress(seed + 2),
      providerName: form.providerName,
      scopes: form.scopes,
      status: 'active',
      grantedAt: Date.now(),
      expiresAt: Date.now() + form.durationDays * 86400000,
      txHash: generateTxHash(seed),
      attestation: generateAttestation(seed),
      policyId: form.policyId ?? 'policy-0',
      autoRenew: form.autoRenew,
    });

    const body: ApiResponse<ConsentGrant> = {
      success: true,
      data: consent,
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(body, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Consent creation validation failed',
            details: error.flatten().fieldErrors,
          },
          timestamp: new Date().toISOString(),
        } satisfies ApiResponse<never>,
        { status: 422 },
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to create consent' },
        timestamp: new Date().toISOString(),
      } satisfies ApiResponse<never>,
      { status: 500 },
    );
  }
}
