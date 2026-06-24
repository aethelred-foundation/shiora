// ============================================================
// Shiora on Aethelred — Research Data Access Requests API
// GET  /api/research/data-requests — the researcher's own requests
// POST /api/research/data-requests — request access to a marketplace dataset
//   (researcher audience)
// ============================================================

import { NextRequest } from 'next/server';
import { z, ZodError } from 'zod';

import { successResponse, validationError, notFoundResponse, HTTP } from '@/lib/api/responses';
import { runMiddleware } from '@/lib/api/middleware';
import { requireCapability } from '@/lib/api/rbac';
import { createDataRequest, listRequestsByRequester } from '@/lib/api/data-access-service';
import { getMarketplaceListing } from '@/lib/api/marketplace-service';

const RequestSchema = z.object({
  listingId: z.string().trim().min(1).max(128),
  purpose: z.string().trim().min(1).max(2000),
});

export async function GET(request: NextRequest) {
  const blocked = await runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const auth = await requireCapability(request, 'access_research_marketplace');
  if ('status' in auth) return auth;

  const requests = await listRequestsByRequester(auth.walletAddress!);
  return successResponse({ total: requests.length, requests });
}

export async function POST(request: NextRequest) {
  const blocked = await runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const auth = await requireCapability(request, 'access_research_marketplace');
  if ('status' in auth) return auth;

  try {
    const input = RequestSchema.parse(await request.json());
    const listing = await getMarketplaceListing(input.listingId);
    if (!listing) {
      return notFoundResponse('Listing', input.listingId);
    }
    const created = await createDataRequest(auth.walletAddress!, input.listingId, input.purpose);
    return successResponse(created, HTTP.CREATED);
  } catch (err) {
    if (err instanceof ZodError) return validationError(err);
    throw err;
  }
}
