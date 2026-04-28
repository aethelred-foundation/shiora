/** @jest-environment node */

jest.mock('@/lib/api/middleware', () => {
  const actual = jest.requireActual('@/lib/api/middleware');
  return {
    ...actual,
    runMiddleware: jest.fn((...args: unknown[]) => actual.runMiddleware(...args)),
  };
});

jest.mock('@/lib/api/store', () => {
  const actual = jest.requireActual('@/lib/api/store');
  return {
    ...actual,
    listMarketplaceListings: jest.fn((...args: unknown[]) =>
      actual.listMarketplaceListings(...args),
    ),
    updateMarketplaceListing: jest.fn((...args: unknown[]) =>
      actual.updateMarketplaceListing(...args),
    ),
  };
});

import { NextRequest, NextResponse } from 'next/server';
import { runMiddleware } from '@/lib/api/middleware';
import { listMarketplaceListings, updateMarketplaceListing } from '@/lib/api/store';
import { GET as listMarketplace, POST as createListing } from '@/app/api/marketplace/route';
import { GET as getStats } from '@/app/api/marketplace/stats/route';
import {
  GET as getListing,
  POST as purchaseListing,
  DELETE as deleteListing,
} from '@/app/api/marketplace/[id]/route';
import { createSessionToken } from '@/lib/api/session';
import { seededAddress } from '@/lib/utils';

const mockedRunMiddleware = runMiddleware as jest.MockedFunction<typeof runMiddleware>;
const mockedListMarketplaceListings = listMarketplaceListings as jest.MockedFunction<
  typeof listMarketplaceListings
>;
const mockedUpdateMarketplaceListing = updateMarketplaceListing as jest.MockedFunction<
  typeof updateMarketplaceListing
>;
const actualStore = jest.requireActual('@/lib/api/store');

afterEach(() => {
  mockedRunMiddleware.mockImplementation((...args: unknown[]) => {
    const actual = jest.requireActual('@/lib/api/middleware');
    return actual.runMiddleware(...args);
  });
  mockedListMarketplaceListings.mockImplementation((...args: unknown[]) =>
    actualStore.listMarketplaceListings(...args),
  );
  mockedUpdateMarketplaceListing.mockImplementation((...args: unknown[]) =>
    actualStore.updateMarketplaceListing(...args),
  );
});

const addr = seededAddress(7777);
const { token } = createSessionToken(addr);

// A second user for purchase tests
const buyerAddr = seededAddress(8888);
const { token: buyerToken } = createSessionToken(buyerAddr);

function authed(url: string, init?: RequestInit): NextRequest {
  return new NextRequest(url, {
    ...init,
    headers: { ...(init?.headers ?? {}), authorization: `Bearer ${token}` },
  });
}

function buyerAuthed(url: string, init?: RequestInit): NextRequest {
  return new NextRequest(url, {
    ...init,
    headers: { ...(init?.headers ?? {}), authorization: `Bearer ${buyerToken}` },
  });
}

