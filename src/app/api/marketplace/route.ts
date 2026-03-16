// ============================================================
// Shiora on Aethelred — Marketplace API
// GET  /api/marketplace — List data listings
// POST /api/marketplace — Create a new listing
// ============================================================

import { NextRequest } from 'next/server';
import { z, ZodError } from 'zod';
import type { MarketplaceCategory } from '@/types';
import {
  successResponse,
  paginatedResponse,
  errorResponse,
  validationError,
  HTTP,
} from '@/lib/api/responses';
import { requireAuth, runMiddleware } from '@/lib/api/middleware';
import {
  buildMarketplaceListingFromInput,
  createMarketplaceListing,
  listMarketplaceListings,
} from '@/lib/api/store';
import { MARKETPLACE_CATEGORIES } from '@/lib/constants';

const MarketplaceListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  category: z.custom<MarketplaceCategory>().optional(),
  q: z.string().max(200).optional(),
});

const MarketplaceCreateSchema = z.object({
  category: z.custom<MarketplaceCategory>(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  price: z.number().positive(),
  expirationDays: z.number().int().min(1).max(365).default(30),
  anonymizationLevel: z.enum(['k-anonymity', 'l-diversity', 'differential-privacy']).default('k-anonymity'),
});

function parseSearchParams<T extends z.ZodTypeAny>(schema: T, searchParams: URLSearchParams): z.infer<T> {
  const raw: Record<string, string> = {};
  searchParams.forEach((v, k) => { raw[k] = v; });
  return schema.parse(raw);
}

export async function GET(request: NextRequest) {
  const blocked = runMiddleware(request);
  if (blocked) return blocked;

  try {
    const query = parseSearchParams(MarketplaceListQuerySchema, request.nextUrl.searchParams);
    const categoryIds = new Set(MARKETPLACE_CATEGORIES.map((category) => category.id));
    if (query.category && !categoryIds.has(query.category)) {
      return errorResponse(
        'INVALID_CATEGORY',
        'Unsupported marketplace category.',
        HTTP.BAD_REQUEST,
      );
    }

    const listings = listMarketplaceListings().filter((listing) => {
      if (query.category && listing.category !== query.category) return false;
      if (query.q) {
        const q = query.q.toLowerCase();
        if (!listing.title.toLowerCase().includes(q) && !listing.category.toLowerCase().includes(q)) {
          return false;
        }
      }
      return true;
    });

    const total = listings.length;
    const start = (query.page - 1) * query.limit;
    const paged = listings.slice(start, start + query.limit);

    return paginatedResponse(paged, total, query.page, query.limit);
  } catch (err) {
    if (err instanceof ZodError) return validationError(err);
    throw err;
  }
}

export async function POST(request: NextRequest) {
  const blocked = runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  try {
    const auth = requireAuth(request);
    if ('status' in auth) return auth;

    const body = await request.json();
    const validated = MarketplaceCreateSchema.parse(body);

    const allowedCategoryIds = new Set(
      MARKETPLACE_CATEGORIES.map((category) => category.id),
    );
    if (!allowedCategoryIds.has(validated.category)) {
      return errorResponse(
        'INVALID_CATEGORY',
        'Unsupported marketplace category.',
        HTTP.BAD_REQUEST,
      );
    }

    const listing = createMarketplaceListing(
      buildMarketplaceListingFromInput({
        seller: auth.walletAddress!,
        category: validated.category,
        title: validated.title,
        description: validated.description ?? '',
        price: validated.price,
        expirationDays: validated.expirationDays,
        anonymizationLevel: validated.anonymizationLevel,
      }),
    );

    return successResponse(listing, HTTP.CREATED, {
      message: 'Listing created. TEE verification in progress.',
    });
  } catch (err) {
    if (err instanceof ZodError) return validationError(err);
    throw err;
  }
}
