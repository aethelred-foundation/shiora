/** @jest-environment node */

const pgQuery = jest.fn().mockResolvedValue({ rows: [] });

jest.mock('@/lib/persistence/sql-client', () => ({
  getPgClient: jest.fn(() => ({ query: pgQuery })),
}));

import {
  buildMarketplaceListingFromInput,
  buildPurchaseReceipt,
  createMarketplaceListing,
  getMarketplaceListing,
  listMarketplaceListings,
  updateMarketplaceListing,
  __resetMarketplaceForTests,
} from '@/lib/api/marketplace-service';
import type { MarketplaceCategory } from '@/types';

function listingInput() {
  return {
    seller: 'aeth1seller',
    category: 'menstrual_cycles' as MarketplaceCategory,
    title: 'Cohort A',
    description: 'A privacy-preserving cohort',
    price: 120,
    expirationDays: 30,
    anonymizationLevel: 'differential-privacy' as const,
  };
}

describe('marketplace-service', () => {
  const original = process.env.DATABASE_URL;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = original;
    }
    __resetMarketplaceForTests();
    jest.clearAllMocks();
  });

  it('builds a listing with a collision-free id and sensible defaults', () => {
    const a = buildMarketplaceListingFromInput(listingInput());
    const b = buildMarketplaceListingFromInput(listingInput());
    expect(a.id.startsWith('listing-')).toBe(true);
    expect(a.id).not.toBe(b.id);
    expect(a.status).toBe('active');
    expect(a.currency).toBe('AETHEL');
    expect(a.purchaseCount).toBe(0);
  });

  it('builds a purchase receipt with a collision-free id', () => {
    const listing = buildMarketplaceListingFromInput(listingInput());
    const receipt = buildPurchaseReceipt(listing, 'aeth1buyer');
    expect(receipt.id.startsWith('purchase-')).toBe(true);
    expect(receipt.listingId).toBe(listing.id);
    expect(receipt.buyer).toBe('aeth1buyer');
    expect(receipt.seller).toBe(listing.seller);
  });

  it('persists listings in a single global catalog (in-memory by default)', async () => {
    delete process.env.DATABASE_URL;
    __resetMarketplaceForTests();

    const listing = buildMarketplaceListingFromInput(listingInput());
    await createMarketplaceListing(listing);

    expect((await getMarketplaceListing(listing.id))?.title).toBe('Cohort A');
    expect(await listMarketplaceListings()).toHaveLength(1);

    const updated = await updateMarketplaceListing(listing.id, { status: 'sold' });
    expect(updated?.status).toBe('sold');
  });

  it('selects the Postgres store when DATABASE_URL is configured', async () => {
    process.env.DATABASE_URL = 'postgres://localhost/shiora';
    __resetMarketplaceForTests();

    expect(await listMarketplaceListings()).toEqual([]);
    expect(pgQuery).toHaveBeenCalled();
  });
});
