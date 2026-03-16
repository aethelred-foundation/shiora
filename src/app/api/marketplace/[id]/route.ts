// ============================================================
// Shiora on Aethelred — Single Marketplace Listing API
// GET    /api/marketplace/[id] — Get listing details
// POST   /api/marketplace/[id] — Purchase listing
// DELETE /api/marketplace/[id] — Withdraw listing
// ============================================================

import { NextRequest } from 'next/server';
import {
  successResponse,
  notFoundResponse,
  errorResponse,
  HTTP,
} from '@/lib/api/responses';
import { requireAuth, runMiddleware } from '@/lib/api/middleware';
import {
  buildPurchaseReceipt,
  getMarketplaceListing,
  updateMarketplaceListing,
} from '@/lib/api/store';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const blocked = runMiddleware(request);
  if (blocked) return blocked;

  const { id } = await context.params;
  const listing = getMarketplaceListing(id);
  if (!listing) {
    return notFoundResponse('MarketplaceListing', id);
  }

  return successResponse(listing);
}

export async function POST(request: NextRequest, context: RouteContext) {
  const blocked = runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const auth = requireAuth(request);
  if ('status' in auth) return auth;

  const { id } = await context.params;
  const listing = getMarketplaceListing(id);
  if (!listing) {
    return notFoundResponse('MarketplaceListing', id);
  }

  if (listing.status !== 'active') {
    return errorResponse(
      'LISTING_NOT_AVAILABLE',
      'Only active listings can be purchased.',
      HTTP.CONFLICT,
    );
  }

  if (listing.seller === auth.walletAddress!) {
    return errorResponse(
      'INVALID_PURCHASE',
      'Sellers cannot purchase their own listings.',
      HTTP.CONFLICT,
    );
  }

  updateMarketplaceListing(id, {
    status: 'sold',
    purchaseCount: listing.purchaseCount + 1,
  });

  const purchase = buildPurchaseReceipt(listing, auth.walletAddress!);

  return successResponse(purchase, HTTP.CREATED, {
    message: 'Purchase completed. Dataset is now available for download.',
  });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const blocked = runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const auth = requireAuth(request);
  if ('status' in auth) return auth;

  const { id } = await context.params;
  const listing = getMarketplaceListing(id);
  if (!listing) {
    return notFoundResponse('MarketplaceListing', id);
  }

  if (listing.seller !== auth.walletAddress!) {
    return errorResponse(
      'FORBIDDEN',
      'Only the original seller can withdraw this listing.',
      HTTP.FORBIDDEN,
    );
  }

  const withdrawnListing = updateMarketplaceListing(id, {
    status: 'withdrawn',
  });
  if (!withdrawnListing) {
    return notFoundResponse('MarketplaceListing', id);
  }

  return successResponse(
    {
      id: withdrawnListing.id,
      status: withdrawnListing.status,
      withdrawnAt: Date.now(),
      message: 'Listing withdrawn from marketplace.',
    },
    HTTP.OK,
  );
}