describe('/api/marketplace', () => {
  it('GET returns middleware error when blocked', async () => {
    mockedRunMiddleware.mockReturnValueOnce(
      NextResponse.json({ error: 'blocked' }, { status: 403 }),
    );
    const res = await listMarketplace(new NextRequest('http://localhost:3000/api/marketplace'));
    expect(res.status).toBe(403);
  });

  it('POST returns middleware error when blocked', async () => {
    mockedRunMiddleware.mockReturnValueOnce(
      NextResponse.json({ error: 'blocked' }, { status: 403 }),
    );
    const res = await createListing(
      authed('http://localhost:3000/api/marketplace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: 'vitals_timeseries', title: 'Test', price: 50 }),
      }),
    );
    expect(res.status).toBe(403);
  });

  it('GET lists marketplace data', async () => {
    const req = new NextRequest('http://localhost:3000/api/marketplace');
    const res = await listMarketplace(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.pagination).toBeDefined();
  });

  it('GET supports pagination', async () => {
    const req = new NextRequest('http://localhost:3000/api/marketplace?page=1&limit=5');
    const res = await listMarketplace(req);
    const body = await res.json();
    expect(body.data.length).toBeLessThanOrEqual(5);
    expect(body.pagination.limit).toBe(5);
  });

  it('GET filters by category', async () => {
    const req = new NextRequest('http://localhost:3000/api/marketplace?category=vitals_timeseries');
    const res = await listMarketplace(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    body.data.forEach((item: { category: string }) => {
      expect(item.category).toBe('vitals_timeseries');
    });
  });

  it('GET returns 400 for invalid category', async () => {
    const req = new NextRequest(
      'http://localhost:3000/api/marketplace?category=totally_fake_category',
    );
    const res = await listMarketplace(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_CATEGORY');
  });

  it('GET filters by search query (matching)', async () => {
    const req = new NextRequest('http://localhost:3000/api/marketplace?q=Health');
    const res = await listMarketplace(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('GET filters by search query (no match)', async () => {
    const req = new NextRequest('http://localhost:3000/api/marketplace?q=zzzzzznonexistent');
    const res = await listMarketplace(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.length).toBe(0);
  });

  it('GET returns 422 for invalid pagination params', async () => {
    const req = new NextRequest('http://localhost:3000/api/marketplace?page=-1');
    const res = await listMarketplace(req);
    expect(res.status).toBe(422);
  });

  it('POST creates a listing when authenticated', async () => {
    const res = await createListing(
      authed('http://localhost:3000/api/marketplace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: 'vitals_timeseries',
          title: 'Test Vitals Dataset',
          description: 'Heart rate and blood pressure data',
          price: 50,
          expirationDays: 30,
          anonymizationLevel: 'k-anonymity',
        }),
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.title).toBe('Test Vitals Dataset');
    expect(body.data.seller).toBe(addr);
  });

  it('POST returns 401 from inner requireAuth when middleware is bypassed', async () => {
    mockedRunMiddleware.mockReturnValueOnce(null);
    const req = new NextRequest('http://localhost:3000/api/marketplace', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category: 'vitals_timeseries', title: 'Test', price: 50 }),
    });
    const res = await createListing(req);
    expect(res.status).toBe(401);
  });

  it('POST returns 401 when unauthenticated', async () => {
    const req = new NextRequest('http://localhost:3000/api/marketplace', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category: 'vitals_timeseries', title: 'Test', price: 50 }),
    });
    const res = await createListing(req);
    expect(res.status).toBe(401);
  });

  it('POST returns 422 for invalid body', async () => {
    const res = await createListing(
      authed('http://localhost:3000/api/marketplace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: '' }),
      }),
    );
    expect(res.status).toBe(422);
  });

  it('POST returns 400 for invalid category in body', async () => {
    const res = await createListing(
      authed('http://localhost:3000/api/marketplace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: 'totally_fake_category',
          title: 'Test',
          price: 50,
        }),
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_CATEGORY');
  });

  it('GET re-throws non-ZodError in catch block', async () => {
    mockedListMarketplaceListings.mockImplementationOnce(() => {
      throw new Error('DB connection lost');
    });
    await expect(
      listMarketplace(new NextRequest('http://localhost:3000/api/marketplace')),
    ).rejects.toThrow('DB connection lost');
  });

  it('POST throws on invalid JSON body (non-Zod error)', async () => {
    await expect(
      createListing(
        authed('http://localhost:3000/api/marketplace', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: 'not-json',
        }),
      ),
    ).rejects.toThrow();
  });
});

describe('/api/marketplace/stats', () => {
  it('GET returns middleware error when blocked', async () => {
    mockedRunMiddleware.mockReturnValueOnce(
      NextResponse.json({ error: 'blocked' }, { status: 403 }),
    );
    const res = await getStats(new NextRequest('http://localhost:3000/api/marketplace/stats'));
    expect(res.status).toBe(403);
  });

  it('GET returns marketplace stats', async () => {
    const req = new NextRequest('http://localhost:3000/api/marketplace/stats');
    const res = await getStats(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.totalListings).toBeDefined();
  });

  it('GET returns revenue data when type=revenue', async () => {
    const req = new NextRequest('http://localhost:3000/api/marketplace/stats?type=revenue');
    const res = await getStats(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data[0]).toHaveProperty('day');
    expect(body.data[0]).toHaveProperty('revenue');
    expect(body.data[0]).toHaveProperty('transactions');
  });
});

