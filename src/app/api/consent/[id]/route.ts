/**
 * Shiora on Aethelred — Single Consent API Route
 *
 * GET    /api/consent/[id]  — Fetch a single consent by ID
 * PATCH  /api/consent/[id]  — Modify consent scopes/duration
 * DELETE /api/consent/[id]  — Revoke consent
 */

import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';

import type {
  ConsentGrant,
  ApiResponse,
} from '@/types';
import { requireAuth, runMiddleware } from '@/lib/api/middleware';
import { ConsentUpdateSchema } from '@/lib/api/validation';
import { getConsent, updateConsent } from '@/lib/api/store';

// ---------------------------------------------------------------------------
// GET /api/consent/[id]
// ---------------------------------------------------------------------------

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const blocked = runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const auth = requireAuth(request);
  if ('status' in auth) return auth;

  const { id } = await params;
  const consent = getConsent(auth.walletAddress!, id);

  if (!consent) {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'NOT_FOUND', message: `Consent ${id} not found` },
        timestamp: new Date().toISOString(),
      } satisfies ApiResponse<never>,
      { status: 404 },
    );
  }

  const body: ApiResponse<ConsentGrant> = {
    success: true,
    data: consent,
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(body);
}

// ---------------------------------------------------------------------------
// PATCH /api/consent/[id]
// ---------------------------------------------------------------------------

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const blocked = runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const auth = requireAuth(request);
  if ('status' in auth) return auth;

  const { id } = await params;
  const consent = getConsent(auth.walletAddress!, id);

  if (!consent) {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'NOT_FOUND', message: `Consent ${id} not found` },
        timestamp: new Date().toISOString(),
      } satisfies ApiResponse<never>,
      { status: 404 },
    );
  }

  if (consent.status !== 'active') {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INVALID_STATE', message: 'Only active consents can be modified' },
        timestamp: new Date().toISOString(),
      } satisfies ApiResponse<never>,
      { status: 400 },
    );
  }

  try {
    const updates = ConsentUpdateSchema.parse(await request.json());
    const updatedConsent = updateConsent(auth.walletAddress!, id, {
      ...(updates.scopes ? { scopes: updates.scopes } : {}),
      ...(updates.durationDays ? {
        expiresAt: Date.now() + updates.durationDays * 86400000,
      } : {}),
    });

    if (!updatedConsent) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: `Consent ${id} not found` },
          timestamp: new Date().toISOString(),
        } satisfies ApiResponse<never>,
        { status: 404 },
      );
    }

    const body: ApiResponse<ConsentGrant> = {
      success: true,
      data: updatedConsent,
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(body);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Consent update validation failed',
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
        error: { code: 'INTERNAL_ERROR', message: 'Failed to modify consent' },
        timestamp: new Date().toISOString(),
      } satisfies ApiResponse<never>,
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/consent/[id]
// ---------------------------------------------------------------------------

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const blocked = runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const auth = requireAuth(request);
  if ('status' in auth) return auth;

  const { id } = await params;
  const consent = getConsent(auth.walletAddress!, id);

  if (!consent) {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'NOT_FOUND', message: `Consent ${id} not found` },
        timestamp: new Date().toISOString(),
      } satisfies ApiResponse<never>,
      { status: 404 },
    );
  }

  const revokedConsent = updateConsent(auth.walletAddress!, id, {
    status: 'revoked',
    revokedAt: Date.now(),
  });

  if (!revokedConsent) {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'NOT_FOUND', message: `Consent ${id} not found` },
        timestamp: new Date().toISOString(),
      } satisfies ApiResponse<never>,
      { status: 404 },
    );
  }

  const body: ApiResponse<{ id: string; status: string }> = {
    success: true,
    data: { id: revokedConsent.id, status: 'revoked' },
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(body);
}