describe('/api/marketplace/[id]', () => {
  it('GET returns middleware error when blocked', async () => {
    mockedRunMiddleware.mockReturnValueOnce(
      NextResponse.json({ error: 'blocked' }, { status: 403 }),
    );
    const res = await getListing(new NextRequest('http://localhost:3000/api/marketplace/any-id'), {
      params: Promise.resolve({ id: 'any-id' }),
    });
    expect(res.status).toBe(403);
  });

  it('POST returns middleware error when blocked', async () => {
    mockedRunMiddleware.mockReturnValueOnce(
      NextResponse.json({ error: 'blocked' }, { status: 403 }),
    );
    const res = await purchaseListing(
      authed('http://localhost:3000/api/marketplace/any-id', { method: 'POST' }),
      { params: Promise.resolve({ id: 'any-id' }) },
    );
    expect(res.status).toBe(403);
  });

  it('DELETE returns middleware error when blocked', async () => {
    mockedRunMiddleware.mockReturnValueOnce(
      NextResponse.json({ error: 'blocked' }, { status: 403 }),
    );
    const res = await deleteListing(
      authed('http://localhost:3000/api/marketplace/any-id', { method: 'DELETE' }),
      { params: Promise.resolve({ id: 'any-id' }) },
    );
    expect(res.status).toBe(403);
  });

  it('POST returns 401 from inner requireAuth when middleware is bypassed', async () => {
    mockedRunMiddleware.mockReturnValueOnce(null);
    const res = await purchaseListing(
      new NextRequest('http://localhost:3000/api/marketplace/any-id', { method: 'POST' }),
      { params: Promise.resolve({ id: 'any-id' }) },
    );
    expect(res.status).toBe(401);
  });

  it('DELETE returns 401 from inner requireAuth when middleware is bypassed', async () => {
    mockedRunMiddleware.mockReturnValueOnce(null);
    const res = await deleteListing(
      new NextRequest('http://localhost:3000/api/marketplace/any-id', { method: 'DELETE' }),
      { params: Promise.resolve({ id: 'any-id' }) },
    );
    expect(res.status).toBe(401);
  });

  let activeListingId: string;
  let sellerListingId: string;

  beforeAll(async () => {
    // Create a listing owned by `addr` for purchase and delete tests
    const createRes = await createListing(
      authed('http://localhost:3000/api/marketplace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: 'vitals_timeseries',
          title: 'Purchasable Dataset',
          price: 100,
          expirationDays: 30,
          anonymizationLevel: 'k-anonymity',
        }),
      }),
    );
    const createBody = await createRes.json();
    sellerListingId = createBody.data.id;

    // Get any active listing from the seed data for basic tests
    const listRes = await listMarketplace(new NextRequest('http://localhost:3000/api/marketplace'));
    const listBody = await listRes.json();
    activeListingId = listBody.data[0]?.id;
  });

  it('GET returns listing details', async () => {
    expect(activeListingId).toBeDefined();
    const res = await getListing(
      new NextRequest(`http://localhost:3000/api/marketplace/${activeListingId}`),
      { params: Promise.resolve({ id: activeListingId }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.id).toBe(activeListingId);
  });

  it('GET returns 404 for nonexistent listing', async () => {
    const res = await getListing(
      new NextRequest('http://localhost:3000/api/marketplace/nonexistent'),
      { params: Promise.resolve({ id: 'nonexistent' }) },
    );
    expect(res.status).toBe(404);
  });

  // ── POST (purchase) tests ──

  it('POST returns 401 from inner requireAuth when middleware is bypassed', async () => {
    mockedRunMiddleware.mockReturnValueOnce(null);
    const res = await purchaseListing(
      new NextRequest(`http://localhost:3000/api/marketplace/${activeListingId}`, {
        method: 'POST',
      }),
      { params: Promise.resolve({ id: activeListingId }) },
    );
    expect(res.status).toBe(401);
  });

  it('POST returns 401 when unauthenticated', async () => {
    const res = await purchaseListing(
      new NextRequest(`http://localhost:3000/api/marketplace/${activeListingId}`, {
        method: 'POST',
      }),
      { params: Promise.resolve({ id: activeListingId }) },
    );
    expect(res.status).toBe(401);
  });

  it('POST returns 404 when listing does not exist', async () => {
    const res = await purchaseListing(
      buyerAuthed(`http://localhost:3000/api/marketplace/nonexistent`, { method: 'POST' }),
      { params: Promise.resolve({ id: 'nonexistent' }) },
    );
    expect(res.status).toBe(404);
  });

  it('POST returns 409 when seller tries to buy own listing', async () => {
    const res = await purchaseListing(
      authed(`http://localhost:3000/api/marketplace/${sellerListingId}`, { method: 'POST' }),
      { params: Promise.resolve({ id: sellerListingId }) },
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_PURCHASE');
  });

  it('POST successfully purchases an active listing', async () => {
    const res = await purchaseListing(
      buyerAuthed(`http://localhost:3000/api/marketplace/${sellerListingId}`, { method: 'POST' }),
      { params: Promise.resolve({ id: sellerListingId }) },
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.buyer).toBe(buyerAddr);
    expect(body.data.listingId).toBe(sellerListingId);
  });

  it('POST returns 409 when listing is already sold', async () => {
    // The listing was just purchased (status=sold)
    const res = await purchaseListing(
      buyerAuthed(`http://localhost:3000/api/marketplace/${sellerListingId}`, { method: 'POST' }),
      { params: Promise.resolve({ id: sellerListingId }) },
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe('LISTING_NOT_AVAILABLE');
  });

  // ── DELETE (withdraw) tests ──

  it('DELETE returns 401 from inner requireAuth when middleware is bypassed', async () => {
    mockedRunMiddleware.mockReturnValueOnce(null);
    const res = await deleteListing(
      new NextRequest(`http://localhost:3000/api/marketplace/${activeListingId}`, {
        method: 'DELETE',
      }),
      { params: Promise.resolve({ id: activeListingId }) },
    );
    expect(res.status).toBe(401);
  });

  it('DELETE returns 401 when unauthenticated', async () => {
    const res = await deleteListing(
      new NextRequest(`http://localhost:3000/api/marketplace/${activeListingId}`, {
        method: 'DELETE',
      }),
      { params: Promise.resolve({ id: activeListingId }) },
    );
    expect(res.status).toBe(401);
  });

  it('DELETE returns 404 for nonexistent listing', async () => {
    const res = await deleteListing(
      authed(`http://localhost:3000/api/marketplace/nonexistent`, { method: 'DELETE' }),
      { params: Promise.resolve({ id: 'nonexistent' }) },
    );
    expect(res.status).toBe(404);
  });

  it('DELETE returns 403 when non-owner tries to withdraw', async () => {
    // activeListingId is from seed data, not owned by buyerAddr
    const res = await deleteListing(
      buyerAuthed(`http://localhost:3000/api/marketplace/${activeListingId}`, { method: 'DELETE' }),
      { params: Promise.resolve({ id: activeListingId }) },
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('DELETE successfully withdraws own listing', async () => {
    // Create a fresh listing to withdraw
    const createRes = await createListing(
      authed('http://localhost:3000/api/marketplace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: 'vitals_timeseries',
          title: 'Withdrawable Dataset',
          price: 75,
          expirationDays: 30,
          anonymizationLevel: 'k-anonymity',
        }),
      }),
    );
    const createBody = await createRes.json();
    const withdrawId = createBody.data.id;

    const res = await deleteListing(
      authed(`http://localhost:3000/api/marketplace/${withdrawId}`, { method: 'DELETE' }),
      { params: Promise.resolve({ id: withdrawId }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.status).toBe('withdrawn');
    expect(body.data.id).toBe(withdrawId);
  });

  it('DELETE returns 404 when updateMarketplaceListing returns null', async () => {
    // Create a fresh listing so getMarketplaceListing succeeds and seller check passes
    const createRes = await createListing(
      authed('http://localhost:3000/api/marketplace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: 'vitals_timeseries',
          title: 'Null Update Dataset',
          price: 25,
          expirationDays: 30,
          anonymizationLevel: 'k-anonymity',
        }),
      }),
    );
    const createBody = await createRes.json();
    const nullUpdateId = createBody.data.id;

    mockedUpdateMarketplaceListing.mockReturnValueOnce(undefined as never);
    const res = await deleteListing(
      authed(`http://localhost:3000/api/marketplace/${nullUpdateId}`, { method: 'DELETE' }),
      { params: Promise.resolve({ id: nullUpdateId }) },
    );
    expect(res.status).toBe(404);
  });
});
